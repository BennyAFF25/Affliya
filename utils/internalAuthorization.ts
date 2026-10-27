// Shared existing ad-spend/settle cron authorization contract.
export function authorizeCronRequest(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return { ok: false, status: 500, error: 'SERVER_MISCONFIGURED' } as const;
  const ok = req.headers.get('authorization') === `Bearer ${cronSecret}` ||
    req.headers.get('x-cron-secret') === cronSecret;
  return ok ? { ok: true } as const : { ok: false, status: 401, error: 'UNAUTHORIZED' } as const;
}
