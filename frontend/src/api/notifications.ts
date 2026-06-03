import { api } from "./client";

export async function sendTestNotification(text?: string) {
  const { data } = await api.post<{ slack: boolean; discord: boolean }>(
    "/notifications/test/",
    text ? { text } : {}
  );
  return data;
}

export async function updateTenantWebhooks(payload: {
  slack_webhook_url?: string;
  discord_webhook_url?: string;
}) {
  const { data } = await api.patch("/tenants/me/", payload);
  return data;
}
