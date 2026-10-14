// Routing only. The server endpoint verifies identity, role and stored plan choice.
export async function businessLoginDestination(returnTo: string | null = null) {
  const response = await fetch("/api/business-subscription/plan-step-status", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not verify your plan choice. Please try again.");
  const { required } = await response.json();
  return required ? "/business/choose-plan" : returnTo || "/business/dashboard";
}
