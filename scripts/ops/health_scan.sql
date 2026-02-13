\echo '--- Wallets with Negative Balance ---'
select email, balance
from wallets
where balance < 0;

\echo ''
\echo '--- Conversions Missing Affiliate ID ---'
select id, offer_id
from conversions
where affiliate_id is null;

\echo ''
\echo '--- Conversions Missing Offer ID ---'
select id
from conversions
where offer_id is null;

\echo ''
\echo '--- Live Ads Missing Meta Campaign ID ---'
select id
from live_ads
where meta_campaign_id is null;

\echo ''
\echo '--- Live Ads Spend Mismatch ---'
select id, spend, spend_transferred
from live_ads
where spend_transferred > spend;

\echo ''
\echo '--- Wallet Deductions Missing Ad ID ---'
select id
from wallet_deductions
where ad_id is null
  and created_at >= now() - interval '30 days';
