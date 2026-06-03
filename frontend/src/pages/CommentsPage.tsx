import { useCallback, useEffect, useMemo, useState } from "react";
import { listChannels, type Channel } from "../api/channels";
import {
  bulkDeleteComments,
  bulkUpdateComments,
  downloadCommentsCsv,
  fetchCommentSummary,
  listComments,
  TAG_COLORS,
  TAG_LABELS,
  updateComment,
  type Comment,
  type CommentFilters,
  type CommentSummary,
  type CommentTag,
} from "../api/comments";
import { AiToolbox } from "../components/AiToolbox";
import { ReplyDrafts } from "../components/ReplyDrafts";
import { getAIConfig } from "../api/ai";
import { useColumnVisibility } from "../utils/columns";
import { useSelection } from "../utils/selection";

const TAG_ORDER: CommentTag[] = ["untagged", "good", "question", "complaint", "spam", "other"];

const ALL_COLUMNS: { key: string; label: string }[] = [
  { key: "pin", label: "ピン" },
  { key: "author", label: "投稿者" },
  { key: "text", label: "本文" },
  { key: "video", label: "動画" },
  { key: "likes", label: "いいね" },
  { key: "tag", label: "タグ" },
  { key: "handled", label: "対応" },
  { key: "reply", label: "AI返信案" },
  { key: "note", label: "内部メモ" },
];

