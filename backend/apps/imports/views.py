from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import ImportJob
from .serializers import ImportJobSerializer
from .tasks import process_import_job


class ImportJobViewSet(viewsets.ModelViewSet):
    serializer_class = ImportJobSerializer
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        if not self.request.tenant:
            return ImportJob.objects.none()
        return ImportJob.objects.filter(tenant=self.request.tenant)

    def create(self, request, *args, **kwargs):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = serializer.save(tenant=request.tenant, uploaded_by=request.user)
        process_import_job.delay(job.id)
        job.refresh_from_db()
        return Response(self.get_serializer(job).data, status=status.HTTP_201_CREATED)
