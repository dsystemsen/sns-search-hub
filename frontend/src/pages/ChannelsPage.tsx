import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createChannel, deleteChannel, listChannels, type Channel } from "../api/channels";
import { getYouTubeConfig } from "../api/youtube";

const CHANNEL_ID_REGEX = /^UC[A-Za-z0-9_-]{22}$/;

export function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [youtubeChannelId, setYoutubeChannelId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [ytConfigured, setYtConfigured] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [list, cfg] = await Promise.all([
        listChannels(),
        getYouTubeConfig().catch(() => ({ configured: false })),
      ]);
      setChannels(list);
      setYtConfigured(cfg.configured);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function normalizeHandle(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  }

  function validate(): string | null {
    if (!name.trim()) return "チャンネル名を入力してください。";
    if (youtubeChannelId && !CHANNEL_ID_REGEX.test(youtubeChannelId.trim())) {
      return "YouTube Channel ID は `UC` で始まる24文字の英数字です（例: UCBR8-60-B28hp2BmDPdntcQ）。";
    }
    return null;
  }

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
    try {
      await deleteChannel(c.id);
      await reload();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "削除に失敗しました。");
    } finally {
      setDeletingId(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    try {
      await createChannel({
        name: name.trim(),
        handle: normalizeHandle(handle),
        youtube_channel_id: youtubeChannelId.trim(),
        description: description.trim(),
      });
      setName("");
      setHandle("");
      setYoutubeChannelId("");
      setDescription("");
      await reload();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
      setError(detail ? JSON.stringify(detail) : "登録に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>チャンネル</h1>
      <p className="muted">
        分析対象のYouTubeチャンネルを登録します。最低限「チャンネル名」だけで登録可能ですが、
        <strong>YouTube Channel ID</strong>{" "}
        を入力しておくと、YouTube Data API による自動同期や、CSVインポート時のマッチングが正確になります。
      </p>

      <button
        type="button"
        className="chip"
        onClick={() => setShowGuide((v) => !v)}
        style={{ marginBottom: "1rem" }}
      >
        {showGuide ? "▼ 登録方法を閉じる" : "▶ 登録方法の詳細を表示"}
      </button>

      {showGuide && <ChannelRegistrationGuide ytConfigured={ytConfigured} />}

      <h2>新規チャンネル登録</h2>
      <form onSubmit={onSubmit} className="stacked-form" style={{ maxWidth: 640 }}>
        {error && <p className="error">{error}</p>}
        <label>
          チャンネル名 <span style={{ color: "var(--danger)" }}>*</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：マーケティングTV"
            required
          />
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            管理画面で識別するための名前。実際のチャンネル名と一致させると分かりやすいです。
          </span>
        </label>

        <label>
          ハンドル
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="例：@marketing-tv"
          />
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            <code>@</code> で始まるYouTubeハンドル。<code>@</code> を省略してもOK
            （例: <code>marketing-tv</code>）。URLから取得できます：
            <br />
            <code>https://www.youtube.com/<strong>@marketing-tv</strong></code>
          </span>
        </label>

        <label>
          YouTube Channel ID（推奨）
          <input
            value={youtubeChannelId}
            onChange={(e) => setYoutubeChannelId(e.target.value)}
            placeholder="例：UCBR8-60-B28hp2BmDPdntcQ"
            pattern="^UC[A-Za-z0-9_-]{22}$"
            title="UC で始まる24文字の英数字"
          />
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            <code>UC</code> から始まる24文字のユニークID。
            ハンドルが変わってもこのIDは不変なので、長期運用におすすめ。
            <button
              type="button"
              className="link-button"
              onClick={() => setShowGuide(true)}
              style={{ fontSize: "0.8rem" }}
            >
              取得方法を見る
            </button>
          </span>
        </label>

        <label>
          メモ（任意）
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="チーム内でのメモ。例：メインチャンネル、海外向け、月3本ペースなど"
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? "登録中..." : "チャンネルを登録"}
        </button>
      </form>

      <h2 style={{ marginTop: "2rem" }}>登録済みチャンネル ({channels.length}件)</h2>

      {loading ? (
        <p>読み込み中...</p>
      ) : channels.length === 0 ? (
        <p className="muted">
          まだチャンネルが登録されていません。上のフォームから最初のチャンネルを登録してください。
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>名前</th>
                <th>ハンドル</th>
                <th>Channel ID</th>
                <th>登録日</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.handle || "—"}</td>
                  <td>
                    {c.youtube_channel_id ? (
                      <code style={{ fontSize: "0.8rem" }}>{c.youtube_channel_id}</code>
                    ) : (
                      <span className="muted">未設定</span>
                    )}
                  </td>
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

function ChannelRegistrationGuide({ ytConfigured }: { ytConfigured: boolean }) {
  return (
    <div className="guide-panel">
      <h2 style={{ marginTop: 0 }}>📘 チャンネル登録の詳細ガイド</h2>

      <h3>1. 用意するもの</h3>
      <ul>
        <li>
          <strong>チャンネル名</strong>（必須）— 管理画面での表示用
        </li>
        <li>
          <strong>ハンドル</strong>（推奨）— <code>@example</code> 形式
        </li>
        <li>
          <strong>YouTube Channel ID</strong>（推奨）— <code>UC</code> から始まる24文字。一度登録すれば不変
        </li>
      </ul>

      <h3>2. YouTube Channel ID の取得方法（3通り）</h3>

      <div className="guide-method">
        <h4>方法A: YouTube Studio から取得（自分のチャンネル）</h4>
        <ol>
          <li>
            <a href="https://studio.youtube.com/" target="_blank" rel="noreferrer">
              YouTube Studio
            </a>
            にログイン
          </li>
          <li>左メニュー「設定」→「チャンネル」→「基本情報」</li>
          <li>「チャンネル ID」欄に表示される <code>UC...</code> をコピー</li>
        </ol>
      </div>

      <div className="guide-method">
        <h4>方法B: チャンネルページのHTMLから取得（他人のチャンネルでも可）</h4>
        <ol>
          <li>
            対象のYouTubeチャンネルページを開く（例:{" "}
            <code>https://www.youtube.com/@example</code>）
          </li>
          <li>右クリック → 「ページのソースを表示」（Ctrl+U）</li>
          <li>
            Ctrl+F で <code>"channelId":"UC</code> を検索すると ID が見つかる
          </li>
        </ol>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          またはブラウザ拡張「Channel ID Finder」「Subscribe Linkifier」などでも自動取得できます。
        </p>
      </div>

      <div className="guide-method">
        <h4>方法C: YouTube Data API で自動取得（推奨）</h4>
        {ytConfigured ? (
          <p style={{ color: "var(--success)" }}>
            ✓ YouTube Data API キーは設定済みです。ハンドルだけ入力して登録すれば、
            API同期時に自動でChannel IDが解決されます。
          </p>
        ) : (
          <>
            <p>
              <code>backend/.env</code> の <code>YOUTUBE_API_KEY</code> を設定すると、
              ハンドル <code>@example</code> から Channel ID を自動取得できます。
            </p>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              設定手順：
              <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">
                Google Cloud Console
              </a>
              で「YouTube Data API v3」を有効化 → 認証情報 → APIキー作成 →{" "}
              <Link to="/app/settings">設定画面</Link>で確認
            </p>
          </>
        )}
      </div>

      <h3>3. 登録後にできること</h3>
      <ol>
        <li>
          <Link to="/app/imports">CSVインポート</Link> 画面から、
          <strong>YouTube Studio エクスポート</strong> の動画別CSV・日次CSVをアップロード
        </li>
        <li>
          チャンネル詳細画面で <strong>KPIダッシュボード</strong>・
          <strong>日次推移グラフ</strong>・<strong>動画ランキング</strong>を確認
        </li>
        <li>
          <strong>Excelレポート</strong>をワンクリック生成、月初に自動メール送信
        </li>
        <li>
          API設定済みなら「コメント取得」ボタンで{" "}
          <strong>動画コメントの自動取得</strong>＋AIタグ付け・返信ドラフト
        </li>
      </ol>

      <h3>4. CSV エクスポートの取得方法（YouTube Studio）</h3>
      <ol>
        <li>
          <a href="https://studio.youtube.com/" target="_blank" rel="noreferrer">
            YouTube Studio
          </a>{" "}
          → 左メニュー「アナリティクス」
        </li>
        <li>右上の <strong>「詳細データ」</strong> をクリック</li>
        <li>
          上部タブで「コンテンツ」「視聴者」「リーチ」などを選択し、期間を設定
        </li>
        <li>
          右上の <strong>↓ ダウンロード</strong> アイコン → <code>.csv</code>を選択
        </li>
        <li>
          このSaaSのインポート画面で、CSVの種類（動画別 × 日次 など）を選んでアップロード
        </li>
      </ol>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        英語ヘッダー（<code>Date, Content, Views</code> 等）と日本語ヘッダー
        （<code>日付, 動画, 視聴回数</code> 等）の両方を自動認識します。
      </p>

      <h3>5. よくある質問</h3>
      <dl className="faq">
        <dt>Q. ハンドルとChannel ID、両方入力する必要は？</dt>
        <dd>
          A. 片方だけでもOKです。Channel ID があれば最も確実ですが、
          ハンドルだけでもCSVインポートは可能です。
        </dd>

        <dt>Q. チャンネル名を変えたい</dt>
        <dd>
          A. 現在はDjango Admin画面 (<code>/admin/</code>) から変更できます。
          UIからの編集は今後対応予定。
        </dd>

        <dt>Q. 複数チャンネルは登録できる？</dt>
        <dd>
          A. プランごとに上限があります（Starter: 1ch / Pro: 3ch / Enterprise: 15ch）。
          詳細は <Link to="/app/billing">プラン・請求</Link> をご覧ください。
        </dd>

        <dt>Q. 登録したチャンネルを削除したい</dt>
        <dd>
          A. 関連するCSVデータ・動画・コメントが一緒に削除されます。Django Admin
          画面から実行してください。データを残したい場合は管理者にバックアップを依頼してください。
        </dd>

        <dt>Q. 非公開チャンネルや限定公開動画も分析できる？</dt>
        <dd>
          A. CSVアップロード経由なら可能です（YouTube Studioが出力するCSVに含まれます）。
          YouTube Data API 経由は公開データのみです。
        </dd>
      </dl>
    </div>
  );
}
