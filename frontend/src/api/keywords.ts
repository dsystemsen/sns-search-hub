import { api } from "./client";

export type KeywordItem = { word: string; count: number };

export type KeywordsResponse = {
  scope: {
    channel_id: number | null;
    tag: string | null;
    start: string | null;
    end: string | null;
  };
  total_comments: number;
  keywords: KeywordItem[];
};

export async function fetchKeywords(params?: {
  channel?: number;
  tag?: string;
  start?: string;
  end?: string;
  limit?: number;
}) {
  const query: Record<string, string> = {};
  if (params?.channel) query.channel = String(params.channel);
  if (params?.tag) query.tag = params.tag;
  if (params?.start) query.start = params.start;
  if (params?.end) query.end = params.end;
  if (params?.limit) query.limit = String(params.limit);
  const { data } = await api.get<KeywordsResponse>("/comments/keywords/", { params: query });
  return data;
}
