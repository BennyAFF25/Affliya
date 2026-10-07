-- Align the outbound affiliate webhook contract to the verified event list.
-- Historical broader events (inactivity/campaign/sale) are intentionally retired.

drop trigger if exists affiliate_webhook_live_ads on public.live_ads;

drop function if exists public.enqueue_inactive_affiliate_webhook_events(integer);
drop function if exists private.enqueue_inactive_affiliate_webhook_events(integer);

update public.affiliate_webhook_outbox
set status = 'skipped',
    delivered_at = coalesce(delivered_at, now()),
    last_error = 'Skipped: event is outside the verified outbound affiliate webhook contract.',
    lease_token = null,
    lease_until = null,
    updated_at = now()
where event_type in (
  'brand.inactive',
  'campaign.launched',
  'campaign.paused',
  'sale.attributed'
)
and status in ('pending', 'sending');
