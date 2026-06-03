import { api } from "./client";

export async function getYouTubeConfig() {
  const { data } = await api.get<{ configured: boolean }>("/youtube/config/");
  return data;
}

export async function syncCompetitor(competitorId: number) {
  const { data } = await api.post<{
    competitor_id: number;
    name: string;
    synced_at: string;
    subscribers: number;
    videos: number;
    views: number;
  }>(`/youtube/competitors/${competitorId}/sync/`);
  return data;
}

export async function syncChannel(channelId: number) {
  const { data } = await api.post<{
    id: string;
    title: string;
    subscriber_count: number;
    video_count: number;
    view_count: number;
  }>(`/youtube/channels/${channelId}/sync/`);
  return data;
}

export async function syncVideoComments(videoId: number, maxResults = 100) {
  const { data } = await api.post<{
    fetched: number;
    created: number;
    updated: number;
  }>(`/youtube/videos/${videoId}/sync-comments/`, { max_results: maxResults });
  return data;
}
