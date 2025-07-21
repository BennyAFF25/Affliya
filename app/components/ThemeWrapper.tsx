'use client'

import React, { useEffect } from 'react'
import { useTheme } from '@/../context/ThemeContext' // ✅ make sure this path is right

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()

  useEffect(() => {
    document.body.className = theme // Apply theme class directly to body
  }, [theme])

  return <>{children}</>
}