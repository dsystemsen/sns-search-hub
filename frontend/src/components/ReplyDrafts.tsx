import { useState } from "react";
import { draftCommentReply, type ReplyDraft } from "../api/ai";

const STYLE_LABEL: Record<ReplyDraft["style"], string> = {
  short: "短く丁寧",
  friendly: "フレンドリー",
  cta: "次回訴求型",
};

export function ReplyDrafts({ commentId, enabled }: { commentId: number; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<ReplyDraft[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await draftCommentReply(commentId);
      setDrafts(d);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "ドラフト生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, i: number) {
    navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!open) {
    return (
      <button
        className="link-button"
        disabled={!enabled}
        title={enabled ? "AI返信ドラフトを生成" : "ANTHROPIC_API_KEY 未設定"}
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        🤖 返信案
      </button>
    );
  }

  return (
    <div className="reply-drafts">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <strong style={{ fontSize: "0.85rem" }}>AI返信案</strong>
        <button
          className="link-button"
          onClick={() => {
            setOpen(false);
            setDrafts(null);
          }}
        >
          ✕
        </button>
      </div>
      {loading && <p className="muted" style={{ fontSize: "0.85rem" }}>生成中...</p>}
      {error && <p className="error" style={{ fontSize: "0.85rem" }}>{error}</p>}
      {drafts &&
        drafts.map((d, i) => (
          <div key={i} className="reply-draft-item">
            <div className="muted" style={{ fontSize: "0.75rem", marginBottom: "0.2rem" }}>
              {STYLE_LABEL[d.style]}
            </div>
            <div style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>{d.text}</div>
            <button
              className="link-button"
              style={{ fontSize: "0.75rem", marginTop: "0.2rem" }}
              onClick={() => copy(d.text, i)}
            >
              {copied === i ? "コピーしました ✓" : "コピー"}
            </button>
          </div>
        ))}
    </div>
  );
}
