"use client";

import { Suspense } from "react";
import SetupTrackingContent from "./SetupTrackingContent";

export default function SetupTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="setup-tracking-theme min-h-screen w-full bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)]">
          Loading…
        </div>
      }
    >
      <SetupTrackingContent />
    </Suspense>
  );
}
