import { api } from "./client";

export type Channel = {
  id: number;
  youtube_channel_id: string;
  name: string;
  handle: string;
  description: string;
  thumbnail_url: string;
  is_active: boolean;
  created_at: string;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export async function listChannels() {
  const { data } = await api.get<Paginated<Channel>>("/channels/channels/");
  return data.results;
}

export async function createChannel(payload: Partial<Channel> & { name: string }) {
  const { data } = await api.post<Channel>("/channels/channels/", payload);
  return data;
}

export async function deleteChannel(id: number) {
  await api.delete(`/channels/channels/${id}/`);
}

export type DailyRow = {
  date: string;
  views: number;
  watch_time_minutes: number;
  likes: number;
  comments: number;
  shares: number;
  subscribers_total: number | null;
};

export type TopVideo = {
  video_id: number;
  title: string;
  youtube_video_id: string;
  views: number;
  watch_time_minutes: number;
  likes: number;
  comments: number;
};

export type DashboardData = {
  channel_id: number;
  channel_name: string;
  period: { start: string; end: string };
  totals: Record<string, number>;
  subscribers: { total: number | null; gained: number; lost: number; net: number };
  daily: DailyRow[];
  top_videos: TopVideo[];
};

export type DateBreakdown = {
  channel_id: number;
  date: string;
  videos: Array<{
    video_id: number;
    title: string;
    youtube_video_id: string;
    views: number;
    watch_time_minutes: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
};

export async function fetchChannelBreakdown(channelId: number, date: string) {
  const { data } = await api.get<DateBreakdown>(
    `/analytics/channels/${channelId}/breakdown/`,
    { params: { date } }
  );
  return data;
}

export async function fetchDashboard(channelId: number, start?: string, end?: string) {
  const params: Record<string, string> = {};
  if (start) params.start = start;
  if (end) params.end = end;
  const { data } = await api.get<DashboardData>(
    `/analytics/channels/${channelId}/dashboard/`,
    { params }
  );
  return data;
}
