import { api } from "./client";

export type ImportJob = {
  id: number;
  channel: number | null;
  source_type: string;
  file: string;
  status: "pending" | "running" | "done" | "failed";
  rows_total: number;
  rows_imported: number;
  rows_skipped: number;
  error_message: string;
  created_at: string;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export async function listImports() {
  const { data } = await api.get<Paginated<ImportJob>>("/imports/jobs/");
  return data.results;
}

export async function createImport(payload: {
  channel?: number;
  competitor?: number;
  source_type: string;
  file: File;
}) {
  const form = new FormData();
  if (payload.channel) form.append("channel", String(payload.channel));
  if (payload.competitor) form.append("competitor", String(payload.competitor));
  form.append("source_type", payload.source_type);
  form.append("file", payload.file);
  const { data } = await api.post<ImportJob>("/imports/jobs/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
