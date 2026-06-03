import { api } from "./client";

export type Report = {
  id: number;
  channel: number | null;
  period_start: string;
  period_end: string;
  status: "pending" | "running" | "done" | "failed";
  file: string | null;
  error_message: string;
  created_at: string;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export async function listReports() {
  const { data } = await api.get<Paginated<Report>>("/analytics/reports/");
  return data.results;
}

export async function createReport(payload: {
  channel: number;
  period_start: string;
  period_end: string;
}) {
  const { data } = await api.post<Report>("/analytics/reports/", payload);
  return data;
}
