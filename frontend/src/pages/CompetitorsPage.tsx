import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { listChannels, type Channel } from "../api/channels";
import {
  createCompetitor,
  deleteCompetitor,
  fetchCompetitorCompare,
  listCompetitors,
  type Competitor,
  type CompetitorCompare,
} from "../api/competitors";
import { getYouTubeConfig, syncCompetitor } from "../api/youtube";
import { downloadAuthenticatedCsv } from "../utils/download";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#dc2626", "#84cc16"];

type ChartRow = { date: string } & Record<string, number | string>;

function mergeSeries(compare: CompetitorCompare): ChartRow[] {
  const map = new Map<string, ChartRow>();
  const push = (key: string, points: { date: string; subscribers: number }[]) => {
    for (const p of points) {
      const row = map.get(p.date) ?? { date: p.date };
      row[key] = p.subscribers;
      map.set(p.date, row);
    }
  };
  if (compare.own) push("自社", compare.own.points);
  for (const c of compare.competitors) push(c.name, c.points);
  return Array.from(map.values()).sort((a, b) =>
    String(a.date) < String(b.date) ? -1 : 1
  );
}

export function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [compareChannelId, setCompareChannelId] = useState<number | "">("");
  const [compare, setCompare] = useState<CompetitorCompare | null>(null);
  const [loading, setLoading] = useState(true);
  const [ytConfigured, setYtConfigured] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, chs, cfg] = await Promise.all([
        listCompetitors(),
        listChannels(),
        getYouTubeConfig().catch(() => ({ configured: false })),
      ]);
      setCompetitors(cs);
      setChannels(chs);
      setYtConfigured(cfg.configured);
      if (compareChannelId === "" && chs.length > 0) setCompareChannelId(chs[0].id);
    } finally {
      setLoading(false);
    }
  }, [compareChannelId]);

  async function onSync(id: number) {
    setSyncingId(id);
    setSyncMessage(null);
    try {
      const res = await syncCompetitor(id);
      setSyncMessage(
        `${res.name}: 登録者 ${res.subscribers.toLocaleString()} / 動画 ${res.videos} / 累計 ${res.views.toLocaleString()} を取得`
      );
      await reload();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSyncMessage(detail ?? "同期に失敗しました。");
    } finally {
      setSyncingId(null);
    }
  }

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadCompare = useCallback(async () => {
    const data = await fetchCompetitorCompare(
      compareChannelId === "" ? undefined : Number(compareChannelId)
    );
    setCompare(data);
  }, [compareChannelId]);

  useEffect(() => {
    if (competitors.length === 0) {
      setCompare(null);
      return;
    }
    void loadCompare();
  }, [competitors, loadCompare]);

  const chartData = useMemo(() => (compare ? mergeSeries(compare) : []), [compare]);
  const seriesKeys = useMemo(() => {
    if (!compare) return [] as string[];
    const keys: string[] = [];
    if (compare.own) keys.push("自社");
    for (const c of compare.competitors) keys.push(c.name);
    return keys;
  }, [compare]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createCompetitor({ name, handle });
    setName("");
    setHandle("");
    await reload();
  }

  async function onDelete(id: number) {
    if (!confirm("この競合チャンネルを削除しますか？")) return;
    await deleteCompetitor(id);
    await reload();
  }

  return (
    <div>
      <h1>競合チャンネル分析</h1>
      <p className="muted">
        登録した競合チャンネルの公開数値スナップショットをCSVでアップロードし、自社との成長を比較します。
      </p>

      {!ytConfigured && (
        <div
          style={{
            background: "#fef3c7",
            color: "#92400e",
            padding: "0.75rem 1rem",
            borderRadius: 6,
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          YouTube Data APIキーが未設定です。<code>backend/.env</code> の{" "}
          <code>YOUTUBE_API_KEY</code> を設定すると、競合チャンネルの統計を自動取得できます。
        </div>
      )}
      {syncMessage && (
        <div
          style={{
            background: "#ecfdf5",
            color: "#065f46",
            padding: "0.6rem 1rem",
            borderRadius: 6,
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          {syncMessage}
        </div>
      )}

      <h2>
        競合チャンネル一覧{" "}
        <button
          className="chip"
          style={{ marginLeft: "0.5rem", fontWeight: 400 }}
          onClick={() =>
            downloadAuthenticatedCsv(
              "/analytics/competitors/export/",
              `competitors_${new Date().toISOString().slice(0, 10)}.csv`
            )
          }
        >
          CSVエクスポート
        </button>
      </h2>
      <form onSubmit={onSubmit} className="inline-form">
        <input
          placeholder="競合チャンネル名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          placeholder="ハンドル（@example）"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
        <button type="submit">追加</button>
      </form>

      {loading ? (
        <p>読み込み中...</p>
      ) : competitors.length === 0 ? (
        <p className="muted">まだ競合チャンネルが登録されていません。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>名前</th>
              <th>ハンドル</th>
              <th>登録日</th>
              <th></th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {competitors.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.handle}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  <Link to={`/app/competitors/${c.id}`}>詳細</Link>
                </td>
                <td>
                  <button
                    className="link-button"
                    onClick={() => onSync(c.id)}
                    disabled={!ytConfigured || syncingId === c.id}
                    title={ytConfigured ? "" : "YOUTUBE_API_KEYを設定してください"}
                  >
                    {syncingId === c.id ? "取得中..." : "APIから更新"}
                  </button>
                </td>
                <td>
                  <button className="link-button" onClick={() => onDelete(c.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {competitors.length > 0 && (
        <>
          <h2>登録者数の比較</h2>
          <div className="range-bar">
            <span className="muted">比較対象の自社チャンネル:</span>
            <select
              value={compareChannelId}
              onChange={(e) =>
                setCompareChannelId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">（自社は表示しない）</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {chartData.length === 0 ? (
            <p className="muted">
              CSVを <Link to="/app/imports">CSVインポート</Link> から
              「競合チャンネル × 日次」種別でアップロードすると比較できます。
            </p>
          ) : (
            <div className="chart-card">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {seriesKeys.map((k, i) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={k === "自社" ? 3 : 2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
