import { callback } from '../../../../lib/woocommerce/connections';
import { createServerSupabaseClient } from '../../../../utils/supabase/createServerClient';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) { return callback(req, createServerSupabaseClient()); }
