import { api } from "./client";
import { tokenStore } from "./client";

export type CommentTag = "untagged" | "good" | "question" | "complaint" | "spam" | "other";

export type Comment = {
  id: number;
  video: number;
  video_title: string;
  channel_id: number;
  youtube_comment_id: string;
  author_name: string;
  text: string;
  published_at: string | null;
  likes: number;
  is_handled: boolean;
  is_pinned: boolean;
  tag: CommentTag;
  internal_note: string;
  created_at: string;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export const TAG_LABELS: Record<CommentTag, string> = {
  untagged: "未分類",
  good: "好意的",
  question: "質問",
  complaint: "クレーム",
  spam: "スパム",
  other: "その他",
};

export const TAG_COLORS: Record<CommentTag, string> = {
  untagged: "#9ca3af",
  good: "#16a34a",
  question: "#2563eb",
  complaint: "#dc2626",
  spam: "#7c3aed",
  other: "#64748b",
};

export type CommentFilters = {
  tag?: CommentTag;
  handled?: boolean;
  pinned?: boolean;
  channel?: number;
  q?: string;
  page?: number;
};

export async function listComments(params?: CommentFilters) {
  const query: Record<string, string> = {};
  if (params?.tag) query.tag = params.tag;
  if (params?.handled !== undefined) query.handled = String(params.handled);
  if (params?.pinned !== undefined) query.pinned = String(params.pinned);
  if (params?.channel) query.channel = String(params.channel);
  if (params?.q) query.q = params.q;
  if (params?.page) query.page = String(params.page);
  const { data } = await api.get<Paginated<Comment>>("/comments/", { params: query });
  return data;
}

export async function updateComment(
  id: number,
  patch: Partial<Pick<Comment, "tag" | "is_handled" | "is_pinned" | "internal_note">>
) {
  const { data } = await api.patch<Comment>(`/comments/${id}/`, patch);
  return data;
}

export async function bulkUpdateComments(
  ids: number[],
  patch: Partial<Pick<Comment, "tag" | "is_handled" | "is_pinned">>
) {
  const { data } = await api.patch<{ affected: number; updates: Record<string, unknown> }>(
    "/comments/bulk/",
    { ids, ...patch }
  );
  return data;
}

export async function bulkDeleteComments(ids: number[]) {
  const { data } = await api.delete<{ deleted: number }>("/comments/bulk-delete/", {
    data: { ids },
  });
  return data;
}

export async function downloadCommentsCsv(filters?: CommentFilters) {
  const query = new URLSearchParams();
  if (filters?.tag) query.set("tag", filters.tag);
  if (filters?.handled !== undefined) query.set("handled", String(filters.handled));
  if (filters?.pinned !== undefined) query.set("pinned", String(filters.pinned));
  if (filters?.channel) query.set("channel", String(filters.channel));
  if (filters?.q) query.set("q", filters.q);
  const token = tokenStore.getAccess();
  const base = (api.defaults.baseURL ?? "").replace(/\/$/, "");
  const resp = await fetch(`${base}/comments/export/?${query.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error("Export failed");
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comments_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type CommentSummary = {
  total: number;
  handled: number;
  unhandled: number;
  pinned: number;
  by_tag: { tag: CommentTag; count: number }[];
};

export async function fetchCommentSummary() {
  const { data } = await api.get<CommentSummary>("/comments/summary/");
  return data;
}
