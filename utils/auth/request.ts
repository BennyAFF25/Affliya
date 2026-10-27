export const AUTH_RETRY_MESSAGE = 'Too many attempts. Please wait a few minutes and try again.';
export function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length <= 254 && /^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(value.trim());
}
export function authJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
/** Bound actual streamed bytes, including when content-length is absent or dishonest. */
export async function readAuthBody(req: Request, maxBytes = 2048) {
  if (req.headers.get('origin') !== new URL(req.url).origin) throw new Error('Invalid origin.');
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('Please send JSON.');
  if (Number(req.headers.get('content-length')) > maxBytes) throw new Error('Request is too large.');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('Please enter valid details.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); throw new Error('Request is too large.'); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new Error('Please enter valid details (maximum request size 2 KB).'); }
  finally { reader.releaseLock(); }
}
