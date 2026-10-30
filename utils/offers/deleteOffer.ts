import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeOfferDeletion } from '../criticalRouteAuth';

export async function deleteOfferRequest(req: Request, id: string, deps: {
  getUser: (req: Request) => Promise<{ id: string; email?: string | null } | null>;
  database: () => SupabaseClient;
}) {
  try {
    const auth = await authorizeOfferDeletion(req, id, deps);
    if (auth.response) return auth.response;
    // One transaction checks dependencies, mutates the offer and queues the event.
    const { data, error } = await deps.database().rpc('delete_business_offer', { p_offer_id: id });
    if (error) throw error;
    if (!data) return Response.json({ error: 'Offer not found' }, { status: 404 });
    return Response.json({ ok: true, ...data });
  } catch (error) {
    console.error('[offer-delete] transaction failed', error);
    return Response.json({ error: 'Could not delete offer. Please try again.' }, { status: 500 });
  }
}
