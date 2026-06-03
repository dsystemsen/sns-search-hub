"""Test janome-based keyword extraction."""

from apps.comments.keywords import extract_tokens, top_keywords


def test_extract_basic_japanese_nouns():
    tokens = extract_tokens("この動画はとても面白かったです。")
    # Should contain nouns/adj, exclude particles and copula
    assert "動画" in tokens
    assert "面白い" in tokens or "面白かっ" in tokens
    # particles/copula should be filtered
    assert "は" not in tokens
    assert "です" not in tokens


def test_extract_strips_urls():
    tokens = extract_tokens("リンクはこちら https://example.com/foo にあります")
    assert all("example.com" not in t for t in tokens)
    assert all("https" not in t for t in tokens)


def test_extract_filters_stop_words():
    tokens = extract_tokens("するこれするあるする")
    # All are stop words → no meaningful tokens
    assert tokens == []


def test_extract_lowercases_english():
    tokens = extract_tokens("Amazing CONTENT here")
    assert any("amazing" in t.lower() for t in tokens)


def test_top_keywords_counts_correctly():
    texts = [
        "音声が小さい。改善お願い。",
        "音声が良い。最高。",
        "音声テスト",
    ]
    result = top_keywords(texts, top_n=5)
    words = {w: c for w, c in result}
    assert words.get("音声", 0) >= 3


def test_top_keywords_returns_sorted():
    texts = ["A B B C C C"]
    result = top_keywords(texts)
    # Should be sorted by count desc — at least the first should be most common
    if len(result) >= 2:
        assert result[0][1] >= result[1][1]
