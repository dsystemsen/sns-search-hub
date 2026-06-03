from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CancelSubscriptionView,
    MySubscriptionView,
    PlanViewSet,
    StartCheckoutView,
    stripe_webhook,
)

router = DefaultRouter()
router.register("plans", PlanViewSet, basename="plan")

urlpatterns = [
    path("subscription/me/", MySubscriptionView.as_view(), name="my-subscription"),
    path("subscription/checkout/", StartCheckoutView.as_view(), name="start-checkout"),
    path("subscription/cancel/", CancelSubscriptionView.as_view(), name="cancel-subscription"),
    path("webhooks/stripe/", stripe_webhook, name="stripe-webhook"),
    *router.urls,
]
