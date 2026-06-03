import hashlib

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.comments.models import Comment

from .client import AIError, AINotConfigured
from .services import (
    auto_tag_comments,
    draft_comment_replies,
    suggest_titles,
    summarize_comments,
)


def _api_error(fn):
    try:
        return fn()
    except AINotConfigured as exc:
        return Response({"detail": str(exc), "code": "not_configured"}, status=503)
    except AIError as exc:
        return Response({"detail": str(exc), "code": "ai_error"}, status=502)


class ConfigStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "configured": bool(getattr(settings, "ANTHROPIC_API_KEY", "")),
                "model": getattr(settings, "ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
            }
        )


def _filtered_qs(request):
    if not request.tenant:
        raise PermissionDenied("テナント情報がありません。")
    qs = Comment.objects.filter(tenant=request.tenant)
    channel_id = request.query_params.get("channel") or request.data.get("channel")
    tag = request.query_params.get("tag") or request.data.get("tag")
    start = request.query_params.get("start") or request.data.get("start")
    end = request.query_params.get("end") or request.data.get("end")
    if channel_id:
        qs = qs.filter(video__channel_id=channel_id)
    if tag:
        qs = qs.filter(tag=tag)
    if start:
        qs = qs.filter(published_at__date__gte=start)
    if end:
        qs = qs.filter(published_at__date__lte=end)
    return qs


class SummarizeCommentsView(APIView):
    """Summarize comments matching the supplied filters. Result is cached 1 hour."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        qs = _filtered_qs(request).order_by("-published_at", "-likes")[:200]
        comments = list(qs)
        if not comments:
            return Response({"summary": "_対象のコメントがありません_", "count": 0})

        # Cache by tenant + filter fingerprint
        key_parts = [
            str(request.tenant.id),
            request.data.get("channel", ""),
            request.data.get("tag", ""),
            request.data.get("start", ""),
            request.data.get("end", ""),
            str([c.id for c in comments]),
        ]
        cache_key = "ai_summary:" + hashlib.sha256("|".join(map(str, key_parts)).encode()).hexdigest()
        cached = cache.get(cache_key)
        if cached:
            return Response({"summary": cached, "count": len(comments), "cached": True})

        def _run():
            summary = summarize_comments(comments)
            cache.set(cache_key, summary, timeout=3600)
            return Response({"summary": summary, "count": len(comments), "cached": False})

        return _api_error(_run)


class SuggestTitlesView(APIView):
    """Generate 5 YouTube title alternatives from a topic / audience / current title."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        topic = (request.data.get("topic") or "").strip()
        if not topic:
            raise ValidationError("topic を指定してください。")
        audience = request.data.get("audience") or ""
        current_title = request.data.get("current_title") or ""

        def _run():
            titles = suggest_titles(
                topic=topic, audience=audience, current_title=current_title
            )
            return Response({"titles": titles})

        return _api_error(_run)


class DraftReplyView(APIView):
    """Generate 3 reply drafts (short / friendly / cta) for a single comment."""

    permission_classes = [IsAuthenticated]

    def post(self, request, comment_id: int):
        from apps.comments.models import Comment

        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        try:
            comment = Comment.objects.get(pk=comment_id, tenant=request.tenant)
        except Comment.DoesNotExist as exc:
            raise PermissionDenied("コメントが見つかりません。") from exc

        def _run():
            drafts = draft_comment_replies(comment.text, comment.author_name)
            return Response({"comment_id": comment.id, "drafts": drafts})

        return _api_error(_run)


class AutoTagCommentsView(APIView):
    """Classify untagged comments using Claude. Set ?apply=true to persist."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        apply_changes = str(request.query_params.get("apply", "")).lower() == "true"
        limit = int(request.data.get("limit", 50))
        if limit < 1 or limit > 200:
            raise ValidationError("limit は 1〜200 の範囲で指定してください。")

        qs = Comment.objects.filter(
            tenant=request.tenant, tag=Comment.TAG_UNTAGGED
        )[:limit]
        comments = list(qs)
        if not comments:
            return Response({"suggestions": [], "applied": 0})

        def _run():
            suggestions = auto_tag_comments(comments)
            applied = 0
            if apply_changes:
                from collections import defaultdict

                by_tag = defaultdict(list)
                for s in suggestions:
                    by_tag[s["suggested_tag"]].append(s["comment_id"])
                for tag, ids in by_tag.items():
                    applied += Comment.objects.filter(
                        tenant=request.tenant, id__in=ids
                    ).update(tag=tag)
            return Response(
                {
                    "suggestions": suggestions,
                    "candidate_count": len(comments),
                    "applied": applied,
                }
            )

        return _api_error(_run)
