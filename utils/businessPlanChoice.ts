export type BusinessPlanChoice = "free" | "growth";
/** Growth is the default; only an explicit ?plan=free selects Free. */
export function resolveBusinessPlanChoice(value: string | null | undefined): BusinessPlanChoice {
  return value === "free" ? "free" : "growth";
}
