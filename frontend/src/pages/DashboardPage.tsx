import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteChannel, listChannels, type Channel } from "../api/channels";
import { CardSpotlight } from "@/components/ui/card-spotlight";

export function DashboardPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setChannels(await listChannels());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onDelete(c: Channel) {
    const confirmText =
      `「${c.name}」を削除しますか？\n\n` +
      `この操作で以下も一緒に削除されます：\n` +
      `・このチャンネルに紐づく全ての動画\n` +
      `・日次メトリクス（再生数・視聴時間など）\n` +
      `・コメント（タグ・対応状況含む）\n\n` +
      `※過去のExcelレポート・CSVインポート履歴は記録として残ります（チャンネル参照のみ解除）。\n\n` +
      `削除は取り消せません。続行しますか？`;
    if (!confirm(confirmText)) return;

    setDeletingId(c.id);
    setError(null);
    setMessage(null);
    try {
      await deleteChannel(c.id);
      setMessage(`「${c.name}」を削除しました。`);
      await reload();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "削除に失敗しました。");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1>ダッシュボード</h1>

      {message && <div className="notice-success">{message}</div>}
      {error && <p className="error">{error}</p>}

      <div className="kpi-grid">
        <CardSpotlight className="kpi-card-spotlight" color="#1d4ed8">
          <div className="text-sm font-medium text-neutral-300">登録チャンネル数</div>
          <div className="mt-2 text-4xl font-bold text-white">{channels.length}</div>
          <p className="mt-3 text-xs text-neutral-400">
            カードにマウスを乗せるとスポットライトが反応します
          </p>
        </CardSpotlight>
      </div>

      <h2>チャンネル一覧</h2>

      {loading ? (
        <p>読み込み中...</p>
      ) : channels.length === 0 ? (
        <p>
          まず <Link to="/app/channels">チャンネル</Link> を登録し、
          <Link to="/app/imports">CSVインポート</Link> からデータを取り込んでください。
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>チャンネル名</th>
                <th>ハンドル</th>
                <th>登録日</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/app/channels/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{c.handle || "—"}</td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>
                    <Link to={`/app/channels/${c.id}`}>分析を見る</Link>
                  </td>
                  <td>
                    <button
                      className="link-button"
                      style={{ color: "var(--danger)" }}
                      disabled={deletingId === c.id}
                      onClick={() => onDelete(c)}
                      title="チャンネルと関連データを全て削除"
                    >
                      {deletingId === c.id ? "削除中..." : "削除"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
