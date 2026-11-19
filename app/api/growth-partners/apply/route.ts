import { createServerSupabaseClient } from '../../../../utils/businessSubscriptions';
import { submitGrowthApplication } from '../../../../utils/growthPartners/applications';
import { authRateLimit } from '../../../../utils/auth/rateLimit';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  try {
    if (Number(req.headers.get('content-length') || 0) > 16000) return Response.json({ error: 'Request too large' }, { status: 413 });
    const body = await req.json();
    if (!await authRateLimit(req, 'signup', typeof body.email === 'string' ? body.email.slice(0,254) : undefined)) return Response.json({ error: 'Please try again later.' }, { status: 429 });
    return Response.json(await submitGrowthApplication(createServerSupabaseClient(), body, req));
  } catch { return Response.json({ error: 'Please check your details and try again.' }, { status: 400 }); }
}
