from datetime import datetime

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.analytics.csv_export import stream_csv

from .models import ContentPlan, ContentPlanApproval, ContentPlanComment
from .serializers import (
    ContentPlanApprovalSerializer,
    ContentPlanCommentSerializer,
    ContentPlanSerializer,
)


class ContentPlanViewSet(viewsets.ModelViewSet):
    serializer_class = ContentPlanSerializer
    filterset_fields = ["status", "channel"]

    def get_queryset(self):
        if not self.request.tenant:
            return ContentPlan.objects.none()
        qs = ContentPlan.objects.filter(tenant=self.request.tenant).prefetch_related(
            "approvals__approver", "comments__author"
        )
        # ?from=YYYY-MM-DD&to=YYYY-MM-DD filters for calendar view
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        if date_from:
            qs = qs.filter(planned_publish_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(planned_publish_at__date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        if not self.request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit_for_review(self, request, pk=None):
        plan = self.get_object()
        if plan.status not in (ContentPlan.STATUS_DRAFT, ContentPlan.STATUS_REJECTED):
            raise ValidationError("レビューに進められる状態ではありません。")
        if not plan.approvals.exists():
            raise ValidationError("承認者が設定されていません。")
        # Reset approvals to pending if resubmitting
        plan.approvals.update(
            status=ContentPlanApproval.STATUS_PENDING, decided_at=None, comment=""
        )
        plan.status = ContentPlan.STATUS_IN_REVIEW
        plan.save(update_fields=["status", "updated_at"])
        plan = self.get_queryset().get(pk=plan.pk)

        try:
            from apps.notifications.services import notify_tenant

            approver_names = ", ".join(
                a.approver.email for a in plan.approvals.all()
            )
            notify_tenant(
                request.tenant,
                f"📝 *レビュー依頼*\n"
                f"プラン: {plan.title}\n"
                f"公開予定: {plan.planned_publish_at:%Y-%m-%d %H:%M}\n"
                f"承認者: {approver_names}",
            )
        except Exception:  # noqa: BLE001
            pass

        return Response(self.get_serializer(plan).data)

    @action(detail=True, methods=["post"], url_path="decide")
    def decide(self, request, pk=None):
        plan = self.get_object()
        decision = request.data.get("decision")
        comment = request.data.get("comment", "")
        if decision not in ("approve", "reject"):
            raise ValidationError("decision は 'approve' か 'reject' を指定してください。")
        if plan.status != ContentPlan.STATUS_IN_REVIEW:
            raise ValidationError("レビュー中のプランのみ承認/差し戻しできます。")

        try:
            approval = plan.approvals.get(approver=request.user)
        except ContentPlanApproval.DoesNotExist as exc:
            raise PermissionDenied("このプランの承認者ではありません。") from exc

        if approval.status != ContentPlanApproval.STATUS_PENDING:
            raise ValidationError("既に判定済みです。")

        approval.status = (
            ContentPlanApproval.STATUS_APPROVED
            if decision == "approve"
            else ContentPlanApproval.STATUS_REJECTED
        )
        approval.comment = comment
        approval.decided_at = timezone.now()
        approval.save(update_fields=["status", "comment", "decided_at"])

        # Update plan status
        if decision == "reject":
            plan.status = ContentPlan.STATUS_REJECTED
        elif plan.approvals.filter(status=ContentPlanApproval.STATUS_PENDING).exists():
            pass  # still waiting on others
        else:
            plan.status = ContentPlan.STATUS_APPROVED
        plan.save(update_fields=["status", "updated_at"])

        plan = self.get_queryset().get(pk=plan.pk)
        return Response(self.get_serializer(plan).data)

    @action(detail=True, methods=["post"], url_path="mark-published")
    def mark_published(self, request, pk=None):
        plan = self.get_object()
        if plan.status != ContentPlan.STATUS_APPROVED:
            raise ValidationError("承認済みのプランのみ公開済みにできます。")
        plan.status = ContentPlan.STATUS_PUBLISHED
        plan.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(plan).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        plan = self.get_object()
        if plan.status == ContentPlan.STATUS_PUBLISHED:
            raise ValidationError("公開済みプランはキャンセルできません。")
        plan.status = ContentPlan.STATUS_CANCELLED
        plan.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(plan).data)

    @action(detail=True, methods=["post"], url_path="comments")
    def add_comment(self, request, pk=None):
        plan = self.get_object()
        body = request.data.get("body", "").strip()
        if not body:
            raise ValidationError("本文を入力してください。")
        comment = ContentPlanComment.objects.create(
            content_plan=plan, author=request.user, body=body
        )
        return Response(
            ContentPlanCommentSerializer(comment).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["post"], url_path="bulk-submit")
    def bulk_submit(self, request):
        ids = request.data.get("ids") or []
        if not isinstance(ids, list) or not ids:
            raise ValidationError("ids は1件以上の配列で指定してください。")
        qs = self.get_queryset().filter(
            id__in=ids,
            status__in=[ContentPlan.STATUS_DRAFT, ContentPlan.STATUS_REJECTED],
        )
        affected = 0
        for plan in qs:
            if not plan.approvals.exists():
                continue
            plan.approvals.update(
                status=ContentPlanApproval.STATUS_PENDING, decided_at=None, comment=""
            )
            plan.status = ContentPlan.STATUS_IN_REVIEW
            plan.save(update_fields=["status", "updated_at"])
            affected += 1
        return Response({"submitted": affected})

    @action(detail=False, methods=["post"], url_path="bulk-cancel")
    def bulk_cancel(self, request):
        ids = request.data.get("ids") or []
        if not isinstance(ids, list) or not ids:
            raise ValidationError("ids は1件以上の配列で指定してください。")
        affected = (
            self.get_queryset()
            .filter(id__in=ids)
            .exclude(status__in=[ContentPlan.STATUS_PUBLISHED, ContentPlan.STATUS_CANCELLED])
            .update(status=ContentPlan.STATUS_CANCELLED)
        )
        return Response({"cancelled": affected})

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        qs = self.get_queryset().select_related("channel", "created_by")
        return stream_csv(
            filename=f"plans_{timezone.localdate()}.csv",
            headers=["ID", "タイトル", "チャンネル", "公開予定", "状態", "作成者", "作成日"],
            rows=qs,
            serialize=lambda p: [
                p.id,
                p.title,
                p.channel.name if p.channel else "",
                p.planned_publish_at.isoformat(),
                p.get_status_display(),
                p.created_by.email if p.created_by else "",
                p.created_at.isoformat(),
            ],
        )
