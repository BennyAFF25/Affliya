import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
export function publicAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a,b] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
  }
  // Only global unicast IPv6; exclude mapped/compatible, local, multicast and transition networks.
  return isIP(ip) === 6 && /^[23]/i.test(ip) && !/^2001:(?:0:|db8:|10:|20:)/i.test(ip) && !/^2002:/i.test(ip);
}
export function normalizeStoreUrl(input: string): string {
  let url: URL; try { url = new URL(input.trim()); } catch { throw new Error('invalid_store_url'); }
  const local = process.env.NODE_ENV === 'development' && url.hostname === 'localhost' && url.protocol === 'http:';
  if ((!local && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) throw new Error('invalid_store_url');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!local && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || (isIP(host) && !publicAddress(host)))) throw new Error('invalid_store_url');
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}
export async function resolveStore(input: string, resolve = lookup): Promise<{ url: string; address: string; family: number }> {
  const url = normalizeStoreUrl(input), host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    resolve(host, { all: true }).catch(() => { throw new Error('store_unreachable'); }),
    new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('store_unreachable')), 15000); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
  const local = process.env.NODE_ENV === 'development' && host === 'localhost';
  if (!addresses.length || (!local && addresses.some(a => !publicAddress(a.address)))) throw new Error('invalid_store_url');
  // Prefer IPv4: serverless egress (e.g. Vercel/AWS) often has no IPv6 route, so a v6-first pin hangs.
  return { url, ...(addresses.find(a => a.family === 4) || addresses[0]) };
}
