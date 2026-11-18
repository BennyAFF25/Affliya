import type { SupabaseClient } from '@supabase/supabase-js';
import { registerWebhooks } from './admin';
import { activatePixel } from './pixel';
import { validAccessToken, encryptedTokens } from './tokens';

export async function connectShop(admin: SupabaseClient, businessId: string, shop: string, scopes: string[], credentials: ReturnType<typeof encryptedTokens>, base: string) {
  const { data: existing, error: lookupError } = await admin.from("shopify_stores").select("id,business_id,status").eq("shop_domain", shop).maybeSingle();
  if (lookupError) throw new Error("database");
  if (existing && existing.business_id !== businessId && existing.status === "connected") throw new Error("shop_already_connected");
  const now = new Date().toISOString();
  const connection = { business_id: businessId, shop_domain: shop, ...credentials, scopes, status: "connected", pixel_status: "inactive", pixel_id: null, pixel_error: null, pixel_updated_at: now, installed_at: now, uninstalled_at: null, updated_at: now };
  // Insert cannot steal an existing unique domain if another callback won the race.
  if (existing) {
    const update = admin.from("shopify_stores").update(connection).eq("id", existing.id);
    const guarded = existing.business_id === businessId
      ? update.eq("business_id", businessId)
      : update.neq("status", "connected");
    const { data: saved, error } = await guarded.select("id").maybeSingle();
    if (error) throw new Error("database");
    if (!saved) throw new Error("shop_already_connected");
  } else {
    const { error } = await admin.from("shopify_stores").insert(connection);
    if (error) throw new Error(error.code === "23505" ? "shop_already_connected" : "database");
  }
  try { await registerWebhooks(shop, await validAccessToken(admin, shop, businessId), base); }
  catch { console.warn("[shopify] uninstall webhook registration failed", { shop }); }
  try {
    const pixel = await activatePixel(shop, await validAccessToken(admin, shop, businessId), base);
    const { error } = await admin.from("shopify_stores").update(pixel).eq("shop_domain", shop).eq("business_id", businessId).eq("status", "connected").eq("installed_at", now);
    if (error) throw new Error("database");
  } catch { console.warn("[shopify] pixel_status_failed", { shop }); }
}
