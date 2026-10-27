import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { authorizeCronRequest } from './internalAuthorization';
import { withCriticalRouteAuth, type CriticalRoute } from './criticalRouteAuth';
import type { SupabaseClient } from '@supabase/supabase-js';

export function protectCriticalRoute(route: CriticalRoute, work: (req: Request) => Promise<Response>, database: () => Pick<SupabaseClient, 'from'>) {
  return withCriticalRouteAuth(route, work, {
    database,
    trusted: req => authorizeCronRequest(req).ok,
    getUser: async req => {
      const client = createRouteHandlerClient({ cookies });
      const header = req.headers.get('authorization');
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      const { data, error } = await client.auth.getUser(token);
      return error ? null : data.user;
    },
  });
}
