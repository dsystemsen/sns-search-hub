import { api, tokenStore } from "./client";

export type User = {
  id: number;
  email: string;
  username: string;
  role: string;
  tenant: number | null;
};

export type Tenant = {
  id: number;
  name: string;
  slug: string;
  plan: string;
  trial_ends_at: string | null;
  is_active: boolean;
  slack_webhook_url: string;
  discord_webhook_url: string;
};

export async function signup(payload: { email: string; password: string; company_name: string }) {
  const { data } = await api.post<User>("/accounts/signup/", payload);
  return data;
}

export async function login(email: string, password: string) {
  const resp = await api.post<{ access: string; refresh: string }>("/auth/token/", {
    email,
    password,
  });
  tokenStore.set(resp.data.access, resp.data.refresh);
  return resp.data;
}

export function logout() {
  tokenStore.clear();
}

export async function fetchMe() {
  const { data } = await api.get<User>("/accounts/me/");
  return data;
}

export async function fetchCurrentTenant() {
  const { data } = await api.get<Tenant>("/tenants/me/");
  return data;
}
