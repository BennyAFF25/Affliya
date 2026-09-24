// app/api/meta/callback/route.ts

import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID?.trim() || ''
const META_APP_SECRET = process.env.META_APP_SECRET?.trim() || ''
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://www.nettmark.com'
const REDIRECT_URI = `${BASE_URL}/api/meta/callback`
const DEFAULT_RETURN_TO = '/business/my-business/connect-meta'

function safeRedirectFromState(state: string | null) {
  if (!state) return DEFAULT_RETURN_TO

  try {
    const decoded = Buffer.from(state, 'base64').toString('utf8')
    if (decoded.startsWith('/business/') && !decoded.startsWith('//')) return decoded
  } catch {
    // Ignore malformed state and use the safe default below.
  }

  if (state.startsWith('/business/') && !state.startsWith('//')) return state
  return DEFAULT_RETURN_TO
}

function redirectToMetaPage(state: string | null, params: Record<string, string>) {
  const returnTo = safeRedirectFromState(state)
  const url = new URL(returnTo, BASE_URL)

  // A failed callback must never retain a stale connected=1 flag from state.
  url.searchParams.delete('connected')
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

  return NextResponse.redirect(url)
}

function metaErrorDetails(payload: any) {
  const error = payload?.error
  if (!error) return null
  return {
    code: error.code ?? null,
    type: error.type ?? null,
    subcode: error.error_subcode ?? null,
    message: error.message ?? null,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')
  const oauthErrorReason = searchParams.get('error_reason')

  console.info('[meta-oauth] callback_started', {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    oauthError: oauthError || null,
  })

  if (oauthError) {
    console.warn('[meta-oauth] authorization_denied', {
      error: oauthError,
      reason: oauthErrorReason || null,
    })
    return redirectToMetaPage(state, {
      meta_error: oauthError === 'access_denied' ? 'authorization_cancelled' : 'authorization_failed',
    })
  }

  if (!code) {
    console.warn('[meta-oauth] callback_blocked', { reason: 'missing_code' })
    return redirectToMetaPage(state, { meta_error: 'missing_code' })
  }

  try {
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', META_APP_ID)
    tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    tokenUrl.searchParams.set('client_secret', META_APP_SECRET)
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json().catch(() => null)
    const access_token = tokenData?.access_token

    if (!tokenRes.ok || !access_token) {
      console.error('[meta-oauth] token_exchange_failed', {
        status: tokenRes.status,
        meta: metaErrorDetails(tokenData),
      })
      return redirectToMetaPage(state, { meta_error: 'token_exchange' })
    }

    console.info('[meta-oauth] token_exchange_success')

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const business_email = user?.email
    if (!business_email) {
      console.warn('[meta-oauth] callback_blocked', { reason: 'nettmark_session_missing' })
      return redirectToMetaPage(state, { meta_error: 'nettmark_session' })
    }

    // We only need the Meta user's name here. Nettmark already knows the signed-in
    // business email, so don't make Meta's email permission part of this flow.
    const metaUserRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=name&access_token=${encodeURIComponent(access_token)}`
    )
    const metaUser = await metaUserRes.json().catch(() => null)

    if (!metaUserRes.ok || metaUser?.error) {
      console.error('[meta-oauth] user_fetch_failed', {
        status: metaUserRes.status,
        meta: metaErrorDetails(metaUser),
      })
      return redirectToMetaPage(state, { meta_error: 'user_fetch' })
    }

    const meta_user_name = metaUser?.name ?? null
    const meta_user_email = null
    console.info('[meta-oauth] user_fetch_success')

    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,currency&access_token=${encodeURIComponent(access_token)}`
    )
    const adAccountsJson = await adAccountsRes.json().catch(() => null)

    if (!adAccountsRes.ok || adAccountsJson?.error) {
      console.error('[meta-oauth] ad_accounts_fetch_failed', {
        status: adAccountsRes.status,
        meta: metaErrorDetails(adAccountsJson),
      })
      return redirectToMetaPage(state, { meta_error: 'ad_accounts_fetch' })
    }

    const adAccounts = Array.isArray(adAccountsJson?.data) ? adAccountsJson.data : []
    console.info('[meta-oauth] ad_accounts_fetch_success', { count: adAccounts.length })

    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name&access_token=${encodeURIComponent(access_token)}`
    )
    const pagesJson = await pagesRes.json().catch(() => null)

    if (!pagesRes.ok || pagesJson?.error) {
      console.error('[meta-oauth] pages_fetch_failed', {
        status: pagesRes.status,
        meta: metaErrorDetails(pagesJson),
      })
      return redirectToMetaPage(state, { meta_error: 'pages_fetch' })
    }

    const pages = Array.isArray(pagesJson?.data) ? pagesJson.data : []
    console.info('[meta-oauth] pages_fetch_success', { count: pages.length })

    if (!adAccounts.length) {
      console.info('[meta-oauth] callback_blocked', { reason: 'no_ad_account' })
      return redirectToMetaPage(state, { meta_error: 'no_ad_account' })
    }

    if (!pages.length) {
      console.info('[meta-oauth] callback_blocked', { reason: 'no_page' })
      return redirectToMetaPage(state, { meta_error: 'no_page' })
    }

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

    const { error: upsertError } = await supabase
      .from('meta_connections')
      .upsert(rows, { onConflict: 'business_email,ad_account_id,page_id' })

    if (upsertError) {
      console.error('[meta-oauth] connection_save_failed', {
        code: upsertError.code || null,
        message: upsertError.message,
      })
      return redirectToMetaPage(state, { meta_error: 'connection_save' })
    }

    console.info('[meta-oauth] connection_saved', { rows: rows.length })
    console.info('[meta-oauth] callback_complete')
    return redirectToMetaPage(state, { connected: '1' })
  } catch (err: any) {
    console.error('[meta-oauth] callback_unexpected_error', {
      message: err?.message || 'Unknown error',
    })
    return redirectToMetaPage(state, { meta_error: 'unexpected' })
  }
}
