import { partnerAccess } from '../../../../utils/growthPartners/access';
export async function POST(req: Request) {
  const access = await partnerAccess();
  if (!access) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { db, user } = access;
  const { data: profile, error } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (error) return Response.json({ error: 'Profile unavailable' }, { status: 503 });
  if (profile?.role === 'business') return Response.json({ error: 'This account already has a business profile. Your Growth Partner account remains available.' }, { status: 409 });
  if (!profile) {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) return Response.json({ error: 'Choose a username with 3–30 letters, numbers or underscores.' }, { status: 400 });
    // Uses the same profiles INSERT and its affiliate provisioning triggers as canonical signup.
    const { error: insertError } = await db.from('profiles').insert({ id: user.id, email: user.email!.toLowerCase(), role: 'affiliate', username });
    if (insertError) return Response.json({ error: 'Could not join. The username may already be taken; refresh or choose another.' }, { status: 409 });
  }
  return Response.json({ redirect: '/onboarding/for-partners' });
}
