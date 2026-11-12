import https from 'node:https';
import http from 'node:http';
import { resolveStore } from './url';
// Resolve once per request and pin the vetted address to the socket (DNS rebinding safe).
export async function storeRequest(store: string, path: string, options: { method?: string; body?: unknown; key?: string; secret?: string; queryAuth?: boolean } = {}): Promise<{ status: number; data: unknown }> {
  const target = await resolveStore(store), url = new URL(`${target.url}${path}`);
  const headers: Record<string,string> = { Accept: 'application/json' };
  if (options.key && options.secret) {
    if (options.queryAuth) {
      if (url.protocol !== 'https:') throw new Error('invalid_store_url');
      url.searchParams.set('consumer_key', options.key); url.searchParams.set('consumer_secret', options.secret);
    } else headers.Authorization = `Basic ${Buffer.from(`${options.key}:${options.secret}`).toString('base64')}`;
  }
  const body = options.body == null ? undefined : JSON.stringify(options.body);
  if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = String(Buffer.byteLength(body)); }
  const result = await new Promise<{ status: number; data: unknown }>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: options.method || 'GET', headers, family: target.family,
      // Node (autoSelectFamily) calls lookup with { all: true } and then expects an address array.
      lookup: ((_hostname: string, lookupOptions: { all?: boolean }, callback: (...args: unknown[]) => void) => lookupOptions?.all
        ? callback(null, [{ address: target.address, family: target.family }])
        : callback(null, target.address, target.family)) as never,
    }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 262144) request.destroy(new Error('store_unreachable')); else chunks.push(chunk); });
      response.on('end', () => {
        let data: unknown = null; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* No response body retained. */ }
        resolve({ status: response.statusCode || 503, data });
      });
      response.on('error', () => reject(new Error('store_unreachable')));
    });
    const timer = setTimeout(() => request.destroy(new Error('store_unreachable')), 15000);
    request.on('close', () => clearTimeout(timer));
    // Log only the transport error code (never the URL, which can carry credentials).
    request.on('error', (error: NodeJS.ErrnoException) => { console.warn('[woocommerce] store request failed', { code: error.code || error.message.slice(0, 40) }); reject(new Error('store_unreachable')); });
    request.end(body);
  });
  if (result.status === 401 && options.key && !options.queryAuth && new URL(store).protocol === 'https:') return storeRequest(store, path, { ...options, queryAuth: true });
  return result;
}
export async function wcRest(store: string, path: string, key: string, secret: string, method = 'GET', body?: unknown) {
  if (!/^\/webhooks(?:[/?]|$)/.test(path)) throw new Error('invalid_endpoint');
  const result = await storeRequest(store, `/wp-json/wc/v3${path}`, { key, secret, method, body });
  if (result.status < 200 || result.status >= 300) throw new Error('woocommerce_api_error');
  return result.data;
}
