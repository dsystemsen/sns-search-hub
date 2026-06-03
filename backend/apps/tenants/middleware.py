from django.utils.deprecation import MiddlewareMixin
from django.utils.functional import SimpleLazyObject


def _get_tenant(request):
    user = getattr(request, "user", None)
    if user is None or not user.is_authenticated:
        return None
    return getattr(user, "tenant", None)


class TenantMiddleware(MiddlewareMixin):
    """Attach the authenticated user's tenant to the request, evaluated lazily.

    DRF authentication runs at view dispatch time, after this middleware. A lazy
    object lets `request.tenant` be evaluated then instead of now, so JWT-authed
    requests still resolve their tenant correctly.
    """

    def process_request(self, request):
        request.tenant = SimpleLazyObject(lambda: _get_tenant(request))
