import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  bulkCancelPlans,
  bulkSubmitPlans,
  listPlans,
  STATUS_COLORS,
  STATUS_LABELS,
  type ContentPlan,
} from "../api/content";
import { useSelection } from "../utils/selection";
import { downloadAuthenticatedCsv } from "../utils/download";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarPage() {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const selection = useSelection<number>();

  const monthStart = monthCursor;
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor]);
  // Calendar grid spans full weeks
  const gridStart = useMemo(() => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [monthStart]);
  const gridEnd = useMemo(() => {
    const d = new Date(monthEnd);
    d.setDate(d.getDate() + (6 - d.getDay()));
    return d;
  }, [monthEnd]);

  const days: Date[] = useMemo(() => {
    const result: Date[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [gridStart, gridEnd]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPlans({ from: isoDate(gridStart), to: isoDate(gridEnd) });
      setPlans(res);
    } finally {
      setLoading(false);
    }
  }, [gridStart, gridEnd]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const plansByDay = useMemo(() => {
    const map = new Map<string, ContentPlan[]>();
    for (const p of plans) {
      const key = isoDate(new Date(p.planned_publish_at));
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [plans]);

  const today = new Date();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div>
      <h1>リリースカレンダー</h1>

      <div className="range-bar">
        <button className="chip" onClick={() => setMonthCursor(addMonths(monthCursor, -1))}>
          ← 前の月
        </button>
        <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>
          {monthCursor.getFullYear()}年{monthCursor.getMonth() + 1}月
        </span>
        <button className="chip" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
          次の月 →
        </button>
        <button className="chip" onClick={() => setMonthCursor(startOfMonth(new Date()))}>
          今月
        </button>
        <Link to="/app/calendar/new" className="primary-right">
          <button>新規プラン</button>
        </Link>
      </div>

      {loading ? <p>読み込み中...</p> : null}

      <div className="calendar-grid">
        {weekdays.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = d.getMonth() === monthCursor.getMonth();
          const isToday = sameDay(d, today);
          const dayPlans = plansByDay.get(isoDate(d)) ?? [];
          return (
            <div
              key={d.toISOString()}
              className={`calendar-cell${inMonth ? "" : " out"}${isToday ? " today" : ""}`}
            >
              <div className="calendar-date">{d.getDate()}</div>
              {dayPlans.map((p) => (
                <Link
                  key={p.id}
                  to={`/app/calendar/${p.id}`}
                  className="calendar-event"
                  style={{ background: STATUS_COLORS[p.status] }}
                  title={`${STATUS_LABELS[p.status]} - ${p.title}`}
                >
                  {p.title}
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <h2 style={{ marginTop: "2rem", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        今月のリリース予定（{plans.length}件）
        <button
          className="chip"
          style={{ fontWeight: 400 }}
          onClick={() =>
            downloadAuthenticatedCsv(
              "/content/plans/export/",
              `plans_${new Date().toISOString().slice(0, 10)}.csv`
            )
          }
        >
          CSVエクスポート
        </button>
      </h2>

      {selection.count > 0 && (
        <div className="bulk-toolbar">
          <span>
            <strong>{selection.count}</strong>件を選択中
          </span>
          <button
            className="chip"
            onClick={async () => {
              const res = await bulkSubmitPlans(Array.from(selection.selected));
              alert(`${res.submitted}件をレビューに進めました。`);
              selection.clear();
              await reload();
            }}
          >
            一括レビュー依頼
          </button>
          <button
            className="chip"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            onClick={async () => {
              if (!confirm(`${selection.count}件をキャンセルしますか？`)) return;
              const res = await bulkCancelPlans(Array.from(selection.selected));
              alert(`${res.cancelled}件をキャンセルしました。`);
              selection.clear();
              await reload();
            }}
          >
            一括キャンセル
          </button>
          <button className="link-button" onClick={selection.clear}>
            選択解除
          </button>
        </div>
      )}

      {plans.length === 0 ? (
        <p className="muted">予定はまだありません。</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={selection.allSelected(plans.map((p) => p.id))}
                    onChange={() => selection.toggleAll(plans.map((p) => p.id))}
                  />
                </th>
                <th>公開予定日時</th>
                <th>タイトル</th>
                <th>状態</th>
                <th>承認</th>
              </tr>
            </thead>
            <tbody>
              {plans
                .slice()
                .sort((a, b) => a.planned_publish_at.localeCompare(b.planned_publish_at))
                .map((p) => {
                  const allIds = plans.map((x) => x.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selection.isSelected(p.id)}
                          onChange={(e) => {
                            const ev = e.nativeEvent as MouseEvent | undefined;
                            selection.toggle(p.id, allIds, ev?.shiftKey);
                          }}
                        />
                      </td>
                      <td>{new Date(p.planned_publish_at).toLocaleString()}</td>
                      <td>
                        <Link to={`/app/calendar/${p.id}`}>{p.title}</Link>
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ background: STATUS_COLORS[p.status] }}
                        >
                          {STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td>{p.approvals.map((a) => a.status).join(" / ") || "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
