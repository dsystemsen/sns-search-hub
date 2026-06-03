"""Monthly report email delivery.

For each tenant's active channel, generate an Excel report covering the
previous month and email it to all users in the tenant. Builder reuses the
same ``build_channel_report`` used by the on-demand report endpoint.
"""

from __future__ import annotations

import calendar
from datetime import date, timedelta

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from apps.channels.models import Channel
from apps.tenants.models import Tenant

from .models import Report
from .reports import build_channel_report


def previous_month_range(today: date | None = None) -> tuple[date, date]:
    today = today or timezone.localdate()
    first_of_this_month = today.replace(day=1)
    last_of_prev = first_of_this_month - timedelta(days=1)
    first_of_prev = last_of_prev.replace(day=1)
    return first_of_prev, last_of_prev


def send_monthly_reports(tenant: Tenant | None = None, period_start: date | None = None, period_end: date | None = None) -> int:
    """Generate and email monthly reports. Returns the number of emails sent.

    If ``tenant`` is provided, only that tenant is processed; otherwise all active tenants.
    """
    if period_start is None or period_end is None:
        period_start, period_end = previous_month_range()

    tenants = (
        Tenant.objects.filter(pk=tenant.pk, is_active=True)
        if tenant
        else Tenant.objects.filter(is_active=True)
    )

    sent = 0
    for t in tenants:
        recipients = list(t.users.exclude(email="").values_list("email", flat=True))
        if not recipients:
            continue
        for channel in Channel.objects.filter(tenant=t, is_active=True):
            try:
                content = build_channel_report(channel, period_start, period_end)
            except Exception as exc:  # noqa: BLE001
                Report.objects.create(
                    tenant=t,
                    channel=channel,
                    period_start=period_start,
                    period_end=period_end,
                    status=Report.STATUS_FAILED,
                    error_message=f"{type(exc).__name__}: {exc}",
                )
                continue

            from django.core.files.base import ContentFile

            report = Report.objects.create(
                tenant=t,
                channel=channel,
                period_start=period_start,
                period_end=period_end,
                status=Report.STATUS_DONE,
            )
            filename = f"{channel.id}_{period_start.isoformat()}_{period_end.isoformat()}.xlsx"
            report.file.save(filename, ContentFile(content), save=True)

            subject = f"[YT Analytics] {channel.name} 月次レポート ({period_start:%Y年%m月})"
            body = (
                f"{t.name} 様\n\n"
                f"チャンネル「{channel.name}」の月次レポートをお送りします。\n"
                f"対象期間: {period_start.isoformat()} 〜 {period_end.isoformat()}\n\n"
                f"添付のExcelファイルをご確認ください。\n\n"
                f"-- YouTube Analytics SaaS"
            )
            msg = EmailMessage(
                subject=subject,
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=recipients,
            )
            msg.attach(filename, content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            msg.send(fail_silently=False)
            sent += 1

            try:
                from apps.notifications.services import notify_tenant

                notify_tenant(
                    t,
                    f"📊 *月次レポート送信完了*\n"
                    f"チャンネル: {channel.name}\n"
                    f"期間: {period_start} 〜 {period_end}\n"
                    f"送信先: {len(recipients)}件",
                )
            except Exception:  # noqa: BLE001
                pass
    return sent
