import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import admin from 'utils/supabase/server-client';
import { deleteOfferRequest } from 'utils/offers/deleteOffer';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return deleteOfferRequest(req, id, {
    database: () => admin,
    getUser: async request => {
      const client = createRouteHandlerClient({ cookies });
      const header = request.headers.get('authorization');
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      const { data, error } = await client.auth.getUser(token);
      return error ? null : data.user;
    },
  });
}
