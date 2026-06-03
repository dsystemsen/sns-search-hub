import { api } from "./client";
import type { CommentTag } from "./comments";

export async function getAIConfig() {
  const { data } = await api.get<{ configured: boolean; model: string }>("/ai/config/");
  return data;
}

export type SummaryResult = { summary: string; count: number; cached?: boolean };

export async function summarizeComments(params?: {
  channel?: number;
  tag?: CommentTag;
  start?: string;
  end?: string;
}) {
  const { data } = await api.post<SummaryResult>("/ai/comments/summary/", params ?? {});
  return data;
}

export type TagSuggestion = { comment_id: number; suggested_tag: CommentTag };

export type AutoTagResult = {
  suggestions: TagSuggestion[];
  candidate_count: number;
  applied: number;
};

export async function autoTagComments(opts: { limit?: number; apply?: boolean } = {}) {
  const apply = opts.apply ? "?apply=true" : "";
  const { data } = await api.post<AutoTagResult>(`/ai/comments/auto-tag/${apply}`, {
    limit: opts.limit ?? 50,
  });
  return data;
}

export async function suggestTitles(payload: {
  topic: string;
  audience?: string;
  current_title?: string;
}) {
  const { data } = await api.post<{ titles: string[] }>("/ai/titles/", payload);
  return data.titles;
}

export type ReplyDraft = { style: "short" | "friendly" | "cta"; text: string };

export async function draftCommentReply(commentId: number) {
  const { data } = await api.post<{ comment_id: number; drafts: ReplyDraft[] }>(
    `/ai/comments/${commentId}/draft-reply/`
  );
  return data.drafts;
}
