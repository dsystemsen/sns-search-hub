import json

import stripe
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Plan, Subscription
from .services import (
    cancel_subscription,
    get_or_create_subscription,
    handle_stripe_event,
    start_checkout,
)


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = (
            "id",
            "code",
            "name",
            "monthly_price_jpy",
            "annual_price_jpy",
            "included_channels",
            "extra_channel_price_jpy",
        )


class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Plan.objects.filter(is_active=True).order_by("monthly_price_jpy")
    serializer_class = PlanSerializer
    permission_classes = [AllowAny]


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_detail = PlanSerializer(source="plan", read_only=True)

    class Meta:
        model = Subscription
        fields = (
            "id",
            "plan",
            "plan_detail",
            "status",
            "current_period_end",
            "cancel_at_period_end",
            "stripe_customer_id",
            "stripe_subscription_id",
        )
        read_only_fields = fields


class MySubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        sub = get_or_create_subscription(request.tenant)
        return Response(SubscriptionSerializer(sub).data)


class StartCheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        plan_code = request.data.get("plan_code")
        interval = request.data.get("interval", "month")
        if interval not in ("month", "year"):
            raise ValidationError("interval は 'month' か 'year' を指定してください。")
        try:
            plan = Plan.objects.get(code=plan_code, is_active=True)
        except Plan.DoesNotExist as exc:
            raise ValidationError("無効なプランです。") from exc
        result = start_checkout(request.tenant, plan, interval)
        return Response(result)


class CancelSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        sub = cancel_subscription(request.tenant)
        return Response(SubscriptionSerializer(sub).data)


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
    secret = settings.STRIPE_WEBHOOK_SECRET

    if secret and sig_header:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, secret)
        except (ValueError, stripe.error.SignatureVerificationError) as exc:
            return HttpResponse(f"Invalid: {exc}", status=400)
    else:
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            return HttpResponse("Invalid JSON", status=400)

    handle_stripe_event(event)
    return HttpResponse(status=200)
