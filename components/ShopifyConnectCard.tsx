"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { stripShopifyParams } from "../lib/shopify/callback-params";

type Store = { id: string; shop_domain: string; status: string };
const connectionErrors: Record<string, string> = {
  unauthorized: "Please sign in as a business and try again.",
  forbidden: "Please sign in as a business and try again.",
  invalid_shop: "Enter your store's myshopify.com domain, e.g. mystore.myshopify.com.",
  shop_already_connected: "This store is already connected to another Nettmark business.",
  missing_scopes: "Shopify didn't grant the permissions Nettmark needs. Please approve all requested permissions.",
};
const buttonClass = "mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#00C2CB]/30 bg-[#00C2CB]/10 px-4 text-xs font-bold text-[#7ff5fb] disabled:opacity-50";
export default function ShopifyConnectCard() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/shopify/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load Shopify connection. Please try again.");
    const data = await response.json();
    setStores(data.stores);
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("shopify_error")) setMessage(connectionErrors[params.get("shopify_error") || ""] || "Could not connect Shopify. Please try again.");
    else if (params.get("shopify") === "connected") setMessage("Shopify store connected.");
    const search = stripShopifyParams(window.location.search);
    if (search !== null) {
      router.replace(`${window.location.pathname}${search}${window.location.hash}`, { scroll: false });
    }
    load().catch(error => setMessage(error.message)).finally(() => setLoading(false));
  }, [router]);
  async function disconnect(id: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/shopify/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error("Could not disconnect Shopify. Please try again.");
      await load();
      setMessage("Shopify disconnected.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not disconnect Shopify."); }
    finally { setBusy(false); }
  }
  const connected = stores.filter(store => store.status === "connected");
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-black/10 p-4" aria-label="Shopify connection">
      <h3 className="text-sm font-bold text-white">Connect Shopify store</h3>
      <p className="mt-1 text-xs leading-5 text-slate-400">Optional: connect your store. Product import and automatic tracking are coming later.</p>
      {loading ? <p className="mt-3 text-xs text-slate-400">Loading connection…</p> : connected.length ? connected.map(store => (
        <div key={store.id} className="mt-3">
          <p className="break-all text-sm text-white">{store.shop_domain} · Connected</p>
          <button type="button" className={buttonClass} disabled={busy} onClick={() => disconnect(store.id)}>Disconnect</button>
        </div>
      )) : (
        <form action="/api/shopify/install" method="get" className="mt-3">
          <label htmlFor="shopify-shop" className="text-xs text-slate-400">Shop domain</label>
          <input id="shopify-shop" name="shop" required placeholder="mystore.myshopify.com" autoCapitalize="none" autoCorrect="off" className="mt-2 block min-h-[44px] w-full rounded-xl border border-white/10 bg-black/10 px-3 text-sm text-white" />
          <button type="submit" className={buttonClass}>Connect Shopify store</button>
        </form>
      )}
      {message && <p role="status" className="mt-3 text-xs text-slate-400">{message}</p>}
    </section>
  );
}
