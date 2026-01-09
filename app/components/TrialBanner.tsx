"use client";

import { useEffect, useState } from "react";

type Props = {
  status: string | null;
  periodEnd: string | null;
};

export default function TrialBanner({ status, periodEnd }: Props) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!periodEnd) return;

    const end = new Date(periodEnd).getTime();
    const now = Date.now();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    setDaysLeft(diff);
  }, [periodEnd]);

  if (status !== "trialing" || daysLeft === null) return null;

  return (
    <div className="mb-6 rounded-lg border border-yellow-400 bg-yellow-400/10 px-4 py-3 text-yellow-200">
      <strong>Free trial active</strong> — {daysLeft} day
      {daysLeft !== 1 ? "s" : ""} remaining.
      <span className="ml-2 text-sm opacity-80">
        Add payment details to avoid interruption.
      </span>
    </div>
  );
}