"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createPagesBrowserClient();

  const handleLogin = async (userType: "affiliate" | "business") => {
    // Store user type to use after login redirection
    localStorage.setItem("userType", userType);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/redirect?type=${userType}`, // 👈 this handles smart routing
      },
    });

    if (error) {
      console.error("❌ Login error:", error.message);
    }
  };

  return (
    <div className="flex flex-col h-screen justify-center items-center gap-6">
      <h1 className="text-2xl font-bold">Choose Login Type</h1>

      <button
        onClick={() => handleLogin("affiliate")}
        className="bg-blue-600 text-white px-6 py-3 rounded-xl"
      >
        Affiliate Login / Sign Up
      </button>

      <button
        onClick={() => handleLogin("business")}
        className="bg-green-600 text-white px-6 py-3 rounded-xl"
      >
        Business Login / Sign Up
      </button>
    </div>
  );
}