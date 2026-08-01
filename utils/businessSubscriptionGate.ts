import { SupabaseClient } from "@supabase/supabase-js";
import {
  assertBusinessSubscriptionGate,
  BusinessEntitlement,
} from "./businessEntitlements";

export type SubscriptionRequiredResponse = {
  success: false;
  error: "BUSINESS_SUBSCRIPTION_REQUIRED";
  message: string;
  subscriptionRequired: true;
  entitlement: BusinessEntitlement | null;
  checkout: {
    businessId: string | null;
    returnTo: string;
    intendedAction: string;
    campaignId: string | null;
    submissionId: string | null;
    attribution: Record<string, unknown>;
  };
};

export function isSubscriptionRequiredError(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : String(error || "");
  return message.includes("BUSINESS_SUBSCRIPTION_REQUIRED");
}

export function buildSubscriptionRequiredResponse(params: {
  message?: string;
  entitlement: BusinessEntitlement | null;
  businessId?: string | null;
  returnTo: string;
  intendedAction: string;
  campaignId?: string | null;
  submissionId?: string | null;
  attribution?: Record<string, unknown> | null;
}): SubscriptionRequiredResponse {
  return {
    success: false,
    error: "BUSINESS_SUBSCRIPTION_REQUIRED",
    message: params.message || "Activate Nettmark Business to approve and launch affiliate campaigns.",
    subscriptionRequired: true,
    entitlement: params.entitlement,
    checkout: {
      businessId: params.businessId || params.entitlement?.businessId || null,
      returnTo: params.returnTo,
      intendedAction: params.intendedAction,
      campaignId: params.campaignId || params.submissionId || null,
      submissionId: params.submissionId || null,
      attribution: params.attribution || {},
    },
  };
}

export async function requireBusinessCampaignLaunchEntitlement(params: {
  supabase: SupabaseClient;
  businessId?: string | null;
  businessEmail?: string | null;
  returnTo: string;
  intendedAction: string;
  campaignId?: string | null;
  submissionId?: string | null;
  attribution?: Record<string, unknown> | null;
}) {
  const result = await assertBusinessSubscriptionGate({
    supabase: params.supabase,
    businessId: params.businessId,
    businessEmail: params.businessEmail,
  });

  if (result.ok === true) return { ok: true as const, entitlement: result.entitlement };

  return {
    ok: false as const,
    status: result.status,
    body: buildSubscriptionRequiredResponse({
      message: result.message,
      entitlement: result.entitlement,
      businessId: params.businessId,
      returnTo: params.returnTo,
      intendedAction: params.intendedAction,
      campaignId: params.campaignId,
      submissionId: params.submissionId,
      attribution: params.attribution,
    }),
  };
}
