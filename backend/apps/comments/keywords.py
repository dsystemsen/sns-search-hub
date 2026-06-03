"""Keyword extraction from comments.

Uses janome for Japanese morphological analysis. We keep only nouns / verbs /
adjectives, filter out stop words and short tokens, and aggregate counts.
"""

from __future__ import annotations

import re
from collections import Counter
from functools import lru_cache
from typing import Iterable

from janome.tokenizer import Tokenizer


# Singleton tokenizer (loading the dict is expensive)
@lru_cache(maxsize=1)
def _tokenizer() -> Tokenizer:
    return Tokenizer()


# Common Japanese/English stop words for short-form comments
STOP_WORDS = {
    "する", "ある", "なる", "いる", "できる", "もの", "こと", "それ", "これ", "あれ",
    "ため", "とき", "ところ", "よう", "そう", "ない", "なし", "ます", "です", "した",
    "して", "した", "から", "まで", "また", "ても", "でも", "けど", "けれど",
    "the", "a", "an", "is", "are", "was", "were", "be", "to", "of", "for", "in",
    "on", "at", "by", "and", "or", "but", "with", "as", "it", "this", "that",
    "i", "you", "he", "she", "we", "they", "my", "your", "our", "their",
    "url", "http", "https", "www",
}

ALLOWED_POS_PREFIXES = ("名詞", "動詞", "形容詞")
EXCLUDED_NOUN_SUBTYPES = {"代名詞", "非自立", "数", "接尾", "副詞可能"}

URL_RE = re.compile(r"https?://\S+")
SYMBOL_RE = re.compile(r"[!-/:-@\[-`{-~。、！？「」『』（）\s]+")


def _normalize(text: str) -> str:
    return URL_RE.sub(" ", text).lower()


def extract_tokens(text: str) -> list[str]:
    """Return base-form tokens of nouns/verbs/adjectives, filtered."""
    tokens = []
    cleaned = _normalize(text)
    for tok in _tokenizer().tokenize(cleaned):
        pos = tok.part_of_speech.split(",")
        main_pos = pos[0]
        sub_pos = pos[1] if len(pos) > 1 else ""
        if not main_pos.startswith(ALLOWED_POS_PREFIXES):
            continue
        if main_pos == "名詞" and sub_pos in EXCLUDED_NOUN_SUBTYPES:
            continue
        base = tok.base_form or tok.surface
        base = base.strip()
        if len(base) < 2 and not re.search(r"[一-龥]", base):
            continue
        if base in STOP_WORDS:
            continue
        if SYMBOL_RE.fullmatch(base):
            continue
        tokens.append(base)
    return tokens


def top_keywords(texts: Iterable[str], top_n: int = 50) -> list[tuple[str, int]]:
    counter: Counter[str] = Counter()
    for t in texts:
        counter.update(extract_tokens(t))
    return counter.most_common(top_n)
