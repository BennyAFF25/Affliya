"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { policyReturnDestination } from "@/../utils/legal/navigation";

export default function LegalPolicyNavigation() {
  const [returnTo, setReturnTo] = useState("/");
  useEffect(() => {
    setReturnTo(policyReturnDestination(
      new URLSearchParams(window.location.search).get("returnTo"),
      document.referrer,
      window.location.origin,
    ));
  }, []);
  return (
    <nav aria-label="Return from policy" className="sticky top-4 z-10 mb-8 w-fit">
      <Link href={returnTo} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-[#151718] px-5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:border-[#00C2CB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C2CB]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {returnTo.startsWith("/onboarding/") ? "Back to onboarding" : "Back to Nettmark"}
      </Link>
    </nav>
  );
}
