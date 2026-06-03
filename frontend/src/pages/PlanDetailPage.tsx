import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  addComment,
  cancelPlan,
  decidePlan,
  getPlan,
  publishPlan,
  STATUS_COLORS,
  STATUS_LABELS,
  submitPlan,
  type ContentPlan,
} from "../api/content";

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [decisionComment, setDecisionComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!id) return;
    try {
      setPlan(await getPlan(Number(id)));
    } catch {
      setError("プランの取得に失敗しました。");
    }
  }

  useEffect(() => {
    void reload();
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!plan) return <p>読み込み中...</p>;

  const myApproval = plan.approvals.find((a) => a.approver === user?.id);
  const canSubmit = plan.status === "draft" || plan.status === "rejected";
  const canDecide = plan.status === "in_review" && myApproval && myApproval.status === "pending";
  const canPublish = plan.status === "approved";
  const canCancel = plan.status !== "published" && plan.status !== "cancelled";

  async function onSubmit() {
    if (!plan) return;
    setPlan(await submitPlan(plan.id));
  }
  async function onDecide(decision: "approve" | "reject") {
    if (!plan) return;
    setPlan(await decidePlan(plan.id, decision, decisionComment));
    setDecisionComment("");
  }
  async function onPublish() {
    if (!plan) return;
    setPlan(await publishPlan(plan.id));
  }
  async function onCancel() {
    if (!plan) return;
    if (!confirm("このプランをキャンセルしますか？")) return;
    setPlan(await cancelPlan(plan.id));
  }
  async function onAddComment(e: FormEvent) {
    e.preventDefault();
    if (!plan || !commentBody.trim()) return;
    await addComment(plan.id, commentBody);
    setCommentBody("");
    await reload();
  }

  return (
    <div>
      <button className="link-button" onClick={() => navigate("/app/calendar")}>
        ← カレンダーに戻る
      </button>
      <h1>{plan.title}</h1>

      <div style={{ marginBottom: "1rem" }}>
        <span className="status-badge" style={{ background: STATUS_COLORS[plan.status] }}>
          {STATUS_LABELS[plan.status]}
        </span>
        <span className="muted" style={{ marginLeft: "0.75rem" }}>
          公開予定: {new Date(plan.planned_publish_at).toLocaleString()}
        </span>
      </div>

      {plan.description && (
        <>
          <h2>説明</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{plan.description}</p>
        </>
      )}
      {plan.thumbnail_url && (
        <p>
          <a href={plan.thumbnail_url} target="_blank" rel="noreferrer">
            サムネイルを表示
          </a>
        </p>
      )}

      <h2>承認フロー</h2>
      {plan.approvals.length === 0 ? (
        <p className="muted">承認者が設定されていません。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>順番</th>
              <th>承認者</th>
              <th>状態</th>
              <th>コメント</th>
              <th>判定日時</th>
            </tr>
          </thead>
          <tbody>
            {plan.approvals.map((a) => (
              <tr key={a.id}>
                <td>{a.order + 1}</td>
                <td>{a.approver_detail?.email}</td>
                <td>{STATUS_LABELS[a.status === "pending" ? "in_review" : a.status === "approved" ? "approved" : "rejected"]}</td>
                <td>{a.comment || "—"}</td>
                <td>{a.decided_at ? new Date(a.decided_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {canSubmit && <button onClick={onSubmit}>レビューに進める</button>}
        {canDecide && (
          <>
            <input
              placeholder="コメント（任意）"
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <button style={{ background: "#16a34a" }} onClick={() => onDecide("approve")}>
              承認する
            </button>
            <button style={{ background: "#dc2626" }} onClick={() => onDecide("reject")}>
              差し戻し
            </button>
          </>
        )}
        {canPublish && <button onClick={onPublish}>公開済みにする</button>}
        {canCancel && (
          <button className="link-button" onClick={onCancel}>
            キャンセル
          </button>
        )}
      </div>

      <h2>コメント</h2>
      {plan.comments.length === 0 ? (
        <p className="muted">まだコメントはありません。</p>
      ) : (
        <ul className="comment-list">
          {plan.comments.map((c) => (
            <li key={c.id}>
              <div className="comment-meta">
                <strong>{c.author_detail?.email ?? "—"}</strong>
                <span className="muted">{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAddComment} className="stacked-form" style={{ marginTop: "1rem" }}>
        <textarea
          rows={3}
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="コメントを追加..."
        />
        <button type="submit" disabled={!commentBody.trim()}>
          コメント投稿
        </button>
      </form>
    </div>
  );
}
