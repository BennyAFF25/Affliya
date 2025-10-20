

import Stripe from 'stripe';

// POST /api/stripe/create-customer
// Body: { email: string, name?: string, paymentMethodId?: string }
export async function POST(request: Request) {
  try {
    const { email, name, paymentMethodId } = await request.json();

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid "email"' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });

    // 1) Create a Customer (idempotency should be handled by your app DB; here we always create)
    const customer = await stripe.customers.create({
      email,
      name: typeof name === 'string' ? name : undefined,
    });

    // 2) Optionally attach a provided payment method and set as default
    if (paymentMethodId && typeof paymentMethodId === 'string') {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    const payload = { customerId: customer.id };
    console.log('[Stripe] Created business customer', payload);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[Stripe create-customer error]', err);
    return new Response(
      JSON.stringify({
        error: err?.message || 'Stripe error',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
}