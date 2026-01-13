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
    /* -----------------------------------------
       Exchange code → access token
    ----------------------------------------- */
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
        `?client_id=${META_APP_ID}` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&client_secret=${META_APP_SECRET}` +
        `&code=${code}`
    )

    const tokenData = await tokenRes.json()
    const access_token = tokenData.access_token

    if (!access_token) {
      return NextResponse.json({ error: 'No access token received' }, { status: 401 })
    }

    /* -----------------------------------------
       Supabase + user
    ----------------------------------------- */
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const business_email = user?.email
    if (!business_email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    /* -----------------------------------------
       Meta user
    ----------------------------------------- */
    const metaUserRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=name,email&access_token=${access_token}`
    )
    const metaUser = await metaUserRes.json()

    const meta_user_name = metaUser.name ?? null
    const meta_user_email = metaUser.email ?? null

    /* -----------------------------------------
       Fetch ALL ad accounts
    ----------------------------------------- */
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,currency&access_token=${access_token}`
    )
    const adAccountsJson = await adAccountsRes.json()
    const adAccounts = adAccountsJson.data || []

    /* -----------------------------------------
       Fetch ALL pages
    ----------------------------------------- */
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name&access_token=${access_token}`
    )
    const pagesJson = await pagesRes.json()
    const pages = pagesJson.data || []

    if (!adAccounts.length || !pages.length) {
      return NextResponse.json(
        { error: 'No ad accounts or pages returned from Meta' },
        { status: 400 }
      )
    }

    /* -----------------------------------------
       Build rows: PAGE × AD ACCOUNT
    ----------------------------------------- */
    const rows = []

    for (const adAccount of adAccounts) {
      for (const page of pages) {
        rows.push({
          business_email,
          meta_user_email,
          meta_user_name,
          ad_account_id: adAccount.id,
          ad_account_name: adAccount.name,
          ad_account_currency: adAccount.currency,
          page_id: page.id,
          page_name: page.name,
          access_token,
        })
      }
    }

    /* -----------------------------------------
       Upsert safely (NO overwrite)
    ----------------------------------------- */
    const { error: upsertError } = await supabase
      .from('meta_connections')
      .upsert(rows, {
        onConflict: 'business_email,ad_account_id,page_id',
      })

    if (upsertError) {
      console.error('[❌ Meta upsert error]', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/business/my-business`
    )
  } catch (err: any) {
    console.error('[❌ Meta callback error]', err)
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}