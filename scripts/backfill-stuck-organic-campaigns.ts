import type { SupabaseClient } from '@supabase/supabase-js';
import { approveOrganicPost } from '../utils/organicCampaignApproval';

export const PRIMARY_POST_IDS = ['259ffa4c-8c2a-445d-8597-a17b6eb35b95', '8d78e331-c463-40a5-9696-388b551f7f51', '3e025ae5-c432-4367-b5d0-5f809be03589'];
export const OLDER_POST_IDS = ['da48433a-bb73-4ae6-9c1f-c3ce5679ca2f', '918e9a34-bcf3-406a-b730-9f49dacc38fa', '15cbc324-1883-4a12-94f4-52877a3af116'];
export function parseBackfillArgs(args: string[]) {
  const ids: string[] = [];
  let apply = false, includeOlder = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') apply = true;
    else if (arg === '--include-older') includeOlder = true;
    else if (arg === '--post-ids') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error('--post-ids requires comma-separated UUIDs');
      ids.push(...value.split(','));
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!ids.length) throw new Error('Explicit --post-ids is required; default is read-only dry run.');
  for (const id of ids) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid post UUID');
    if (![...PRIMARY_POST_IDS, ...OLDER_POST_IDS].includes(id)) throw new Error('Post is outside the reviewed recovery list');
    if (OLDER_POST_IDS.includes(id) && !includeOlder) throw new Error('Older candidates require --include-older');
  }
  return { ids: [...new Set(ids)], apply };
}
export async function backfillPosts(client: SupabaseClient, options: ReturnType<typeof parseBackfillArgs>) {
  const results = [];
  for (const postId of options.ids) {
    try {
      const post = await client.from('organic_posts').select('status,offer_id,affiliate_email,business_email').eq('id', postId).maybeSingle();
      if (post.error || !post.data || post.data.status !== 'approved') {
        results.push({ postId, success: false, error: 'Expected an existing approved post' }); continue;
      }
      // Older working flows did not link organic_posts. Do not duplicate those campaigns.
      const pair = await client.from('live_campaigns').select('id').eq('offer_id', post.data.offer_id)
        .eq('affiliate_email', post.data.affiliate_email).eq('business_email', post.data.business_email).eq('type', 'organic');
      if (pair.error) throw new Error('Campaign verification failed');
      if ((pair.data || []).some(row => row.id !== postId)) {
        results.push({ postId, success: false, error: 'Existing organic campaign for offer/affiliate; manual mapping review required' }); continue;
      }
      const profile = await client.from('business_profiles').select('stripe_customer_id').eq('business_email', post.data.business_email).maybeSingle();
      results.push({ postId, commissionCustomerPresent: profile.error ? 'unknown' : Boolean(profile.data?.stripe_customer_id),
        commissionCardReadiness: 'not_checked', ...await approveOrganicPost(client, postId, { dryRun: !options.apply }),
        databaseGate: 'Organic is paid-gate exempt in checked-in SQL; dry run cannot prove deployed triggers. Apply fails closed.',
      });
    } catch {
      // Do not print SDK errors, connection strings, post content or credentials.
      results.push({ postId, success: false, error: 'Readiness or database operation failed; inspect privately before retrying' });
    }
  }
  return results;
}
async function main() {
  const options = parseBackfillArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const { createClient } = await import('@supabase/supabase-js');
  const results = await backfillPosts(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), options);
  console.log(JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', results }, null, 2));
  if (results.some(result => !result.success)) process.exitCode = 1;
}
if (require.main === module) void main().catch(() => { console.error('Backfill aborted. Verify flags and required environment privately.'); process.exitCode = 1; });
