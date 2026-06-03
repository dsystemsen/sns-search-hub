from rest_framework.routers import DefaultRouter

from .views import ContentPlanViewSet

router = DefaultRouter()
router.register("plans", ContentPlanViewSet, basename="content-plan")

urlpatterns = router.urls
