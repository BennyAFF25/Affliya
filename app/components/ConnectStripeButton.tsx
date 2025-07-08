"use client";
import { useState } from "react";

export default function ConnectStripeButton({
  businessEmail,
}: {
  businessEmail: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    const res = await fetch("/api/stripe/create-business-account-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessEmail, country: "AU" }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Error: " + data.error);
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="bg-[#00C2CB] text-white font-semibold px-4 py-2 rounded shadow hover:bg-[#00b0b8] transition"
    >
      {loading ? "Connecting..." : "Connect Stripe for Payouts"}
    </button>
  );
}