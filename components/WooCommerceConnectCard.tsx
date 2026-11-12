'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
type Store = { id: string; store_url: string; status: 'pending' | 'connected' | 'disconnected'; tracking_status: 'active' | 'inactive' | 'error'; tracking_error: string | null; last_event_at: string | null };
const errors: Record<string,string> = {
  not_woocommerce: 'This site does not advertise the WooCommerce REST API.', store_unreachable: 'We could not reach this store. Check the URL and try again.',
  invalid_store_url: 'Enter a public HTTPS store URL, including any store subdirectory.', store_already_connected: 'This store is already linked to another business.',
  already_connected: 'This store is already connected.', rate_limited: 'Too many attempts. Please try again later.',
  configuration: 'WooCommerce connection is not configured. Please contact support.', webhook_creation_failed: 'Order tracking could not be activated. Disconnect and reconnect to retry.',
  unauthorized: 'Please sign in again.', business_profile_required: 'Complete your business profile first.',
};
export default function WooCommerceConnectCard() {
  const router = useRouter();
  const [stores,setStores] = useState<Store[]>([]), [storeUrl,setStoreUrl] = useState(''), [busy,setBusy] = useState(false), [message,setMessage] = useState(''), [loaded,setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/woocommerce/status', { cache: 'no-store' }); const data = await response.json();
    if (!response.ok) throw new Error(data.error); setStores(data.stores || []); setLoaded(true);
    return data.stores as Store[];
  }, []);
  useEffect(() => {
    let cancelled = false; let timer: ReturnType<typeof setTimeout> | undefined; let attempts = 0;
    const params = new URLSearchParams(window.location.search), returned = params.get('woocommerce') === 'returned', success = params.get('success');
    if (returned) {
      setMessage(success === '0' ? 'Store approval was declined. You can try again.' : 'Checking your store connection…');
      for (const key of ['woocommerce','success','user_id']) params.delete(key);
      router.replace(`${window.location.pathname}${params.size ? `?${params}` : ''}${window.location.hash}`, { scroll: false });
    }
    const load = async () => {
      try { const current = await refresh(); if (!cancelled && returned && success !== '0') {
        if (current.some(s => s.status === 'connected')) setMessage('Store connected.');
        else if (++attempts < 6) timer = setTimeout(load, 2000);
        else setMessage('Approval is still pending. Refresh to check again, or disconnect and retry.');
      } }
      catch { if (!cancelled) setMessage('Unable to load WooCommerce status. Refresh to try again.'); }
    };
    void load(); return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [refresh,router]);
  async function act(action: 'connect' | 'disconnect', store?: Store) {
    if (action === 'disconnect' && !window.confirm('Disconnect WooCommerce tracking? Also revoke the “Nettmark” API key in WooCommerce → Settings → Advanced → REST API. Nettmark cannot revoke this key for you.')) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/woocommerce/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'connect' ? { storeUrl } : { storeId: store?.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (data.authorizeUrl) window.location.assign(data.authorizeUrl); else { await refresh(); setMessage('Disconnected. Revoke the Nettmark API key in your WooCommerce REST API settings.'); }
    } catch (error) { setMessage(errors[error instanceof Error ? error.message : ''] || 'Connection failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
    <h3 className="text-sm font-bold text-white">WooCommerce</h3>
    <p className="mt-1 text-xs leading-5 text-slate-400">Automatically track attributed sales. Approve in your store; no plugin or snippet needed.</p>
    {!loaded && <p className="mt-3 text-xs text-slate-400">Loading connection…</p>}
    {stores.filter(s => s.status !== 'disconnected').map(store => <div key={store.id} className="mt-4 space-y-2 text-xs text-slate-300">
      <p className="break-all">{store.store_url}</p>
      <p>{store.status === 'pending' ? 'Pending store approval' : `Tracking: ${store.tracking_status === 'active' ? 'Active' : store.tracking_status === 'error' ? 'Error' : 'Not active'}`}</p>
      {store.tracking_error && <p role="alert">{errors[store.tracking_error] || 'Tracking needs attention.'}</p>}
      <p>Last order received: {store.last_event_at ? new Date(store.last_event_at).toLocaleString() : 'None yet'}</p>
      <button disabled={busy} type="button" onClick={() => void act('disconnect',store)} className="min-h-10 rounded-full border border-white/10 px-4 font-semibold disabled:opacity-50">Disconnect</button>
    </div>)}
    <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void act('connect'); }}>
      <label className="block text-xs text-slate-300">Store URL<input required type="url" value={storeUrl} onChange={event => setStoreUrl(event.target.value)} placeholder="https://your-store.com" className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white" /></label>
      <button disabled={busy || !loaded} className="min-h-10 w-full rounded-full bg-[#00C2CB] px-4 text-xs font-bold text-black disabled:opacity-50">{busy ? 'Connecting…' : 'Connect WooCommerce'}</button>
    </form>
    {message && <p role="status" className="mt-3 text-xs leading-5 text-slate-300">{message}</p>}
  </div>;
}
