// app/api/meta/callback/route.ts

import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID!
const META_APP_SECRET = process.env.META_APP_SECRET!
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/callback`

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${META_APP_SECRET}&code=${code}`
    )
    const tokenData = await tokenRes.json()
    console.log('[🧪 Token Exchange Response]', tokenData)

    const access_token = tokenData.access_token
    if (!access_token) {
      return NextResponse.json({ error: 'No token received' }, { status: 401 })
    }

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const business_email = user?.email
    if (!business_email) {
      return NextResponse.json({ error: 'No business user found' }, { status: 401 })
    }

    const metaUserRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=email,name&access_token=${access_token}`
    )
    const metaUser = await metaUserRes.json()
    const meta_user_email = metaUser.email
    const meta_user_name = metaUser.name

    const adAccountsRes = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?access_token=${access_token}`)
    const adAccounts = await adAccountsRes.json()
    const ad_account_id = adAccounts.data?.[0]?.id

    const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${access_token}`)
    const pages = await pagesRes.json()
    const page_id = pages.data?.[0]?.id

    await supabase.from('meta_connections').upsert({
      business_email,
      meta_user_email,
      meta_user_name,
      ad_account_id,
      page_id,
      access_token,
    })

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/business/my-business`)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}