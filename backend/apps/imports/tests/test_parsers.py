"""Tests for the CSV parser, covering English + Japanese headers and edge cases."""

import io
import pytest

from apps.imports.parsers import CsvParseError, parse_csv


def _bytes(text: str) -> io.BytesIO:
    return io.BytesIO(text.encode("utf-8"))


def test_parse_english_video_daily():
    csv = (
        "Date,Content,Views,Watch time (minutes),Likes,Comments added,Shares\n"
        "2026-05-01,abc123,1200,3400.5,80,12,5\n"
        "2026-05-02,abc123,1500,4200.2,95,18,7\n"
    )
    rows = list(parse_csv(_bytes(csv)))
    assert len(rows) == 2
    assert rows[0].normalized["video_id"] == "abc123"
    assert rows[0].normalized["views"] == 1200
    assert float(rows[0].normalized["watch_time_minutes"]) == 3400.5
    assert rows[0].normalized["likes"] == 80
    assert rows[0].normalized["comments"] == 12
    assert rows[1].normalized["shares"] == 7


def test_parse_japanese_headers():
    csv = (
        "日付,動画,視聴回数,視聴時間（分）,高評価,コメント追加数\n"
        "2026-05-01,vid_jp,500,1200.0,30,4\n"
    )
    rows = list(parse_csv(_bytes(csv)))
    assert rows[0].normalized["video_id"] == "vid_jp"
    assert rows[0].normalized["views"] == 500
    assert rows[0].normalized["likes"] == 30
    assert rows[0].normalized["comments"] == 4


def test_parse_handles_bom_and_commas_in_numbers():
    csv = "﻿Date,Content,Views\n2026-05-01,vid,\"1,200\"\n"
    rows = list(parse_csv(_bytes(csv)))
    assert rows[0].normalized["views"] == 1200


def test_parse_invalid_header_raises():
    csv = "totally_unknown_column\n1\n"
    with pytest.raises(CsvParseError):
        list(parse_csv(_bytes(csv)))


def test_parse_empty_fields_default_to_zero():
    csv = "Date,Content,Views,Likes\n2026-05-01,vid,,\n"
    rows = list(parse_csv(_bytes(csv)))
    assert rows[0].normalized["views"] == 0
    assert rows[0].normalized["likes"] == 0


def test_parse_competitor_daily_columns():
    csv = (
        "Date,Subscribers,Videos,Total views\n"
        "2026-04-01,150000,420,98000000\n"
    )
    rows = list(parse_csv(_bytes(csv)))
    assert rows[0].normalized["subscribers_total"] == 150000
    assert rows[0].normalized["videos_total"] == 420
    assert rows[0].normalized["views_total"] == 98000000


def test_parse_comment_columns():
    csv = (
        "Comment ID,Video,Author,Comment,Date,Likes\n"
        "c1,vid1,Yuki,Great video,2026-05-15,42\n"
    )
    rows = list(parse_csv(_bytes(csv)))
    r = rows[0].normalized
    assert r["comment_id"] == "c1"
    assert r["video_id"] == "vid1"
    assert r["author_name"] == "Yuki"
    assert r["text"] == "Great video"
    assert r["likes"] == 42
