from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import notify_tenant


class TestNotificationView(APIView):
    """Send a test message to the tenant's configured webhooks."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        if not request.tenant.slack_webhook_url and not request.tenant.discord_webhook_url:
            raise ValidationError(
                "Slack または Discord のWebhook URLを設定してください。"
            )
        text = request.data.get("text") or (
            f"📣 YT Analytics — テスト通知 ({request.tenant.name} より)"
        )
        result = notify_tenant(request.tenant, text)
        return Response(result)
