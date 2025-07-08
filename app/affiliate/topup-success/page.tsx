'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';
export default function TopupSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('Processing your top-up...');

  useEffect(() => {
    const insertTransaction = async () => {
      const sessionId = params.get('session_id');
      if (!sessionId) {
        setMessage('No session ID found.');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email;
      if (!email) {
        setMessage('No user session found.');
        return;
      }

      try {
        const stripeRes = await fetch('/api/stripe-session?session_id=' + sessionId);
        const stripeSession = await stripeRes.json();

        const amount_gross = stripeSession.amount_total / 100;
        const amount_net = stripeSession.amount_subtotal / 100;
        const fees = amount_gross - amount_net;

        const { error } = await supabase.from('wallet_topups').insert({
          affiliate_email: email,
          stripe_id: stripeSession.id,
          status: 'succeeded',
          amount_gross,
          amount_net,
          stripe_fees: fees,
        });

        if (error) {
          console.error('Insert error:', error);
          setMessage('Failed to record your top-up.');
        } else {
          setMessage(`Top-up of $${amount_net.toFixed(2)} successfully recorded.`);
        }
      } catch (err) {
        console.error('Stripe fetch error:', err);
        setMessage('Error fetching Stripe session.');
      }
    };

    insertTransaction();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <p className="text-lg">{message}</p>
    </div>
  );
}