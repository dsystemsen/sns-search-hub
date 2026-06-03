from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import TenantSerializer


class CurrentTenantView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.tenant:
            return Response({"detail": "No tenant assigned."}, status=status.HTTP_404_NOT_FOUND)
        return Response(TenantSerializer(request.tenant).data)

    def patch(self, request):
        if not request.tenant:
            return Response({"detail": "No tenant assigned."}, status=status.HTTP_404_NOT_FOUND)
        serializer = TenantSerializer(
            request.tenant, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
