"""High-level AI services: comment summarization and auto-tagging."""

from __future__ import annotations

import json
import re

from apps.comments.models import Comment

from .client import AIError, complete


SUMMARY_SYSTEM = """あなたはYouTubeチャンネルのコメント分析を支援する日本語アシスタントです。
ユーザーが提供するコメントリストを分析し、以下の構成で短いMarkdownレポートを作成してください:

## 全体傾向
（2〜3文で総括）

## ポジティブな声
（代表的な引用や論点を箇条書き 3点まで）

## 改善・要望
（クレームや質問の傾向を箇条書き 3点まで）

## 注目したいコメント
（特に印象的な1件を引用）

## 推奨アクション
（チャンネル運営者向けの具体的な提案を1〜2項目）

スパムや無関係な投稿は無視してください。事実に基づかない推測は避け、コメントから読み取れる内容のみを記述してください。"""


def summarize_comments(comments: list[Comment]) -> str:
    if not comments:
        return "_対象のコメントがありません_"
    lines = [
        f"- [{c.tag}] {c.author_name}: {c.text[:300]}"
        for c in comments[:200]  # cap to keep prompt small
    ]
    user_prompt = (
        f"以下は {len(lines)} 件のコメントです。これを分析してレポートを作成してください。\n\n"
        + "\n".join(lines)
    )
    return complete(SUMMARY_SYSTEM, user_prompt, max_tokens=1500)


TAG_SYSTEM = """あなたはYouTubeコメントを分類する分類器です。各コメントを次の5カテゴリのいずれかに分類してください:
- good: チャンネルや動画への好意的な感想、応援、感謝
- question: 質問、不明点の確認
- complaint: 不満、改善要望、批判
- spam: スパム、宣伝、無関係な投稿、URL羅列
- other: 上記いずれにも当てはまらない

入力は番号付きのコメントリストです。出力は **JSON のみ** で、`{"results":[{"id": <番号>, "tag": "good|question|complaint|spam|other"}]}` という形式を厳守してください。説明文や前置きは一切書かないでください。"""


def auto_tag_comments(comments: list[Comment]) -> list[dict]:
    """Classify a list of comments. Returns [{comment_id, suggested_tag}]."""
    if not comments:
        return []
    indexed = list(enumerate(comments))
    lines = [f"{i}. {c.text[:250]}" for i, c in indexed]
    user_prompt = "次のコメントを分類してください:\n\n" + "\n".join(lines)
    text = complete(TAG_SYSTEM, user_prompt, max_tokens=2000)

    # Extract JSON — Claude usually returns clean JSON but be defensive
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise AIError(f"AIが想定外の応答を返しました: {text[:200]}")
    try:
        data = json.loads(match.group())
    except json.JSONDecodeError as exc:
        raise AIError(f"AI応答のJSON解析に失敗: {exc}") from exc

    valid_tags = {choice[0] for choice in Comment.TAG_CHOICES}
    results = []
    for entry in data.get("results", []):
        idx = entry.get("id")
        tag = entry.get("tag")
        if not isinstance(idx, int) or idx < 0 or idx >= len(comments):
            continue
        if tag not in valid_tags:
            tag = "other"
        results.append({"comment_id": comments[idx].id, "suggested_tag": tag})
    return results


TITLE_SYSTEM = """あなたはYouTubeチャンネル運営を支援する日本語コピーライターです。
ユーザーがトピック・対象視聴者・既存タイトル案などを示すので、それを元にクリック率が高そうな
日本語タイトルを **必ず5つ** 提案してください。

各タイトルは以下を意識してください:
- 25〜35文字程度、サムネに収まる長さ
- 数字・固有名詞・「〜の理由」「〜してみた」などの強いフックを活用
- 過剰な煽りや釣りタイトルは避ける
- 視聴者が「自分ごと」と感じる表現

出力は **JSON のみ** で、`{"titles": ["タイトル1", "タイトル2", ...]}` の形式を厳守してください。
説明文や前置きは書かないでください。"""


def suggest_titles(*, topic: str, audience: str = "", current_title: str = "") -> list[str]:
    if not topic.strip():
        raise AIError("トピックを入力してください。")
    user_prompt = f"トピック: {topic.strip()}\n"
    if audience.strip():
        user_prompt += f"対象視聴者: {audience.strip()}\n"
    if current_title.strip():
        user_prompt += f"既存のタイトル案: {current_title.strip()}\n"
    user_prompt += "\n上記の情報を元に5つのタイトル候補を提案してください。"

    text = complete(TITLE_SYSTEM, user_prompt, max_tokens=800)
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise AIError(f"AIが想定外の応答を返しました: {text[:200]}")
    try:
        data = json.loads(match.group())
    except json.JSONDecodeError as exc:
        raise AIError(f"AI応答のJSON解析に失敗: {exc}") from exc

    titles = data.get("titles") or []
    return [str(t).strip() for t in titles if str(t).strip()][:5]


REPLY_SYSTEM = """あなたはYouTubeチャンネル運営者に代わって、視聴者コメントへの返信を3パターン提案する日本語アシスタントです。

各返信は次の方針で書いてください:
- 1つは「短く丁寧に」(20〜40文字)
- 1つは「フレンドリーで親しみやすく」(30〜60文字)
- 1つは「次の動画につなげる訴求型」(40〜80文字)

返信内に絵文字を1〜2個含めても構いません。スパム・誹謗中傷コメントの場合は「対応不要」と明示してください。

出力は **JSON のみ** で、`{"drafts": [{"style":"short|friendly|cta","text":"返信文"}]}` の形式を厳守してください。"""


def draft_comment_replies(comment_text: str, author_name: str = "") -> list[dict]:
    if not comment_text.strip():
        raise AIError("コメント本文がありません。")
    user_prompt = f"投稿者: {author_name or '(不明)'}\nコメント本文:\n{comment_text.strip()}"
    text = complete(REPLY_SYSTEM, user_prompt, max_tokens=800)
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise AIError(f"AIが想定外の応答を返しました: {text[:200]}")
    try:
        data = json.loads(match.group())
    except json.JSONDecodeError as exc:
        raise AIError(f"AI応答のJSON解析に失敗: {exc}") from exc

    allowed_styles = {"short", "friendly", "cta"}
    drafts = []
    for d in data.get("drafts", []):
        style = d.get("style") if isinstance(d, dict) else None
        body = str(d.get("text", "")).strip() if isinstance(d, dict) else ""
        if not body:
            continue
        if style not in allowed_styles:
            style = "friendly"
        drafts.append({"style": style, "text": body})
    return drafts[:3]
