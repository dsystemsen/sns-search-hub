"""CSV parsers for YouTube Studio exports.

YouTube Studio's analytics exports are CSV files with English or localized
column headers depending on the user's account language. We normalize column
names with a small alias table so that both English and Japanese exports work.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Iterator


# Column aliases: normalized key -> set of accepted header strings (lowercased)
COLUMN_ALIASES: dict[str, set[str]] = {
    "video_id": {"content", "video", "video id", "動画", "コンテンツ"},
    "title": {"video title", "title", "動画タイトル", "タイトル"},
    "date": {"date", "day", "日付"},
    "published_at": {"video publish time", "publish time", "公開日", "公開日時"},
    "views": {"views", "視聴回数"},
    "watch_time_minutes": {
        "watch time (hours)",
        "watch time (minutes)",
        "視聴時間 (時間)",
        "総再生時間（時間）",
        "総再生時間 (分)",
        "視聴時間（分）",
    },
    "average_view_duration_seconds": {
        "average view duration",
        "平均視聴時間",
    },
    "impressions": {"impressions", "インプレッション数"},
    "click_through_rate": {
        "impressions click-through rate (%)",
        "ctr",
        "インプレッションのクリック率 (%)",
    },
    "likes": {"likes", "高評価"},
    "comments": {"comments added", "comments", "コメント追加数", "コメント数"},
    "shares": {"shares", "共有"},
    "subscribers_gained": {"subscribers gained", "登録者の増加数"},
    "subscribers_lost": {"subscribers lost", "登録者の減少数"},
    "subscribers_total": {"subscribers", "subscribers_total", "登録者数", "登録者総数"},
    "videos_total": {"videos", "video count", "動画数", "公開動画数"},
    "views_total": {"total views", "channel views", "累計再生回数", "総再生回数"},
    "author_name": {"author", "author name", "投稿者", "投稿者名", "ユーザー名"},
    "text": {"comment", "comment text", "コメント本文", "コメント"},
    "comment_id": {"comment id", "コメントid", "id"},
    "estimated_revenue": {
        "your estimated revenue (usd)",
        "estimated revenue (usd)",
        "推定収益 (usd)",
    },
}


@dataclass
class ParsedRow:
    raw: dict[str, str]
    normalized: dict[str, object]


class CsvParseError(Exception):
    pass


def _normalize_header(header: str) -> str | None:
    h = header.strip().lower()
    for key, aliases in COLUMN_ALIASES.items():
        if h in aliases:
            return key
    return None


def _parse_decimal(value: str) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    cleaned = value.replace(",", "").replace("%", "").strip()
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return Decimal("0")


def _parse_int(value: str) -> int:
    if value is None or value == "":
        return 0
    cleaned = value.replace(",", "").strip()
    try:
        return int(Decimal(cleaned))
    except (InvalidOperation, ValueError):
        return 0


def _parse_date(value: str) -> date | None:
    if not value:
        return None
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%Y%m%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def parse_csv(file_obj) -> Iterator[ParsedRow]:
    """Iterate over rows in a YouTube Studio CSV file.

    Accepts a file-like opened in binary mode (Django UploadedFile.file).
    Handles UTF-8 with optional BOM.
    """
    if hasattr(file_obj, "read") and not isinstance(file_obj, io.TextIOBase):
        raw = file_obj.read()
        if isinstance(raw, bytes):
            text = raw.decode("utf-8-sig", errors="replace")
        else:
            text = raw
    else:
        text = file_obj.read()

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise CsvParseError("CSVヘッダーが見つかりません。")

    header_map: dict[str, str] = {}
    for h in reader.fieldnames:
        norm = _normalize_header(h)
        if norm:
            header_map[h] = norm

    if not header_map:
        raise CsvParseError("認識できる列がCSVヘッダーにありません。")

    for row in reader:
        normalized: dict[str, object] = {}
        for src, key in header_map.items():
            value = row.get(src, "")
            if key in ("views", "likes", "comments", "shares", "impressions",
                       "subscribers_gained", "subscribers_lost", "subscribers_total",
                       "videos_total", "views_total",
                       "average_view_duration_seconds"):
                normalized[key] = _parse_int(value)
            elif key in ("watch_time_minutes", "click_through_rate", "estimated_revenue"):
                normalized[key] = _parse_decimal(value)
            elif key in ("date", "published_at"):
                normalized[key] = _parse_date(value)
            else:
                normalized[key] = value.strip() if isinstance(value, str) else value
        yield ParsedRow(raw=row, normalized=normalized)
