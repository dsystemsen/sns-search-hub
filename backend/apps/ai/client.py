"""Thin wrapper around the Anthropic Claude API.

We keep the provider abstraction minimal: a single ``complete()`` function that
takes a system prompt + user prompt and returns the text response. Switching to
OpenAI later is a matter of swapping the implementation here.

Model defaults to claude-haiku-4-5 — fast and cheap, suitable for
summarization and short classification tasks.
"""

from __future__ import annotations

from django.conf import settings


class AIError(Exception):
    pass


class AINotConfigured(AIError):
    pass


def _ensure_key() -> str:
    key = getattr(settings, "ANTHROPIC_API_KEY", "")
    if not key:
        raise AINotConfigured(
            "ANTHROPIC_API_KEY が設定されていません。"
            "console.anthropic.com で API キーを発行し backend/.env に設定してください。"
        )
    return key


def complete(system: str, user: str, *, max_tokens: int = 1024) -> str:
    """Send a single-turn chat to Claude and return the assistant text."""
    api_key = _ensure_key()
    try:
        from anthropic import Anthropic
    except ImportError as exc:
        raise AIError("anthropic SDK が見つかりません。pip install anthropic を実行してください。") from exc

    model = getattr(settings, "ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
    client = Anthropic(api_key=api_key)
    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
    except Exception as exc:  # noqa: BLE001
        raise AIError(f"Claude API エラー: {exc}") from exc

    parts = []
    for block in response.content:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "".join(parts).strip()
