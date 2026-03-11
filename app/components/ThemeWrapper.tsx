"use client";

import React, { useEffect } from "react";
import { useTheme } from "@/../context/ThemeContext";

export default function ThemeWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.remove("light", "dark");
    body.classList.remove("light", "dark");

    root.classList.add(theme);
    body.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
