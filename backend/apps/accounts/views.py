from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import SignupSerializer, UserSerializer

User = get_user_model()


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class TenantUsersView(APIView):
    """List users in the requesting user's tenant (for approver pickers, etc.)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.tenant:
            return Response([])
        users = User.objects.filter(tenant=request.tenant).order_by("email")
        return Response(UserSerializer(users, many=True).data)
