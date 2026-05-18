-- Add explicit Advantage Audience toggle for affiliate-submitted ad ideas
ALTER TABLE public.ad_ideas
ADD COLUMN IF NOT EXISTS advantage_audience boolean NOT NULL DEFAULT false;
