import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAIConfig, suggestTitles } from "../api/ai";
import type { User } from "../api/auth";
import { listChannels, type Channel } from "../api/channels";
import { createPlan, listTenantUsers } from "../api/content";

export function NewPlanPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [channelId, setChannelId] = useState<number | "">("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [approverIds, setApproverIds] = useState<number[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [chs, us, cfg] = await Promise.all([
        listChannels(),
        listTenantUsers(),
        getAIConfig().catch(() => ({ configured: false, model: "" })),
      ]);
      setChannels(chs);
      setUsers(us);
      setAiConfigured(cfg.configured);
      if (chs.length) setChannelId(chs[0].id);
    })();
  }, []);

  async function onSuggestTitles() {
    setAiError(null);
    if (!description.trim() && !title.trim()) {
      setAiError("AIに渡すトピックがありません。タイトル案または説明を入力してください。");
      return;
    }
    setAiLoading(true);
    try {
      const titles = await suggestTitles({
        topic: description.trim() || title.trim(),
        current_title: title,
      });
      setTitleSuggestions(titles);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAiError(detail ?? "AI提案に失敗しました。");
    } finally {
      setAiLoading(false);
    }
  }

  function toggleApprover(id: number) {
    setApproverIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title || !scheduledAt) {
      setError("タイトルと公開予定日時は必須です。");
      return;
    }
    setSubmitting(true);
    try {
      const plan = await createPlan({
        title,
        description,
        thumbnail_url: thumbnailUrl,
        channel: channelId === "" ? null : Number(channelId),
        planned_publish_at: new Date(scheduledAt).toISOString(),
        approver_ids: approverIds,
      });
      navigate(`/app/calendar/${plan.id}`);
    } catch {
      setError("プランの作成に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>新規リリースプラン</h1>
      <form onSubmit={onSubmit} className="stacked-form">
        {error && <p className="error">{error}</p>}
        <label>
          タイトル *
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="chip"
              onClick={onSuggestTitles}
              disabled={!aiConfigured || aiLoading}
              title={aiConfigured ? "" : "ANTHROPIC_API_KEY 未設定"}
            >
              {aiLoading ? "AI生成中..." : "🤖 AIでタイトル案を5つ生成"}
            </button>
            {aiError && <span className="error" style={{ padding: "0.2rem 0.5rem" }}>{aiError}</span>}
          </div>
          {titleSuggestions.length > 0 && (
            <ul style={{ margin: "0.6rem 0 0", padding: "0.6rem 1rem", background: "var(--surface-alt)", borderRadius: 6, listStyle: "none" }}>
              {titleSuggestions.map((t) => (
                <li key={t} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", padding: "0.25rem 0" }}>
                  <span>{t}</span>
                  <button type="button" className="link-button" onClick={() => setTitle(t)}>
                    使う
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        <label>
          説明
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          チャンネル
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">未指定</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          サムネイルURL（任意）
          <input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} />
        </label>
        <label>
          公開予定日時 *
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
        </label>
        <div>
          <div style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.3rem" }}>
            承認者（順番に通知されます）
          </div>
          {users.length === 0 ? (
            <p className="muted">テナント内にユーザーがいません。</p>
          ) : (
            <div className="approver-list">
              {users.map((u) => (
                <label key={u.id} className="approver-row">
                  <input
                    type="checkbox"
                    checked={approverIds.includes(u.id)}
                    onChange={() => toggleApprover(u.id)}
                  />
                  <span>
                    {u.email}
                    {approverIds.includes(u.id) && (
                      <span className="muted">
                        {" "}
                        (#{approverIds.indexOf(u.id) + 1})
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? "作成中..." : "プランを作成（下書き）"}
        </button>
      </form>
    </div>
  );
}
