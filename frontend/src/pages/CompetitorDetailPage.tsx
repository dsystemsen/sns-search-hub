import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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
import { fetchCompetitorDashboard, type CompetitorDashboard } from "../api/competitors";

type Preset = 30 | 90 | 180 | 365;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function rangeFromPreset(days: Preset) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: isoDate(start), end: isoDate(end) };
}

export function CompetitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const competitorId = Number(id);
  const [preset, setPreset] = useState<Preset>(90);
  const [data, setData] = useState<CompetitorDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => rangeFromPreset(preset), [preset]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchCompetitorDashboard(competitorId, range.start, range.end));
    } catch {
      setError("ダッシュボードの取得に失敗しました。");
    }
  }, [competitorId, range.start, range.end]);

  useEffect(() => {
    if (Number.isFinite(competitorId)) void load();
  }, [competitorId, load]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>読み込み中...</p>;

  return (
    <div>
      <h1>{data.competitor_name}</h1>
      <div className="range-bar">
        <span className="muted">期間:</span>
        {([30, 90, 180, 365] as Preset[]).map((d) => (
          <button
            key={d}
            className={preset === d ? "chip active" : "chip"}
            onClick={() => setPreset(d)}
          >
            過去{d}日
          </button>
        ))}
        <span className="muted">
          {data.period.start} 〜 {data.period.end}
        </span>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">登録者数（最新）</div>
          <div className="kpi-value">{data.latest?.subscribers_total?.toLocaleString() ?? "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">登録者増加（期間内）</div>
          <div className="kpi-value">+{data.growth.subscribers.toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">累計視聴回数（最新）</div>
          <div className="kpi-value">{data.latest?.views_total?.toLocaleString() ?? "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">公開動画数（最新）</div>
          <div className="kpi-value">{data.latest?.videos_total?.toLocaleString() ?? "—"}</div>
        </div>
      </div>

      <h2>登録者数の推移</h2>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.daily} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="subscribers_total"
              name="登録者総数"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h2>スナップショット一覧</h2>
      {data.daily.length === 0 ? (
        <p className="muted">
          データがありません。CSVインポート画面から「競合チャンネル × 日次」をアップロードしてください。
        </p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>登録者数</th>
              <th>登録者増減</th>
              <th>累計視聴</th>
              <th>視聴増減</th>
              <th>動画数</th>
              <th>動画増減</th>
            </tr>
          </thead>
          <tbody>
            {data.daily.map((r) => (
              <tr key={r.date}>
                <td>{r.date}</td>
                <td>{r.subscribers_total.toLocaleString()}</td>
                <td>{r.subscribers_delta > 0 ? `+${r.subscribers_delta}` : r.subscribers_delta}</td>
                <td>{r.views_total.toLocaleString()}</td>
                <td>{r.views_delta > 0 ? `+${r.views_delta.toLocaleString()}` : r.views_delta.toLocaleString()}</td>
                <td>{r.videos_total}</td>
                <td>{r.videos_delta > 0 ? `+${r.videos_delta}` : r.videos_delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
