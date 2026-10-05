"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { affiliateOnboardingPath, type PromotionMode } from "@/../utils/affiliate/onboarding";

export function PromotionBackLink({ fromOnboarding, mode }: {
  fromOnboarding: boolean;
  mode: PromotionMode;
}) {
  const href = fromOnboarding ? affiliateOnboardingPath(null, mode) : "/affiliate/marketplace";

  return (
    <Link href={href} prefetch={false}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-[#00C2CB]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00C2CB]">
      <ArrowLeft className="h-4 w-4 text-[#00C2CB]" aria-hidden="true" />
      Back to offers
    </Link>
  );
}
