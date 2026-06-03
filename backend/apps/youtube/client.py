"""Thin wrapper around YouTube Data API v3.

Uses an API key (public data only). Suitable for:
- Public channel stats (subscribers, video count, lifetime views)
- Public top-level comments via commentThreads
- Public video metadata via videos.list

NOT suitable for: private analytics, write actions, scheduled posting.
Those require OAuth 2.0 and YouTube Analytics API (separate API), which we
defer to a later phase.
"""

from __future__ import annotations

import requests
from django.conf import settings

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"


class YouTubeAPIError(Exception):
    pass


class YouTubeQuotaExceeded(YouTubeAPIError):
    pass


class YouTubeNotConfigured(YouTubeAPIError):
    pass


class YouTubeClient:
    """Public-data client for YouTube Data API v3."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or getattr(settings, "YOUTUBE_API_KEY", "")
        if not self.api_key:
            raise YouTubeNotConfigured(
                "YOUTUBE_API_KEY が設定されていません。Google Cloud で YouTube Data API v3 を有効化し、APIキーを発行してください。"
            )

    def _get(self, endpoint: str, params: dict) -> dict:
        params = {**params, "key": self.api_key}
        resp = requests.get(f"{YOUTUBE_API_BASE}/{endpoint}", params=params, timeout=15)
        if resp.status_code == 403:
            body = resp.json()
            reason = (
                (body.get("error", {}).get("errors", [{}])[0].get("reason"))
                if isinstance(body, dict)
                else ""
            )
            if reason in ("quotaExceeded", "rateLimitExceeded", "dailyLimitExceeded"):
                raise YouTubeQuotaExceeded(f"APIクォータを超過しました: {reason}")
            raise YouTubeAPIError(f"アクセス拒否: {body}")
        if resp.status_code != 200:
            raise YouTubeAPIError(f"HTTP {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    def get_channel_stats(self, channel_id: str) -> dict:
        data = self._get("channels", {"id": channel_id, "part": "snippet,statistics"})
        items = data.get("items", [])
        if not items:
            raise YouTubeAPIError(f"チャンネルが見つかりません: {channel_id}")
        c = items[0]
        stats = c.get("statistics", {})
        return {
            "id": c["id"],
            "title": c["snippet"]["title"],
            "thumbnail_url": (c["snippet"].get("thumbnails", {}).get("default", {}) or {}).get(
                "url", ""
            ),
            "subscriber_count": int(stats.get("subscriberCount", 0) or 0),
            "video_count": int(stats.get("videoCount", 0) or 0),
            "view_count": int(stats.get("viewCount", 0) or 0),
        }

    def resolve_handle(self, handle: str) -> str:
        clean = handle.lstrip("@").strip()
        if not clean:
            raise YouTubeAPIError("ハンドル名が空です。")
        data = self._get("channels", {"forHandle": clean, "part": "id"})
        items = data.get("items", [])
        if not items:
            raise YouTubeAPIError(f"ハンドル @{clean} のチャンネルが見つかりません。")
        return items[0]["id"]

    def list_top_level_comments(self, video_id: str, max_results: int = 100) -> list[dict]:
        """Fetch top-level comments on a public video (up to 100 per call)."""
        data = self._get(
            "commentThreads",
            {
                "videoId": video_id,
                "part": "snippet",
                "maxResults": min(max_results, 100),
                "order": "time",
                "textFormat": "plainText",
            },
        )
        result = []
        for item in data.get("items", []):
            s = item["snippet"]["topLevelComment"]["snippet"]
            result.append(
                {
                    "id": item["id"],
                    "author_name": s.get("authorDisplayName", "(unknown)"),
                    "text": s.get("textDisplay", ""),
                    "like_count": int(s.get("likeCount", 0) or 0),
                    "published_at": s.get("publishedAt"),
                }
            )
        return result

    def get_video_meta(self, video_id: str) -> dict:
        data = self._get("videos", {"id": video_id, "part": "snippet,statistics,contentDetails"})
        items = data.get("items", [])
        if not items:
            raise YouTubeAPIError(f"動画が見つかりません: {video_id}")
        v = items[0]
        s = v["snippet"]
        return {
            "id": v["id"],
            "title": s["title"],
            "description": s.get("description", ""),
            "published_at": s.get("publishedAt"),
            "thumbnail_url": (s.get("thumbnails", {}).get("default", {}) or {}).get("url", ""),
            "tags": s.get("tags", []),
            "channel_id": s["channelId"],
        }
