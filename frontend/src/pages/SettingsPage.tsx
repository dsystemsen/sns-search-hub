import { type FormEvent, useEffect, useState } from "react";
import { fetchCurrentTenant } from "../api/auth";
import { sendTestNotification, updateTenantWebhooks } from "../api/notifications";

export function SettingsPage() {
  const [slack, setSlack] = useState("");
  const [discord, setDiscord] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCurrentTenant().then((t) => {
      setSlack(t.slack_webhook_url ?? "");
      setDiscord(t.discord_webhook_url ?? "");
    });
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      await updateTenantWebhooks({
        slack_webhook_url: slack.trim(),
        discord_webhook_url: discord.trim(),
      });
      setMessage("保存しました。");
    } catch {
      setError("保存に失敗しました。URLの形式をご確認ください。");
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setMessage(null);
    setError(null);
    setTesting(true);
    try {
      const result = await sendTestNotification();
      const parts: string[] = [];
      if (slack) parts.push(`Slack: ${result.slack ? "✓ 成功" : "✗ 失敗"}`);
      if (discord) parts.push(`Discord: ${result.discord ? "✓ 成功" : "✗ 失敗"}`);
      setMessage(parts.join(" / ") || "送信先がありません。");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } | string[] } })?.response?.data;
      setError(
        Array.isArray(detail) ? detail.join(" ") : (detail as { detail?: string })?.detail ?? "送信に失敗しました。"
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <h1>設定</h1>

      <h2>通知Webhook</h2>
      <p className="muted">
        月次レポート送信時やレビュー依頼時に、SlackやDiscordの指定チャンネルへ通知を送ります。
      </p>
      <form onSubmit={onSave} className="stacked-form" style={{ maxWidth: 640 }}>
        {error && <p className="error">{error}</p>}
        {message && <p className="notice-success">{message}</p>}
        <label>
          Slack Incoming Webhook URL
          <input
            value={slack}
            onChange={(e) => setSlack(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
          />
        </label>
        <label>
          Discord Webhook URL
          <input
            value={discord}
            onChange={(e) => setDiscord(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
          />
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="submit" disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            className="chip"
            onClick={onTest}
            disabled={testing || (!slack && !discord)}
          >
            {testing ? "送信中..." : "テスト送信"}
          </button>
        </div>
      </form>

      <h2 style={{ marginTop: "2rem" }}>外部APIキー</h2>
      <p className="muted">
        以下のAPIキーは <code>backend/.env</code> ファイルで設定します。本番では Secret Manager
        を使ってください。
      </p>
      <ul>
        <li>
          <code>ANTHROPIC_API_KEY</code> — AI要約・自動タグ付け（
          <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          ）
        </li>
        <li>
          <code>YOUTUBE_API_KEY</code> — 競合チャンネル・コメント自動取得（Google Cloud Console →
          YouTube Data API v3）
        </li>
        <li>
          <code>STRIPE_SECRET_KEY</code> — 本番課金（
          <code>STRIPE_DEMO_MODE=False</code>で有効化）
        </li>
      </ul>
    </div>
  );
}
