import { type FormEvent, useEffect, useState } from "react";
import { listChannels, type Channel } from "../api/channels";
import { listCompetitors, type Competitor } from "../api/competitors";
import { createImport, listImports, type ImportJob } from "../api/imports";

const SOURCE_OPTIONS = [
  { value: "video", label: "動画一覧", target: "channel" as const },
  { value: "video_daily", label: "動画 × 日次（YouTube Studio）", target: "channel" as const },
  { value: "channel_daily", label: "チャンネル × 日次", target: "channel" as const },
  { value: "competitor_daily", label: "競合チャンネル × 日次", target: "competitor" as const },
  { value: "comments", label: "コメント一覧", target: "channel" as const },
];

export function ImportsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [channelId, setChannelId] = useState<number | "">("");
  const [competitorId, setCompetitorId] = useState<number | "">("");
  const [sourceType, setSourceType] = useState("video_daily");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sourceMeta = SOURCE_OPTIONS.find((o) => o.value === sourceType);

  async function reload() {
    const [cs, cps, js] = await Promise.all([listChannels(), listCompetitors(), listImports()]);
    setChannels(cs);
    setCompetitors(cps);
    setJobs(js);
    if (cs.length && channelId === "") setChannelId(cs[0].id);
    if (cps.length && competitorId === "") setCompetitorId(cps[0].id);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("CSVファイルを選択してください。");
      return;
    }
    if (sourceMeta?.target === "competitor" && competitorId === "") {
      setError("競合チャンネルを選択してください。");
      return;
    }
    if (sourceMeta?.target === "channel" && channelId === "") {
      setError("チャンネルを選択してください。");
      return;
    }
    setSubmitting(true);
    try {
      const payload: { source_type: string; file: File; channel?: number; competitor?: number } = {
        source_type: sourceType,
        file,
      };
      if (sourceMeta?.target === "channel") payload.channel = Number(channelId);
      if (sourceMeta?.target === "competitor") payload.competitor = Number(competitorId);
      await createImport(payload);
      setFile(null);
      (e.target as HTMLFormElement).reset();
      await reload();
    } catch {
      setError("インポートに失敗しました。CSVの形式をご確認ください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>CSVインポート</h1>
      <p className="muted">
        YouTube Studio「アナリティクス」→ 詳細データ → エクスポートしたCSVをアップロードします。
      </p>

      <form onSubmit={onSubmit} className="stacked-form">
        {error && <p className="error">{error}</p>}
        <label>
          データの種類
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {sourceMeta?.target === "channel" && (
          <label>
            チャンネル
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">選択してください</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {sourceMeta?.target === "competitor" && (
          <label>
            競合チャンネル
            <select
              value={competitorId}
              onChange={(e) => setCompetitorId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">選択してください</option>
              {competitors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          CSVファイル
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "アップロード中..." : "アップロード"}
        </button>
      </form>

      <h2>履歴</h2>
      {jobs.length === 0 ? (
        <p>履歴はまだありません。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>日時</th>
              <th>種別</th>
              <th>状態</th>
              <th>取り込み</th>
              <th>スキップ</th>
              <th>エラー</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{new Date(j.created_at).toLocaleString()}</td>
                <td>{j.source_type}</td>
                <td>{j.status}</td>
                <td>{j.rows_imported}</td>
                <td>{j.rows_skipped}</td>
                <td className="error-cell">{j.error_message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
