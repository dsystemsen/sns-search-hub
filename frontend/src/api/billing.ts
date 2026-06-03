import { api } from "./client";

export type Plan = {
  id: number;
  code: string;
  name: string;
  monthly_price_jpy: number;
  annual_price_jpy: number;
  included_channels: number;
  extra_channel_price_jpy: number;
};

export type Subscription = {
  id: number;
  plan: number;
  plan_detail: Plan;
  status: "trialing" | "active" | "past_due" | "canceled";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string;
  stripe_subscription_id: string;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export async function listPlans() {
  const { data } = await api.get<Paginated<Plan>>("/billing/plans/");
  return data.results;
}

export async function fetchMySubscription() {
  const { data } = await api.get<Subscription>("/billing/subscription/me/");
  return data;
}

export type CheckoutResult =
  | { demo: true; plan_code: string; interval: string }
  | { demo: false; checkout_url: string };

export async function startCheckout(planCode: string, interval: "month" | "year") {
  const { data } = await api.post<CheckoutResult>("/billing/subscription/checkout/", {
    plan_code: planCode,
    interval,
  });
  return data;
}

export async function cancelSubscription() {
  const { data } = await api.post<Subscription>("/billing/subscription/cancel/");
  return data;
}

export const STATUS_LABEL: Record<Subscription["status"], string> = {
  trialing: "無料トライアル中",
  active: "有効",
  past_due: "支払い遅延",
  canceled: "解約済み",
};
