from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("email", "username", "tenant", "role", "is_active", "is_staff")
    list_filter = ("tenant", "role", "is_active", "is_staff")
    search_fields = ("email", "username")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Tenant & Role", {"fields": ("tenant", "role")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("Tenant & Role", {"fields": ("email", "tenant", "role")}),
    )
