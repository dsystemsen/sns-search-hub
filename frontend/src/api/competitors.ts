import { api } from "./client";

export type Competitor = {
  id: number;
  youtube_channel_id: string;
  name: string;
  handle: string;
  note: string;
  created_at: string;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export async function listCompetitors() {
  const { data } = await api.get<Paginated<Competitor>>("/channels/competitors/");
  return data.results;
}

export async function createCompetitor(payload: Partial<Competitor> & { name: string }) {
  const { data } = await api.post<Competitor>("/channels/competitors/", payload);
  return data;
}

export async function deleteCompetitor(id: number) {
  await api.delete(`/channels/competitors/${id}/`);
}

export type CompetitorDailyRow = {
  date: string;
  subscribers_total: number;
  videos_total: number;
  views_total: number;
  subscribers_delta: number;
  views_delta: number;
  videos_delta: number;
};

export type CompetitorDashboard = {
  competitor_id: number;
  competitor_name: string;
  period: { start: string; end: string };
  latest: { subscribers_total: number; videos_total: number; views_total: number } | null;
  growth: { subscribers: number; views: number; videos: number };
  daily: CompetitorDailyRow[];
};

export async function fetchCompetitorDashboard(id: number, start?: string, end?: string) {
  const params: Record<string, string> = {};
  if (start) params.start = start;
  if (end) params.end = end;
  const { data } = await api.get<CompetitorDashboard>(
    `/analytics/competitors/${id}/dashboard/`,
    { params }
  );
  return data;
}

export type CompetitorCompare = {
  period: { start: string; end: string };
  own: { points: { date: string; subscribers: number }[] } | null;
  competitors: {
    competitor_id: number;
    name: string;
    points: { date: string; subscribers: number }[];
  }[];
};

export async function fetchCompetitorCompare(channelId?: number, start?: string, end?: string) {
  const params: Record<string, string> = {};
  if (channelId) params.channel_id = String(channelId);
  if (start) params.start = start;
  if (end) params.end = end;
  const { data } = await api.get<CompetitorCompare>("/analytics/competitors/compare/", { params });
  return data;
}
