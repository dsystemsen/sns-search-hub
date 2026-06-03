from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from .models import Channel, Competitor, Video
from .serializers import ChannelSerializer, CompetitorSerializer, VideoSerializer


class TenantScopedViewSet(viewsets.ModelViewSet):
    tenant_field = "tenant"

    def _require_tenant(self):
        if not self.request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        return self.request.tenant

    def get_queryset(self):
        tenant = self._require_tenant()
        return self.queryset.filter(**{self.tenant_field: tenant})

    def perform_create(self, serializer):
        tenant = self._require_tenant()
        serializer.save(**{self.tenant_field: tenant})


class ChannelViewSet(TenantScopedViewSet):
    queryset = Channel.objects.all()
    serializer_class = ChannelSerializer


class VideoViewSet(TenantScopedViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer
    tenant_field = "channel__tenant"

    def get_queryset(self):
        tenant = self._require_tenant()
        return Video.objects.filter(channel__tenant=tenant)

    def perform_create(self, serializer):
        self._require_tenant()
        serializer.save()


class CompetitorViewSet(TenantScopedViewSet):
    queryset = Competitor.objects.all()
    serializer_class = CompetitorSerializer
