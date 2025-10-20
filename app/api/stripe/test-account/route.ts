// app/api/stripe/test-account/route.ts
import Stripe from 'stripe';

export async function GET() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
  const me = await stripe.accounts.retrieve();

  // This will show in your server console
  console.log('[Stripe Platform Account]', me.id, (me as any).email);

  return new Response(JSON.stringify({
    id: me.id,
    email: (me as any).email ?? null,
    business_profile: (me as any).business_profile ?? null,
  }, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}