import { createHash, createHmac, timingSafeEqual, randomBytes, hkdfSync, createCipheriv, createDecipheriv } from 'node:crypto';
export const nonce = () => randomBytes(32).toString('base64url');
export const nonceHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function deriveKey(value = process.env.WOOCOMMERCE_ENCRYPTION_KEY || process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || ''): Buffer {
  if (!/^(?:[a-fA-F0-9]{64}|[A-Za-z0-9+/]{43}=)$/.test(value)) throw new Error('configuration');
  return Buffer.from(hkdfSync('sha256', Buffer.from(value, /^[a-fA-F0-9]{64}$/.test(value) ? 'hex' : 'base64'), Buffer.alloc(0), 'nettmark-woocommerce-v1', 32));
}
export function encrypt(value: string, key?: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', deriveKey(key), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}
export function decrypt(value: string, key?: string): string {
  const [version, iv, tag, data, extra] = value.split(':');
  if (version !== 'v1' || !iv || !tag || !data || extra) throw new Error('invalid_ciphertext');
  const cipher = createDecipheriv('aes-256-gcm', deriveKey(key), Buffer.from(iv, 'base64'));
  cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([cipher.update(Buffer.from(data, 'base64')), cipher.final()]).toString('utf8');
}
export function verifySignature(raw: Buffer, signature: string | null, secret: string): boolean {
  if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const actual = Buffer.from(signature, 'base64'), expected = createHmac('sha256', secret).update(raw).digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function readBody(req: Request, cap: number): Promise<Buffer> {
  if (Number(req.headers.get('content-length')) > cap) throw new Error('invalid_payload');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('invalid_payload');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > cap) { void reader.cancel().catch(() => {}); throw new Error('invalid_payload'); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}
export function baseUrl(req: Request): string { return new URL(process.env.NEXT_PUBLIC_BASE_URL?.trim() || req.url).origin; }
export function deliveryUrl(req: Request, path: string): string {
  const url = new URL(path, baseUrl(req));
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()) url.searchParams.set('x-vercel-protection-bypass', process.env.VERCEL_AUTOMATION_BYPASS_SECRET.trim());
  return url.toString();
}
