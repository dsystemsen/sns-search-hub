from django.contrib import admin

from .models import ImportJob


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "tenant",
        "channel",
        "source_type",
        "status",
        "rows_imported",
        "rows_skipped",
        "created_at",
    )
    list_filter = ("status", "source_type", "tenant")
    date_hierarchy = "created_at"
    readonly_fields = ("rows_total", "rows_imported", "rows_skipped", "error_message")
