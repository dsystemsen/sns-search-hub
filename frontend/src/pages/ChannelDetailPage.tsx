import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchChannelBreakdown, fetchDashboard, type DashboardData, type DateBreakdown } from "../api/channels";
import { createReport, listReports, type Report } from "../api/reports";
import { getYouTubeConfig, syncVideoComments } from "../api/youtube";
import { downloadAuthenticatedCsv } from "../utils/download";

type RangePreset = 7 | 30 | 90;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeFromPreset(days: RangePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: isoDate(start), end: isoDate(end) };
}

export function ChannelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const channelId = Number(id);
  const [preset, setPreset] = useState<RangePreset>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [generating, setGenerating] = useState(false);
  const [ytConfigured, setYtConfigured] = useState(false);
  const [syncVideoId, setSyncVideoId] = useState<number | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [drillDate, setDrillDate] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<DateBreakdown | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const range = useMemo(() => rangeFromPreset(preset), [preset]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, rs, cfg] = await Promise.all([
        fetchDashboard(channelId, range.start, range.end),
        listReports(),
        getYouTubeConfig().catch(() => ({ configured: false })),
      ]);
      setData(d);
      setReports(rs.filter((r) => r.channel === channelId));
      setYtConfigured(cfg.configured);
    } catch {
      setError("ダッシュボードの取得に失敗しました。");
    }
  }, [channelId, range.start, range.end]);

  async function onChartClick(e: { activeLabel?: string | number } | undefined) {
    if (!e?.activeLabel) return;
    const date = String(e.activeLabel);
    setDrillDate(date);
    setDrillLoading(true);
    try {
      setDrillData(await fetchChannelBreakdown(channelId, date));
    } finally {
      setDrillLoading(false);
    }
  }

  async function onSyncComments(videoId: number) {
    setSyncVideoId(videoId);
    setSyncResult(null);
    try {
      const res = await syncVideoComments(videoId);
      setSyncResult(`取得 ${res.fetched} 件（新規 ${res.created} / 更新 ${res.updated}）`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSyncResult(detail ?? "取得に失敗しました。");
    } finally {
      setSyncVideoId(null);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(channelId)) return;
    void load();
  }, [channelId, load]);

  async function onGenerateReport() {
    setGenerating(true);
    try {
      await createReport({
        channel: channelId,
        period_start: range.start,
        period_end: range.end,
      });
      const rs = await listReports();
      setReports(rs.filter((r) => r.channel === channelId));
    } finally {
      setGenerating(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>読み込み中...</p>;

  const hasData = data.daily.length > 0 || data.top_videos.length > 0;

  const totalsList: Array<[string, string]> = [
    ["再生回数", data.totals.views?.toLocaleString() ?? "0"],
    ["視聴時間 (分)", Math.round(data.totals.watch_time_minutes ?? 0).toLocaleString()],
    ["高評価", data.totals.likes?.toLocaleString() ?? "0"],
    ["コメント", data.totals.comments?.toLocaleString() ?? "0"],
    ["共有", data.totals.shares?.toLocaleString() ?? "0"],
    ["推定収益 (USD)", (data.totals.estimated_revenue_usd ?? 0).toFixed(2)],
  ];

  return (
    <div>
      <h1>{data.channel_name}</h1>

      <div className="range-bar">
        <span className="muted">期間:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            className={preset === d ? "chip active" : "chip"}
            onClick={() => setPreset(d as RangePreset)}
          >
            過去{d}日
          </button>
        ))}
        <span className="muted">
          {data.period.start} 〜 {data.period.end}
        </span>
        <button onClick={onGenerateReport} disabled={generating} className="primary-right">
          {generating ? "生成中..." : "Excelレポートを生成"}
        </button>
      </div>

      {!hasData && (
        <div className="empty-state">
          <h2 style={{ marginTop: 0 }}>📭 まだデータがありません</h2>
          <p>
            「{data.channel_name}」にはまだ分析データが取り込まれていないため、グラフ・ランキング・KPIは表示されません。
            <br />
            以下のいずれかの方法でデータを投入してください。
          </p>

          <h3 style={{ fontSize: "1rem" }}>方法1：CSVをアップロード（推奨）</h3>
          <ol>
            <li>
              <a href="https://studio.youtube.com/" target="_blank" rel="noreferrer">
                YouTube Studio
              </a>{" "}
              → 左メニュー「アナリティクス」→ 右上「詳細データ」
            </li>
            <li>期間を選択して右上の「↓ ダウンロード」→ CSV を保存</li>
            <li>
              <Link to="/app/imports">CSVインポート画面</Link> でこのチャンネルを選び、
              「動画 × 日次（YouTube Studio）」種別でアップロード
            </li>
            <li>
              アップロード後、この画面を再読み込みすると KPI・グラフ・動画ランキングが表示されます
            </li>
          </ol>

          <h3 style={{ fontSize: "1rem" }}>方法2：YouTube Data API で同期</h3>
          {ytConfigured ? (
            <p>
              ✓ APIキー設定済み。チャンネル詳細から動画別に「コメント取得」できますが、
              再生数・視聴時間などのアナリティクス指標は YouTube Data API では取得できないため、CSVアップロードが必要です。
            </p>
          ) : (
            <p>
              ANTHROPIC_API_KEY や YOUTUBE_API_KEY が設定されていないため、自動同期は利用できません。
              <Link to="/app/settings">設定画面</Link>でAPIキー設定方法をご確認ください。
            </p>
          )}

          <p style={{ marginTop: "1rem" }}>
            <Link to="/app/channels">
              ← チャンネル一覧に戻る
            </Link>
            {"　"}
            <Link to="/app/imports" style={{ marginLeft: "1rem" }}>
              CSVインポートへ進む →
            </Link>
          </p>
        </div>
      )}

      <div className="kpi-grid">
        {totalsList.map(([label, value]) => (
          <div key={label} className="kpi-card">
            <div className="kpi-label">{label}</div>
            <div className="kpi-value">{value}</div>
          </div>
        ))}
      </div>

      <h2>日次推移</h2>
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        グラフをクリックすると、その日の動画別パフォーマンスが表示されます。
      </p>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data.daily}
            margin={{ top: 10, right: 24, bottom: 0, left: 0 }}
            onClick={onChartClick}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="views"
              name="再生回数"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="watch_time_minutes"
              name="視聴時間(分)"
              stroke="#16a34a"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {drillDate && (
        <div className="drilldown-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>{drillDate} の動画別パフォーマンス</h3>
            <button
              className="link-button"
              onClick={() => {
                setDrillDate(null);
                setDrillData(null);
              }}
            >
              ✕ 閉じる
            </button>
          </div>
          {drillLoading ? (
            <p className="muted">取得中...</p>
          ) : !drillData || drillData.videos.length === 0 ? (
            <p className="muted">この日のデータはありません。</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>タイトル</th>
                    <th>再生</th>
                    <th>視聴時間(分)</th>
                    <th>高評価</th>
                    <th>コメント</th>
                    <th>共有</th>
                  </tr>
                </thead>
                <tbody>
                  {drillData.videos.map((v) => (
                    <tr key={v.video_id}>
                      <td>{v.title}</td>
                      <td>{v.views.toLocaleString()}</td>
                      <td>{Math.round(v.watch_time_minutes).toLocaleString()}</td>
                      <td>{v.likes.toLocaleString()}</td>
                      <td>{v.comments.toLocaleString()}</td>
                      <td>{v.shares.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <h2>エンゲージメント</h2>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={data.daily}
            margin={{ top: 10, right: 24, bottom: 0, left: 0 }}
            onClick={onChartClick}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="likes" name="高評価" fill="#f59e0b" />
            <Bar dataKey="comments" name="コメント" fill="#8b5cf6" />
            <Bar dataKey="shares" name="共有" fill="#ec4899" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h2>登録者の増減</h2>
      <ul className="kpi-inline">
        <li>
          累計: <strong>{data.subscribers.total ?? "—"}</strong>
        </li>
        <li>
          増加: <strong>{data.subscribers.gained}</strong>
        </li>
        <li>
          減少: <strong>{data.subscribers.lost}</strong>
        </li>
        <li>
          純増: <strong>{data.subscribers.net}</strong>
        </li>
      </ul>

      <h2 style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        動画ランキング（再生数順 TOP10）
        <button
          className="chip"
          style={{ fontWeight: 400 }}
          onClick={() =>
            downloadAuthenticatedCsv(
              `/analytics/channels/${channelId}/videos/export/?start=${range.start}&end=${range.end}`,
              `videos_${channelId}_${range.start}_${range.end}.csv`
            )
          }
        >
          CSVエクスポート
        </button>
      </h2>
      {syncResult && (
        <p
          style={{
            background: "#ecfdf5",
            color: "#065f46",
            padding: "0.6rem 1rem",
            borderRadius: 6,
            fontSize: "0.9rem",
          }}
        >
          {syncResult}
        </p>
      )}
      {data.top_videos.length === 0 ? (
        <p className="muted">期間内のデータがありません。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>順位</th>
              <th>タイトル</th>
              <th>再生回数</th>
              <th>視聴時間(分)</th>
              <th>高評価</th>
              <th>コメント</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.top_videos.map((v, i) => (
              <tr key={v.video_id}>
                <td>{i + 1}</td>
                <td>{v.title}</td>
                <td>{v.views.toLocaleString()}</td>
                <td>{Math.round(v.watch_time_minutes).toLocaleString()}</td>
                <td>{v.likes.toLocaleString()}</td>
                <td>{v.comments.toLocaleString()}</td>
                <td>
                  <button
                    className="link-button"
                    disabled={!ytConfigured || syncVideoId === v.video_id}
                    onClick={() => onSyncComments(v.video_id)}
                    title={ytConfigured ? "YouTube APIからコメントを取得" : "YOUTUBE_API_KEY未設定"}
                  >
                    {syncVideoId === v.video_id ? "取得中..." : "コメント取得"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>レポート</h2>
      {reports.length === 0 ? (
        <p className="muted">レポートはまだありません。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>作成日時</th>
              <th>期間</th>
              <th>状態</th>
              <th>ファイル</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  {r.period_start} 〜 {r.period_end}
                </td>
                <td>{r.status}</td>
                <td>
                  {r.file ? (
                    <a href={r.file} download>
                      ダウンロード (.xlsx)
                    </a>
                  ) : (
                    r.error_message || "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
