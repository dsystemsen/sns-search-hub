"""Test bulk operations and CSV export endpoints."""

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


def _auth(user):
    refresh = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def comments(db, tenant, channel):
    from apps.channels.models import Video
    from apps.comments.models import Comment

    video = Video.objects.create(channel=channel, youtube_video_id="v1", title="Video 1")
    return [
        Comment.objects.create(
            tenant=tenant, video=video, author_name=f"User{i}", text=f"Comment {i}", likes=i
        )
        for i in range(3)
    ]


def test_bulk_update_changes_tag_and_pin(user, comments):
    client = _auth(user)
    ids = [c.id for c in comments]
    resp = client.patch(
        "/api/comments/bulk/",
        {"ids": ids, "tag": "good", "is_pinned": True},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["affected"] == 3
    for c in comments:
        c.refresh_from_db()
        assert c.tag == "good"
        assert c.is_pinned is True


def test_bulk_update_rejects_invalid_tag(user, comments):
    client = _auth(user)
    resp = client.patch(
        "/api/comments/bulk/",
        {"ids": [c.id for c in comments], "tag": "bogus"},
        format="json",
    )
    assert resp.status_code == 400


def test_bulk_update_rejects_empty_ids(user):
    client = _auth(user)
    resp = client.patch(
        "/api/comments/bulk/", {"ids": [], "tag": "good"}, format="json"
    )
    assert resp.status_code == 400


def test_bulk_update_isolated_by_tenant(user, other_user, comments):
    """Other tenant's bulk request must not affect our comments."""
    ids = [c.id for c in comments]
    client = _auth(other_user)
    resp = client.patch(
        "/api/comments/bulk/", {"ids": ids, "tag": "spam"}, format="json"
    )
    assert resp.json()["affected"] == 0
    for c in comments:
        c.refresh_from_db()
        assert c.tag == "untagged"


def test_bulk_delete(user, comments):
    client = _auth(user)
    ids = [c.id for c in comments[:2]]
    resp = client.delete(
        "/api/comments/bulk-delete/", {"ids": ids}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["deleted"] == 2
    from apps.comments.models import Comment

    assert Comment.objects.count() == 1


def test_csv_export_returns_utf8_with_bom(user, comments):
    client = _auth(user)
    resp = client.get("/api/comments/export/")
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("text/csv")
    body = b"".join(resp.streaming_content)
    # UTF-8 BOM at the start
    assert body.startswith(b"\xef\xbb\xbf")
    # Header row in Japanese
    text = body.decode("utf-8-sig")
    assert "公開日時" in text
    assert "投稿者" in text


def test_csv_export_respects_filter(user, comments, channel):
    from apps.comments.models import Comment

    Comment.objects.filter(id=comments[0].id).update(tag="spam")
    client = _auth(user)
    resp = client.get("/api/comments/export/?tag=spam")
    body = b"".join(resp.streaming_content).decode("utf-8-sig")
    # Should only include the spam comment
    assert "Comment 0" in body
    assert "Comment 1" not in body


def test_pin_toggle_via_patch(user, comments):
    client = _auth(user)
    c = comments[0]
    resp = client.patch(f"/api/comments/{c.id}/", {"is_pinned": True}, format="json")
    assert resp.status_code == 200
    assert resp.json()["is_pinned"] is True
