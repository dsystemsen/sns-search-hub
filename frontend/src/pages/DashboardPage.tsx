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
      <div className="dashboard-head">
        <h1>ダッシュボード</h1>
        <span className="muted">YouTube分析ワークスペース</span>
      </div>

      {message && <div className="notice-success">{message}</div>}
      {error && <p className="error">{error}</p>}

      <div className="bento-grid">
        {/* ヒーロー: 登録チャンネル数 (スポットライト) */}
        <CardSpotlight className="col-2 row-2" color="#1d4ed8">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            あなたのワークスペース
          </p>
          <div className="mt-3 text-6xl font-extrabold leading-none text-white">
            {loading ? "—" : channels.length}
          </div>
          <p className="mt-2 text-sm text-neutral-300">登録チャンネル数</p>
          <p className="mt-6 max-w-xs text-xs leading-relaxed text-neutral-400">
            チャンネルを登録し、CSVを取り込むと、再生数・視聴維持率・コメント分析などが
            このダッシュボードに集約されます。
          </p>
          <Link
            to="/app/channels"
            className="mt-6 inline-block rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white no-underline transition hover:bg-white/20"
          >
            チャンネルを管理 →
          </Link>
        </CardSpotlight>

        {/* クイックリンク */}
        <section className="bento-card col-2">
          <p className="bento-eyebrow">クイックアクセス</p>
          <h2 className="bento-title">よく使う機能</h2>
          <div className="bento-actions">
            <Link className="bento-link" to="/app/channels">
              チャンネル登録 <span className="arrow">→</span>
            </Link>
            <Link className="bento-link" to="/app/imports">
              CSVインポート <span className="arrow">→</span>
            </Link>
            <Link className="bento-link" to="/app/keywords">
              キーワード分析 <span className="arrow">→</span>
            </Link>
            <Link className="bento-link" to="/app/comments">
              コメント管理 <span className="arrow">→</span>
            </Link>
          </div>
        </section>

        {/* はじめに */}
        <section className="bento-card col-2">
          <p className="bento-eyebrow">Getting Started</p>
          <h2 className="bento-title">はじめの3ステップ</h2>
          <ol className="bento-steps">
            <li>
              <Link to="/app/channels">チャンネル</Link> を登録する
            </li>
            <li>
              <Link to="/app/imports">CSVインポート</Link> でデータを取り込む
            </li>
            <li>分析ダッシュボードで成果を確認する</li>
          </ol>
        </section>

        {/* チャンネル一覧 */}
        <section className="bento-card col-4">
          <p className="bento-eyebrow">登録済み</p>
          <h2 className="bento-title">チャンネル一覧</h2>
          {loading ? (
            <p className="muted">読み込み中...</p>
          ) : channels.length === 0 ? (
            <p className="muted">
              まだチャンネルがありません。まず <Link to="/app/channels">チャンネル</Link> を登録し、
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
        </section>
      </div>
    </div>
  );
}