export function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [summary, setSummary] = useState<CommentSummary | null>(null);
  const [filterTag, setFilterTag] = useState<CommentTag | "">("");
  const [filterHandled, setFilterHandled] = useState<"" | "true" | "false">("");
  const [filterPinned, setFilterPinned] = useState<"" | "true" | "false">("");
  const [filterChannel, setFilterChannel] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);

  useEffect(() => {
    void getAIConfig()
      .then((cfg) => setAiConfigured(cfg.configured))
      .catch(() => setAiConfigured(false));
  }, []);

  const selection = useSelection<number>();
  const columns = useColumnVisibility(
    "comments",
    ALL_COLUMNS.map((c) => c.key)
  );

  const filters: CommentFilters = useMemo(
    () => ({
      tag: filterTag || undefined,
      handled: filterHandled === "" ? undefined : filterHandled === "true",
      pinned: filterPinned === "" ? undefined : filterPinned === "true",
      channel: filterChannel === "" ? undefined : Number(filterChannel),
      q: search || undefined,
    }),
    [filterTag, filterHandled, filterPinned, filterChannel, search]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, chs, sum] = await Promise.all([
        listComments(filters),
        listChannels(),
        fetchCommentSummary(),
      ]);
      setComments(list.results);
      setChannels(chs);
      setSummary(sum);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const allIds = useMemo(() => comments.map((c) => c.id), [comments]);

  async function onTagChange(id: number, tag: CommentTag) {
    const updated = await updateComment(id, { tag });
    setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
    setSummary(await fetchCommentSummary());
  }
  async function onToggleHandled(id: number, isHandled: boolean) {
    const updated = await updateComment(id, { is_handled: isHandled });
    setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
    setSummary(await fetchCommentSummary());
  }
  async function onTogglePinned(id: number, isPinned: boolean) {
    const updated = await updateComment(id, { is_pinned: isPinned });
    setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
    setSummary(await fetchCommentSummary());
  }
  async function onNoteBlur(id: number, note: string) {
    await updateComment(id, { internal_note: note });
  }

  async function applyBulkTag(tag: CommentTag) {
    const ids = Array.from(selection.selected);
    if (!ids.length) return;
    await bulkUpdateComments(ids, { tag });
    selection.clear();
    await reload();
  }
  async function applyBulkHandled(handled: boolean) {
    const ids = Array.from(selection.selected);
    if (!ids.length) return;
    await bulkUpdateComments(ids, { is_handled: handled });
    selection.clear();
    await reload();
  }
  async function applyBulkPinned(pinned: boolean) {
    const ids = Array.from(selection.selected);
    if (!ids.length) return;
    await bulkUpdateComments(ids, { is_pinned: pinned });
    selection.clear();
    await reload();
  }
  async function applyBulkDelete() {
    const ids = Array.from(selection.selected);
    if (!ids.length) return;
    if (!confirm(`選択中の${ids.length}件のコメントを削除しますか？`)) return;
    await bulkDeleteComments(ids);
    selection.clear();
    await reload();
  }

  const tagCountMap = useMemo(() => {
    const map = new Map<CommentTag, number>();
    summary?.by_tag.forEach((b) => map.set(b.tag, b.count));
    return map;
  }, [summary]);

  return (
    <div>
      <h1>コメント管理</h1>
      <p className="muted">
        複数選択して一括操作、★でピン留め、CSVエクスポート、列の表示切替に対応しています。
      </p>

      {summary && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">総コメント数</div>
            <div className="kpi-value">{summary.total.toLocaleString()}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">未対応</div>
            <div className="kpi-value" style={{ color: "var(--danger)" }}>
              {summary.unhandled.toLocaleString()}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">対応済み</div>
            <div className="kpi-value" style={{ color: "var(--success)" }}>
              {summary.handled.toLocaleString()}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">ピン留め</div>
            <div className="kpi-value">{summary.pinned.toLocaleString()}</div>
          </div>
          {TAG_ORDER.filter((t) => t !== "untagged").map((t) => (
            <div key={t} className="kpi-card">
              <div className="kpi-label" style={{ color: TAG_COLORS[t] }}>
                {TAG_LABELS[t]}
              </div>
              <div className="kpi-value">{tagCountMap.get(t) ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      <AiToolbox filters={filters} onTagsApplied={() => void reload()} />

      <div className="range-bar">
        <select value={filterTag} onChange={(e) => setFilterTag(e.target.value as CommentTag | "")}>
          <option value="">すべてのタグ</option>
          {TAG_ORDER.map((t) => (
            <option key={t} value={t}>
              {TAG_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={filterHandled}
          onChange={(e) => setFilterHandled(e.target.value as typeof filterHandled)}
        >
          <option value="">対応：すべて</option>
          <option value="false">未対応</option>
          <option value="true">対応済</option>
        </select>
        <select
          value={filterPinned}
          onChange={(e) => setFilterPinned(e.target.value as typeof filterPinned)}
        >
          <option value="">ピン：すべて</option>
          <option value="true">ピン留めのみ</option>
        </select>
        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">すべてのチャンネル</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="本文・投稿者で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <div style={{ position: "relative" }}>
          <button className="chip" onClick={() => setColumnsOpen((v) => !v)}>
            列 ⌄
          </button>
          {columnsOpen && (
            <div className="column-menu">
              {ALL_COLUMNS.map((c) => (
                <label key={c.key}>
                  <input
                    type="checkbox"
                    checked={columns.isVisible(c.key)}
                    onChange={() => columns.toggle(c.key)}
                  />
                  {c.label}
                </label>
              ))}
              <button className="link-button" onClick={columns.reset}>
                リセット
              </button>
            </div>
          )}
        </div>
        <button
          className="chip"
          onClick={() => void downloadCommentsCsv(filters)}
          title="現在のフィルタを反映したCSVをダウンロード"
        >
          CSVエクスポート
        </button>
      </div>

      {selection.count > 0 && (
        <div className="bulk-toolbar">
          <span>
            <strong>{selection.count}</strong>件を選択中
          </span>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) void applyBulkTag(e.target.value as CommentTag);
              e.target.value = "";
            }}
          >
            <option value="">タグを変更...</option>
            {TAG_ORDER.map((t) => (
              <option key={t} value={t}>
                {TAG_LABELS[t]}
              </option>
            ))}
          </select>
          <button className="chip" onClick={() => applyBulkHandled(true)}>
            対応済にする
          </button>
          <button className="chip" onClick={() => applyBulkHandled(false)}>
            未対応に戻す
          </button>
          <button className="chip" onClick={() => applyBulkPinned(true)}>
            ★ ピン留め
          </button>
          <button className="chip" onClick={() => applyBulkPinned(false)}>
            ピン解除
          </button>
          <button
            className="chip"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            onClick={applyBulkDelete}
          >
            削除
          </button>
          <button className="link-button" onClick={selection.clear}>
            選択解除
          </button>
        </div>
      )}

      {loading ? (
        <p>読み込み中...</p>
      ) : comments.length === 0 ? (
        <p className="muted">該当するコメントがありません。</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={selection.allSelected(allIds)}
                    onChange={() => selection.toggleAll(allIds)}
                  />
                </th>
                {columns.isVisible("pin") && <th style={{ width: 36 }}>★</th>}
                {columns.isVisible("author") && <th>投稿者</th>}
                {columns.isVisible("text") && <th>本文</th>}
                {columns.isVisible("video") && <th>動画</th>}
                {columns.isVisible("likes") && <th>いいね</th>}
                {columns.isVisible("tag") && <th>タグ</th>}
                {columns.isVisible("handled") && <th>対応</th>}
                {columns.isVisible("reply") && <th>返信案</th>}
                {columns.isVisible("note") && <th>内部メモ</th>}
              </tr>
            </thead>
            <tbody>
              {comments.map((c) => (
                <tr
                  key={c.id}
                  className={
                    (c.is_handled ? "handled-row " : "") + (c.is_pinned ? "pinned-row" : "")
                  }
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selection.isSelected(c.id)}
                      onChange={(e) => {
                        const ev = e.nativeEvent as MouseEvent | undefined;
                        selection.toggle(c.id, allIds, ev?.shiftKey);
                      }}
                    />
                  </td>
                  {columns.isVisible("pin") && (
                    <td>
                      <button
                        className="link-button pin-button"
                        onClick={() => onTogglePinned(c.id, !c.is_pinned)}
                        title={c.is_pinned ? "ピンを外す" : "ピン留め"}
                      >
                        {c.is_pinned ? "★" : "☆"}
                      </button>
                    </td>
                  )}
                  {columns.isVisible("author") && <td>{c.author_name}</td>}
                  {columns.isVisible("text") && (
                    <td style={{ maxWidth: 360, whiteSpace: "pre-wrap" }}>{c.text}</td>
                  )}
                  {columns.isVisible("video") && <td className="muted">{c.video_title}</td>}
                  {columns.isVisible("likes") && <td>{c.likes}</td>}
                  {columns.isVisible("tag") && (
                    <td>
                      <select
                        value={c.tag}
                        onChange={(e) => onTagChange(c.id, e.target.value as CommentTag)}
                        style={{
                          borderLeft: `4px solid ${TAG_COLORS[c.tag]}`,
                          fontSize: "0.85rem",
                        }}
                      >
                        {TAG_ORDER.map((t) => (
                          <option key={t} value={t}>
                            {TAG_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  {columns.isVisible("handled") && (
                    <td>
                      <input
                        type="checkbox"
                        checked={c.is_handled}
                        onChange={(e) => onToggleHandled(c.id, e.target.checked)}
                      />
                    </td>
                  )}
                  {columns.isVisible("reply") && (
                    <td style={{ minWidth: 200 }}>
                      <ReplyDrafts commentId={c.id} enabled={aiConfigured} />
                    </td>
                  )}
                  {columns.isVisible("note") && (
                    <td>
                      <input
                        defaultValue={c.internal_note}
                        onBlur={(e) => onNoteBlur(c.id, e.target.value)}
                        placeholder="メモ"
                        style={{ width: 160 }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
