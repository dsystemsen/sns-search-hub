import csv
from datetime import date, timedelta

from django.db.models import Count, Q
from django.http import StreamingHttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .keywords import top_keywords
from .models import Comment
from .serializers import CommentSerializer


class _Echo:
    """File-like object that simply returns whatever is written, for csv streaming."""

    def write(self, value):
        return value


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    filterset_fields = ["tag", "is_handled", "video", "video__channel"]
    search_fields = ["text", "author_name"]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if not self.request.tenant:
            return Comment.objects.none()
        qs = Comment.objects.filter(tenant=self.request.tenant).select_related(
            "video", "video__channel"
        )

        tag = self.request.query_params.get("tag")
        handled = self.request.query_params.get("handled")
        pinned = self.request.query_params.get("pinned")
        channel_id = self.request.query_params.get("channel")
        search = self.request.query_params.get("q")
        if tag:
            qs = qs.filter(tag=tag)
        if handled is not None:
            qs = qs.filter(is_handled=(handled == "true"))
        if pinned is not None:
            qs = qs.filter(is_pinned=(pinned == "true"))
        if channel_id:
            qs = qs.filter(video__channel_id=channel_id)
        if search:
            qs = qs.filter(Q(text__icontains=search) | Q(author_name__icontains=search))
        return qs

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        qs = Comment.objects.filter(tenant=request.tenant)
        by_tag = list(qs.values("tag").annotate(count=Count("id")).order_by("tag"))
        total = qs.count()
        handled = qs.filter(is_handled=True).count()
        pinned = qs.filter(is_pinned=True).count()
        return Response(
            {
                "total": total,
                "handled": handled,
                "unhandled": total - handled,
                "pinned": pinned,
                "by_tag": by_tag,
            }
        )

    @action(detail=False, methods=["patch"], url_path="bulk")
    def bulk_update(self, request):
        """Apply the same change to many comments at once."""
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        ids = request.data.get("ids") or []
        if not isinstance(ids, list) or not ids:
            raise ValidationError("ids は1件以上の配列で指定してください。")
        if len(ids) > 1000:
            raise ValidationError("一度に変更できるのは1000件までです。")

        allowed = {"tag", "is_handled", "is_pinned"}
        updates = {k: v for k, v in request.data.items() if k in allowed}
        if not updates:
            raise ValidationError("tag / is_handled / is_pinned のいずれかを指定してください。")

        if "tag" in updates:
            valid_tags = {choice[0] for choice in Comment.TAG_CHOICES}
            if updates["tag"] not in valid_tags:
                raise ValidationError("無効なタグです。")

        affected = Comment.objects.filter(tenant=request.tenant, id__in=ids).update(**updates)
        return Response({"affected": affected, "updates": updates})

    @action(detail=False, methods=["delete"], url_path="bulk-delete")
    def bulk_delete(self, request):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        ids = request.data.get("ids") or []
        if not isinstance(ids, list) or not ids:
            raise ValidationError("ids は1件以上の配列で指定してください。")
        deleted, _ = Comment.objects.filter(tenant=request.tenant, id__in=ids).delete()
        return Response({"deleted": deleted}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        """Stream a CSV of the currently filtered queryset."""
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        qs = self.get_queryset()
        columns = [
            ("id", "ID"),
            ("published_at", "公開日時"),
            ("author_name", "投稿者"),
            ("text", "本文"),
            ("video_title", "動画タイトル"),
            ("likes", "いいね"),
            ("tag", "タグ"),
            ("is_handled", "対応済"),
            ("is_pinned", "ピン留め"),
            ("internal_note", "内部メモ"),
        ]
        writer = csv.writer(_Echo())

        def rows():
            yield "﻿"  # BOM so Excel opens UTF-8 CSV correctly
            yield writer.writerow([h for _, h in columns])
            for c in qs.iterator(chunk_size=500):
                yield writer.writerow(
                    [
                        c.id,
                        c.published_at.isoformat() if c.published_at else "",
                        c.author_name,
                        c.text.replace("\n", " ").replace("\r", " "),
                        c.video.title if c.video_id else "",
                        c.likes,
                        c.get_tag_display(),
                        "○" if c.is_handled else "",
                        "★" if c.is_pinned else "",
                        c.internal_note,
                    ]
                )

        response = StreamingHttpResponse(rows(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="comments.csv"'
        return response

    @action(detail=False, methods=["get"], url_path="keywords")
    def keywords(self, request):
        """Extract top keywords from comment texts in the requested scope."""
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        qs = Comment.objects.filter(tenant=request.tenant)

        channel_id = request.query_params.get("channel")
        tag = request.query_params.get("tag")
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        limit = int(request.query_params.get("limit", "50"))

        if channel_id:
            qs = qs.filter(video__channel_id=channel_id)
        if tag:
            qs = qs.filter(tag=tag)
        if start:
            qs = qs.filter(published_at__date__gte=start)
        if end:
            qs = qs.filter(published_at__date__lte=end)

        texts = qs.values_list("text", flat=True)
        items = top_keywords(texts, top_n=limit)
        return Response(
            {
                "scope": {
                    "channel_id": int(channel_id) if channel_id else None,
                    "tag": tag,
                    "start": start,
                    "end": end,
                },
                "total_comments": qs.count(),
                "keywords": [{"word": w, "count": c} for w, c in items],
            }
        )
