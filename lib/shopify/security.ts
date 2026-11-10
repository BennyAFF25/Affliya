import { createHmac, timingSafeEqual, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("configuration");
  return value;
}
export function validShop(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) && !/[\r\n]/.test(shop);
}
export function normalizeShop(input: string): string {
  let shop = input.trim().toLowerCase().replace(/^https:\/\//, "").replace(/\/$/, "");
  if (!shop.includes(".")) shop += ".myshopify.com";
  if (!validShop(shop)) throw new Error("invalid_shop");
  return shop;
}
function equal(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
export function verifyOAuthHmac(params: URLSearchParams, secret: string): boolean {
  const hmac = params.get("hmac") || "";
  if (hmac.length !== 64 || !/^[a-fA-F0-9]{64}$/.test(hmac) || params.getAll("hmac").length !== 1) return false;
  // Reject ambiguous duplicate parameters instead of interpreting them differently downstream.
  const keys = Array.from(params.keys());
  if (new Set(keys).size !== keys.length) return false;
  const message = Array.from(params.entries()).filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join("&");
  return equal(Buffer.from(hmac, "hex"), createHmac("sha256", secret).update(message).digest());
}
export function verifyWebhookHmac(raw: Buffer, header: string | null, secret: string): boolean {
  if (!header || header.length !== 44 || !/^[A-Za-z0-9+/]{43}=$/.test(header)) return false;
  return equal(Buffer.from(header, "base64"), createHmac("sha256", secret).update(raw).digest());
}
export type OAuthState = { nonce: string; userId: string; businessId: string; shop: string; issuedAt: number };
export function signState(state: OAuthState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function verifyState(value: string, nonce: string | undefined, secret: string, now = Date.now()): OAuthState {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || signature.length !== 43 || extra || !/^[\w-]{43}$/.test(signature) ||
      !equal(Buffer.from(signature, "base64url"), createHmac("sha256", secret).update(payload).digest())) throw new Error("invalid_state");
  const state: OAuthState = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (!state || typeof state.nonce !== "string" || !nonce || !equal(Buffer.from(state.nonce), Buffer.from(nonce)) ||
      typeof state.userId !== "string" || !state.userId || typeof state.businessId !== "string" || !state.businessId ||
      typeof state.shop !== "string" || !validShop(state.shop) || !Number.isFinite(state.issuedAt) ||
      now < state.issuedAt || now - state.issuedAt > 10 * 60 * 1000) throw new Error("invalid_state");
  return state;
}
export function stateSecret(): string { return process.env.SHOPIFY_STATE_SECRET?.trim() || env("SHOPIFY_CLIENT_SECRET"); }
export function nonce(): string { return randomBytes(32).toString("base64url"); }
export function requiredScopes(): string[] {
  const scopes = (process.env.SHOPIFY_SCOPES ?? "read_products,write_pixels,read_customer_events").split(",").map(s => s.trim()).filter(Boolean);
  // Stage one deliberately excludes order access and protected customer data.
  const allowed = new Set(["read_products", "write_pixels", "read_pixels", "read_customer_events"]);
  if (!scopes.length || scopes.some(s => !allowed.has(s))) throw new Error("invalid_scopes_configuration");
  return Array.from(new Set(scopes));
}
export function hasRequiredScopes(granted: string[], required: string[]): boolean {
  return required.every(scope => granted.includes(scope));
}
function encryptionKey(value = env("SHOPIFY_TOKEN_ENCRYPTION_KEY")): Buffer {
  if (!/^(?:[a-fA-F0-9]{64}|[A-Za-z0-9+/]{43}=)$/.test(value)) throw new Error("configuration");
  const key = Buffer.from(value, /^[a-fA-F0-9]{64}$/.test(value) ? "hex" : "base64");
  if (key.length !== 32) throw new Error("configuration");
  return key;
}
export function encryptToken(token: string, key?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}
export function decryptToken(value: string, key?: string): string {
  const [version, iv, tag, ciphertext, extra] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra) throw new Error("invalid_token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(key), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
