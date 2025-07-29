"use client";
import { useState } from "react";
import { Banknote } from "lucide-react";

export default function ConnectStripeButton({
  businessEmail,
  className = "",
}: {
  businessEmail: string;
  className?: string;
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
      className={`bg-white text-[#00C2CB] font-semibold px-4 py-2 rounded shadow border border-[#00C2CB] hover:bg-[#e0fafa] transition flex items-center justify-center ${className}`}
    >
      <Banknote className="w-4 h-4 mr-2" />
      {loading ? "Connecting..." : "Connect to Stripe"}
    </button>
  );
}