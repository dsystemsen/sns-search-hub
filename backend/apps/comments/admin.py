from django.contrib import admin

from .models import Comment


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("author_name", "video", "published_at", "tag", "is_handled", "likes")
    list_filter = ("tag", "is_handled", "video__channel")
    search_fields = ("author_name", "text")
    date_hierarchy = "published_at"
