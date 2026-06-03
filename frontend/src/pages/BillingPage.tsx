import { useCallback, useEffect, useState } from "react";
import {
  cancelSubscription,
  fetchMySubscription,
  listPlans,
  startCheckout,
  STATUS_LABEL,
  type Plan,
  type Subscription,
} from "../api/billing";

function formatJpy(amount: number) {
  return `¥${amount.toLocaleString()}`;
}

export function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [interval, setIntervalState] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [ps, s] = await Promise.all([listPlans(), fetchMySubscription()]);
    setPlans(ps);
    setSub(s);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSelect(plan: Plan) {
    setMessage(null);
    setBusy(plan.code);
    try {
      const result = await startCheckout(plan.code, interval);
      if (result.demo) {
        setMessage(`${plan.name} プランに切り替えました（デモモード）`);
      } else {
        window.location.href = result.checkout_url;
        return;
      }
      await reload();
    } catch {
      setMessage("プランの変更に失敗しました。");
    } finally {
      setBusy(null);
    }
  }

  async function onCancel() {
    if (!confirm("サブスクリプションをキャンセルしますか？（期間終了まで利用可能です）")) return;
    setBusy("cancel");
    try {
      await cancelSubscription();
      setMessage("キャンセル予定として登録しました。");
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1>プラン・請求</h1>

      {message && (
        <div
          style={{
            background: "#ecfdf5",
            color: "#065f46",
            padding: "0.75rem 1rem",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          {message}
        </div>
      )}

      {sub && (
        <div className="kpi-grid" style={{ marginBottom: "1rem" }}>
          <div className="kpi-card">
            <div className="kpi-label">現在のプラン</div>
            <div className="kpi-value">{sub.plan_detail.name}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">状態</div>
            <div className="kpi-value" style={{ fontSize: "1.1rem" }}>
              {STATUS_LABEL[sub.status]}
              {sub.cancel_at_period_end && (
                <div style={{ fontSize: "0.85rem", color: "#dc2626" }}>期間終了でキャンセル</div>
              )}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">次回更新日</div>
            <div className="kpi-value" style={{ fontSize: "1.1rem" }}>
              {sub.current_period_end
                ? new Date(sub.current_period_end).toLocaleDateString()
                : "—"}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">含まれるチャンネル数</div>
            <div className="kpi-value">{sub.plan_detail.included_channels}</div>
          </div>
        </div>
      )}

      <div className="range-bar">
        <span className="muted">プラン期間:</span>
        <button
          className={interval === "month" ? "chip active" : "chip"}
          onClick={() => setIntervalState("month")}
        >
          月額
        </button>
        <button
          className={interval === "year" ? "chip active" : "chip"}
          onClick={() => setIntervalState("year")}
        >
          年額（10%オフ）
        </button>
        {sub && !sub.cancel_at_period_end && sub.status === "active" && (
          <button onClick={onCancel} disabled={busy === "cancel"} className="primary-right">
            {busy === "cancel" ? "処理中..." : "プランをキャンセル"}
          </button>
        )}
      </div>

      <div className="plan-grid">
        {plans.map((p) => {
          const price = interval === "year" ? p.annual_price_jpy : p.monthly_price_jpy;
          const isCurrent = sub?.plan === p.id && sub.status === "active";
          return (
            <div
              key={p.id}
              className={`plan-card${isCurrent ? " current" : ""}`}
            >
              <h2>{p.name}</h2>
              <div className="plan-price">
                {formatJpy(price)}
                <span className="muted"> / {interval === "year" ? "年" : "月"}</span>
              </div>
              <ul>
                <li>含まれるチャンネル: {p.included_channels}</li>
                <li>追加チャンネル: {formatJpy(p.extra_channel_price_jpy)}/月</li>
              </ul>
              <button
                disabled={busy !== null || isCurrent}
                onClick={() => onSelect(p)}
                style={{ width: "100%" }}
              >
                {isCurrent
                  ? "ご利用中"
                  : busy === p.code
                  ? "処理中..."
                  : `${p.name} を選ぶ`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
