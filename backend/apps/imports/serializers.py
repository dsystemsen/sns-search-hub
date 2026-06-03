from rest_framework import serializers

from .models import ImportJob


class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = (
            "id",
            "channel",
            "competitor",
            "source_type",
            "file",
            "status",
            "rows_total",
            "rows_imported",
            "rows_skipped",
            "error_message",
            "created_at",
        )
        read_only_fields = (
            "status",
            "rows_total",
            "rows_imported",
            "rows_skipped",
            "error_message",
            "created_at",
        )
