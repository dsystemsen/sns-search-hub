from rest_framework.routers import DefaultRouter

from .views import ChannelViewSet, CompetitorViewSet, VideoViewSet

router = DefaultRouter()
router.register("channels", ChannelViewSet, basename="channel")
router.register("videos", VideoViewSet, basename="video")
router.register("competitors", CompetitorViewSet, basename="competitor")

urlpatterns = router.urls
