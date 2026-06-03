import { useCallback, useEffect, useMemo, useState } from "react";
import { listChannels, type Channel } from "../api/channels";
import { TAG_LABELS, type CommentTag } from "../api/comments";
import { fetchKeywords, type KeywordsResponse } from "../api/keywords";

const TAG_ORDER: CommentTag[] = ["good", "question", "complaint", "spam", "other", "untagged"];

function fontSizeForCount(count: number, max: number) {
  if (max === 0) return 0.85;
  const ratio = count / max;
  return 0.85 + ratio * 1.8;
}
function colorForCount(count: number, max: number) {
  const ratio = max === 0 ? 0 : count / max;
  const h = 220 - ratio * 60;
  return `hsl(${h}, 75%, ${55 - ratio * 20}%)`;
}

export function KeywordsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filterChannel, setFilterChannel] = useState<number | "">("");
  const [filterTag, setFilterTag] = useState<CommentTag | "">("");
  const [data, setData] = useState<KeywordsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [chs, kw] = await Promise.all([
        listChannels(),
        fetchKeywords({
          channel: filterChannel === "" ? undefined : Number(filterChannel),
          tag: filterTag || undefined,
          limit: 60,
        }),
      ]);
      setChannels(chs);
      setData(kw);
    } finally {
      setLoading(false);
    }
  }, [filterChannel, filterTag]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxCount = useMemo(
    () => (data?.keywords.length ? data.keywords[0].count : 0),
    [data]
  );

  return (
    <div>
      <h1>キーワード分析</h1>
      <p className="muted">
        コメントを日本語形態素解析（janome）で分析し、頻出するキーワードを可視化します。
        商品名・チャンネル名で絞り込み、ファンの反応を捉えます。
      </p>

      <div className="range-bar">
        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">すべてのチャンネル</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value as CommentTag | "")}
        >
          <option value="">すべてのタグ</option>
          {TAG_ORDER.map((t) => (
            <option key={t} value={t}>
              {TAG_LABELS[t]}
            </option>
          ))}
        </select>
        {data && (
          <span className="muted">
            対象コメント: <strong>{data.total_comments.toLocaleString()}</strong> 件
          </span>
        )}
      </div>

      {loading ? (
        <p>読み込み中...</p>
      ) : !data || data.keywords.length === 0 ? (
        <p className="muted">
          抽出できるキーワードがありません。コメントをCSVインポートしてください。
        </p>
      ) : (
        <>
          <h2>頻出語クラウド</h2>
          <div className="word-cloud">
            {data.keywords.map((k) => (
              <span
                key={k.word}
                className="word-tag"
                style={{
                  fontSize: `${fontSizeForCount(k.count, maxCount)}rem`,
                  color: colorForCount(k.count, maxCount),
                }}
                title={`${k.count}件`}
              >
                {k.word}
              </span>
            ))}
          </div>

          <h2>ランキング</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>順位</th>
                <th>キーワード</th>
                <th>出現回数</th>
              </tr>
            </thead>
            <tbody>
              {data.keywords.map((k, i) => (
                <tr key={k.word}>
                  <td>{i + 1}</td>
                  <td>{k.word}</td>
                  <td>{k.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
