import { api } from "./client";
import type { User } from "./auth";

export type Approval = {
  id: number;
  order: number;
  approver: number;
  approver_detail: Pick<User, "id" | "email" | "username">;
  status: "pending" | "approved" | "rejected";
  comment: string;
  decided_at: string | null;
  created_at: string;
};

export type PlanComment = {
  id: number;
  author: number | null;
  author_detail: Pick<User, "id" | "email" | "username"> | null;
  body: string;
  created_at: string;
};

export type ContentPlan = {
  id: number;
  channel: number | null;
  title: string;
  description: string;
  thumbnail_url: string;
  planned_publish_at: string;
  status: "draft" | "in_review" | "approved" | "rejected" | "published" | "cancelled";
  created_by: number | null;
  created_by_detail: Pick<User, "id" | "email" | "username"> | null;
  approvals: Approval[];
  comments: PlanComment[];
  created_at: string;
  updated_at: string;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export async function listPlans(params?: { from?: string; to?: string; status?: string }) {
  const { data } = await api.get<Paginated<ContentPlan>>("/content/plans/", { params });
  return data.results;
}

export async function getPlan(id: number) {
  const { data } = await api.get<ContentPlan>(`/content/plans/${id}/`);
  return data;
}

export async function createPlan(payload: {
  title: string;
  description?: string;
  channel?: number | null;
  planned_publish_at: string;
  approver_ids: number[];
  thumbnail_url?: string;
}) {
  const { data } = await api.post<ContentPlan>("/content/plans/", payload);
  return data;
}

export async function submitPlan(id: number) {
  const { data } = await api.post<ContentPlan>(`/content/plans/${id}/submit/`);
  return data;
}

export async function decidePlan(id: number, decision: "approve" | "reject", comment = "") {
  const { data } = await api.post<ContentPlan>(`/content/plans/${id}/decide/`, {
    decision,
    comment,
  });
  return data;
}

export async function publishPlan(id: number) {
  const { data } = await api.post<ContentPlan>(`/content/plans/${id}/mark-published/`);
  return data;
}

export async function cancelPlan(id: number) {
  const { data } = await api.post<ContentPlan>(`/content/plans/${id}/cancel/`);
  return data;
}

export async function addComment(id: number, body: string) {
  const { data } = await api.post<PlanComment>(`/content/plans/${id}/comments/`, { body });
  return data;
}

export async function bulkSubmitPlans(ids: number[]) {
  const { data } = await api.post<{ submitted: number }>("/content/plans/bulk-submit/", { ids });
  return data;
}

export async function bulkCancelPlans(ids: number[]) {
  const { data } = await api.post<{ cancelled: number }>("/content/plans/bulk-cancel/", { ids });
  return data;
}

export async function listTenantUsers() {
  const { data } = await api.get<User[]>("/accounts/users/");
  return data;
}

export const STATUS_LABELS: Record<ContentPlan["status"], string> = {
  draft: "下書き",
  in_review: "レビュー中",
  approved: "承認済み",
  rejected: "差し戻し",
  published: "公開済み",
  cancelled: "キャンセル",
};

export const STATUS_COLORS: Record<ContentPlan["status"], string> = {
  draft: "#6b7280",
  in_review: "#f59e0b",
  approved: "#16a34a",
  rejected: "#dc2626",
  published: "#2563eb",
  cancelled: "#9ca3af",
};
