from django.contrib import admin

from .models import ContentPlan, ContentPlanApproval, ContentPlanComment


class ApprovalInline(admin.TabularInline):
    model = ContentPlanApproval
    extra = 0


class CommentInline(admin.TabularInline):
    model = ContentPlanComment
    extra = 0


@admin.register(ContentPlan)
class ContentPlanAdmin(admin.ModelAdmin):
    list_display = ("title", "tenant", "channel", "planned_publish_at", "status", "created_by")
    list_filter = ("status", "tenant", "channel")
    search_fields = ("title", "description")
    inlines = [ApprovalInline, CommentInline]
    date_hierarchy = "planned_publish_at"


@admin.register(ContentPlanApproval)
class ContentPlanApprovalAdmin(admin.ModelAdmin):
    list_display = ("content_plan", "approver", "order", "status", "decided_at")
    list_filter = ("status",)
