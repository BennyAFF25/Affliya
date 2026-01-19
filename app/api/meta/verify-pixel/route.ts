import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const pixelId = process.env.META_PIXEL_ID
    const token = process.env.META_SYSTEM_USER_TOKEN

    if (!pixelId || !token) {
      return NextResponse.json(
        { error: 'Meta pixel or token missing' },
        { status: 400 }
      )
    }

    // READ pixel activity (event_stats is readable)
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}?fields=event_stats&access_token=${token}`,
      { method: 'GET' }
    )

    const data = await res.json()

    if (!res.ok || !data?.event_stats || data.event_stats.length === 0) {
      return NextResponse.json(
        { error: 'No pixel events detected yet' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[verify-pixel]', err)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}