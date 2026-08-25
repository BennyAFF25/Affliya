ALTER TABLE public.business_creatives
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS allow_organic boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS organic_preapproved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_preapproved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS thumbnail_path text,
  ADD COLUMN IF NOT EXISTS source_filename text;

UPDATE public.business_creatives
SET
  title = COALESCE(NULLIF(title, ''), 'Untitled creative'),
  media_type = COALESCE(
    NULLIF(media_type, ''),
    CASE
      WHEN COALESCE(media_url, '') ~* '\.(mp4|mov|webm)(\?|$)' THEN 'video'
      ELSE 'image'
    END
  ),
  is_active = COALESCE(is_active, true),
  allow_organic = COALESCE(allow_organic, true),
  allow_paid = COALESCE(allow_paid, false),
  organic_preapproved = COALESCE(organic_preapproved, false),
  paid_preapproved = COALESCE(paid_preapproved, false),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()))
WHERE true;

ALTER TABLE public.ad_ideas
  ADD COLUMN IF NOT EXISTS business_creative_id uuid;

ALTER TABLE public.organic_posts
  ADD COLUMN IF NOT EXISTS business_creative_id uuid;

CREATE INDEX IF NOT EXISTS business_creatives_lookup_idx
  ON public.business_creatives (business_email, is_active, offer_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS business_creatives_offer_scope_idx
  ON public.business_creatives (offer_id, business_email)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS ad_ideas_business_creative_idx
  ON public.ad_ideas (business_creative_id);

CREATE INDEX IF NOT EXISTS organic_posts_business_creative_idx
  ON public.organic_posts (business_creative_id);

CREATE TABLE IF NOT EXISTS public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'content_library_asset_uploaded',
    'content_library_asset_updated',
    'affiliate_brand_content_viewed',
    'affiliate_brand_content_selected',
    'promotion_started',
    'paid_promotion_submitted',
    'organic_promotion_submitted'
  )),
  actor_email text,
  actor_role text,
  offer_id uuid,
  business_creative_id uuid,
  promotion_type text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS product_events_event_type_created_idx
  ON public.product_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_offer_created_idx
  ON public.product_events (offer_id, created_at DESC);
