from rest_framework.routers import DefaultRouter

from .views import ImportJobViewSet

router = DefaultRouter()
router.register("jobs", ImportJobViewSet, basename="import-job")

urlpatterns = router.urls
