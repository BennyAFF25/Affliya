import { safeBusinessReturnTo } from "./safeBusinessReturnTo";
// Routing only. The server endpoint verifies identity, role and stored plan choice.
export async function businessLoginDestination(returnTo: string | null = null) {
  const response = await fetch("/api/business-subscription/plan-step-status", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not verify your plan choice. Please try again.");
  const { required, onboardingCompleted } = await response.json();
  const next = safeBusinessReturnTo(returnTo);
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  if (required) return `/business/choose-plan${suffix}`;
  if (next && onboardingCompleted === false) return `/onboarding/for-business${suffix}`;
  return next || "/business/dashboard";
}
