import { useEffect, useState } from "react";
import { autoTagComments, getAIConfig, summarizeComments, type TagSuggestion } from "../api/ai";
import { TAG_LABELS, type CommentTag } from "../api/comments";

type Props = {
  /** Filter context passed to the summary endpoint. */
  filters?: { channel?: number; tag?: CommentTag; start?: string; end?: string };
  /** Called after auto-tag is applied successfully so the parent can refresh. */
  onTagsApplied?: () => void;
};

export function AiToolbox({ filters, onTagsApplied }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryCount, setSummaryCount] = useState(0);
  const [summarizing, setSummarizing] = useState(false);
  const [suggestions, setSuggestions] = useState<TagSuggestion[] | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [classifying, setClassifying] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAIConfig()
      .then((cfg) => setConfigured(cfg.configured))
      .catch(() => setConfigured(false));
  }, []);

  async function onSummarize() {
    setError(null);
    setSummarizing(true);
    setSummary(null);
    try {
      const res = await summarizeComments(filters);
      setSummary(res.summary);
      setSummaryCount(res.count);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "要約の生成に失敗しました。");
    } finally {
      setSummarizing(false);
    }
  }

  async function onAutoTag() {
    setError(null);
    setClassifying(true);
    setSuggestions(null);
    try {
      const res = await autoTagComments({ limit: 50, apply: false });
      setSuggestions(res.suggestions);
      setCandidateCount(res.candidate_count);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "AI分類に失敗しました。");
    } finally {
      setClassifying(false);
    }
  }

  async function onApplyTags() {
    setApplying(true);
    try {
      const res = await autoTagComments({ limit: 50, apply: true });
      setSuggestions(null);
      setCandidateCount(0);
      onTagsApplied?.();
      alert(`${res.applied}件のコメントにタグを適用しました。`);
    } finally {
      setApplying(false);
    }
  }

  if (configured === null) return null;

  return (
    <div className="ai-toolbox">
      <div className="ai-toolbox-head">
        <strong>🤖 AI機能</strong>
        {!configured && (
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            (Anthropic APIキー未設定 — <code>ANTHROPIC_API_KEY</code> を <code>.env</code> に設定してください)
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button onClick={onSummarize} disabled={!configured || summarizing}>
          {summarizing ? "要約中..." : "現在のフィルタを要約"}
        </button>
        <button onClick={onAutoTag} disabled={!configured || classifying}>
          {classifying ? "AI分類中..." : "未分類コメントをAIで分類"}
        </button>
      </div>

      {error && <p className="error" style={{ marginTop: "0.6rem" }}>{error}</p>}

      {summary && (
        <div className="ai-result">
          <div className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            対象コメント: {summaryCount}件
          </div>
          <div className="markdown-block">{summary}</div>
        </div>
      )}

      {suggestions && (
        <div className="ai-result">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              候補 {candidateCount}件 → 提案 {suggestions.length}件
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={onApplyTags} disabled={applying || suggestions.length === 0}>
                {applying ? "適用中..." : "この内容で適用"}
              </button>
              <button className="link-button" onClick={() => setSuggestions(null)}>
                破棄
              </button>
            </div>
          </div>
          {suggestions.length === 0 ? (
            <p className="muted">未分類のコメントがありません。</p>
          ) : (
            <table className="data-table" style={{ marginTop: "0.5rem" }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>提案タグ</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr key={s.comment_id}>
                    <td>#{s.comment_id}</td>
                    <td>{TAG_LABELS[s.suggested_tag]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
