"use client";
import React from "react";
import { supabase } from "@/../utils/supabase/pages-client";

export default function LoginPage() {
  const handleLogin = async (userType: "affiliate" | "business") => {
    // Optional: store user type in localStorage if needed for routing post-login
    localStorage.setItem("userType", userType);

    await supabase.auth.signInWithOAuth({
      provider: "google",
    });
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