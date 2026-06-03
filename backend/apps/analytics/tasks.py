from __future__ import annotations

from celery import shared_task
from django.core.files.base import ContentFile

from .emailing import send_monthly_reports
from .models import Report
from .reports import build_channel_report


@shared_task
def generate_report(report_id: int) -> None:
    try:
        report = Report.objects.select_related("channel").get(pk=report_id)
    except Report.DoesNotExist:
        return

    report.status = Report.STATUS_RUNNING
    report.save(update_fields=["status", "updated_at"])

    if report.channel is None:
        report.status = Report.STATUS_FAILED
        report.error_message = "レポート生成にはチャンネル指定が必要です。"
        report.save(update_fields=["status", "error_message", "updated_at"])
        return

    try:
        content = build_channel_report(report.channel, report.period_start, report.period_end)
        filename = (
            f"{report.channel.slug if hasattr(report.channel, 'slug') else report.channel.id}"
            f"_{report.period_start.isoformat()}_{report.period_end.isoformat()}.xlsx"
        )
        report.file.save(filename, ContentFile(content), save=False)
        report.status = Report.STATUS_DONE
        report.error_message = ""
        report.save(update_fields=["file", "status", "error_message", "updated_at"])
    except Exception as exc:  # noqa: BLE001
        report.status = Report.STATUS_FAILED
        report.error_message = f"{type(exc).__name__}: {exc}"
        report.save(update_fields=["status", "error_message", "updated_at"])


@shared_task
def send_monthly_reports_task() -> int:
    """Scheduled monthly delivery. Hook this up to Celery beat at e.g. 1st of month 09:00 JST."""
    return send_monthly_reports()
