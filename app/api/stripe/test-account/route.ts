// app/api/stripe/test-account/route.ts
import { createStripeClient } from '@/../utils/stripe';

export async function GET() {
  const stripe = createStripeClient();
  const me = await stripe.accounts.retrieve();

  // This will show in your server console
  const email = 'email' in me ? me.email : null;
  const businessProfile = 'business_profile' in me ? me.business_profile : null;

  console.log('[Stripe Platform Account]', me.id, email);

  return new Response(JSON.stringify({
    id: me.id,
    email,
    business_profile: businessProfile,
  }, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
