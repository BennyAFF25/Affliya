import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ProductCard } from "../components/ProductCard";
import { ShopHero } from "../components/ShopHero";
import { ShopGrid } from "../components/ShopGrid";
import type { ShopThemeKey } from "../theme";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface ShopOffer {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  logo_url: string | null;
  website: string | null;
}

interface ShopItemOverride {
  offer_id: string;
  custom_image_url: string | null;
  custom_price: string | null;
  custom_description: string | null;
  display_order: number | null;
}

interface ShopSettingsRow {
  theme?: ShopThemeKey | null;
  hero_image_url?: string | null;
  hero_blurb?: string | null;
}

const formatPrice = (price: number | null, currency: string | null) => {
  if (!price || !currency) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(price);
};

async function getShopData(handle: string) {
  const normalizedHandle = handle.trim().toLowerCase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, username")
    .ilike("username", normalizedHandle)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const affiliateEmail = profile.email;
  const affiliateId = profile.id;

  const { data: affiliateProfile } = await supabase
    .from("affiliate_profiles")
    .select("display_name, avatar_url, bio")
    .eq("email", affiliateEmail)
    .maybeSingle();

  const { data: approved } = await supabase
    .from("affiliate_requests")
    .select("offer_id")
    .eq("affiliate_email", affiliateEmail)
    .eq("status", "approved");

  const affiliateInfo = {
    id: affiliateId,
    email: affiliateEmail,
    name: affiliateProfile?.display_name || profile.username || affiliateEmail,
    avatar_url: affiliateProfile?.avatar_url || null,
    bio: (affiliateProfile as any)?.bio || null,
  };

  if (!approved || approved.length === 0) {
    return {
      affiliate: affiliateInfo,
      offers: [],
      settings: {
        theme: "midnight" as ShopThemeKey,
        hero_image_url: null,
        hero_blurb: null,
      },
      metrics: {
        averagePrice: null,
        views24h: 0,
        clicks24h: 0,
      },
    };
  }

  const offerIds = approved.map((row) => row.offer_id);

  const { data: offers } = await supabase
    .from("offers")
    .select("id, title, description, price, currency, logo_url, website")
    .in("id", offerIds);

  const { data: overrides } = await supabase
    .from("affiliate_shop_items")
    .select(
      "offer_id, custom_image_url, custom_price, custom_description, display_order",
    )
    .eq("affiliate_email", affiliateEmail)
    .in("offer_id", offerIds);

  const overrideMap = new Map<string, ShopItemOverride>();
  overrides?.forEach((row) => {
    overrideMap.set(row.offer_id, row);
  });

  const cards = (offers || []).map((offer) => {
    const override = overrideMap.get(offer.id);
    return {
      id: offer.id,
      title: offer.title,
      description: override?.custom_description ?? offer.description,
      priceLabel:
        override?.custom_price ?? formatPrice(offer.price, offer.currency),
      image: override?.custom_image_url ?? offer.logo_url,
      order: override?.display_order ?? 0,
      website: offer.website,
      priceValue: offer.price,
      currency: offer.currency,
    };
  });

  cards.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  const priceSamples = cards.filter(
    (card) =>
      typeof card.priceValue === "number" && card.priceValue && card.currency,
  );

  const averagePrice = priceSamples.length
    ? formatPrice(
        priceSamples.reduce((sum, card) => sum + (card.priceValue || 0), 0) /
          priceSamples.length,
        priceSamples[0].currency,
      )
    : null;

  const { data: settingsRow } = await supabase
    .from("affiliate_shop_settings")
    .select("theme, hero_image_url, hero_blurb")
    .eq("affiliate_email", affiliateEmail)
    .maybeSingle();

  const settings: ShopSettingsRow = settingsRow || {};

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: hitRows } = await supabase
    .from("shop_hits")
    .select("views, clicks, event_date")
    .eq("affiliate_email", affiliateEmail)
    .gte("event_date", dayAgo);

  const views24h =
    hitRows?.reduce((sum, row) => sum + (row.views ?? 0), 0) ?? 0;
  const clicks24h =
    hitRows?.reduce((sum, row) => sum + (row.clicks ?? 0), 0) ?? 0;

  return {
    affiliate: affiliateInfo,
    offers: cards,
    settings: {
      theme: (settings.theme as ShopThemeKey) || "midnight",
      hero_image_url: settings.hero_image_url || null,
      hero_blurb: settings.hero_blurb || null,
    },
    metrics: {
      averagePrice,
      views24h,
      clicks24h,
    },
  };
}

export default async function ShopPage({
  params,
}: {
  params: { handle: string };
}) {
  const data = await getShopData(params.handle);

  if (!data) {
    notFound();
  }

  // Increment view count asynchronously (best-effort)
  try {
    await supabase.rpc("increment_shop_hit", {
      p_affiliate_email: data!.affiliate.email,
      p_kind: "view",
    });
  } catch (err) {
    console.warn("[shop] increment view failed", err);
  }

  const shopUrl = `https://www.nettmark.com/shop/${params.handle}`;
  const stats = [
    {
      label: "Offers live",
      value: data!.offers.length
        ? data!.offers.length.toString().padStart(2, "0")
        : "00",
    },
    { label: "Views 24h", value: data!.metrics?.views24h.toString() ?? "0" },
    { label: "Clicks 24h", value: data!.metrics?.clicks24h.toString() ?? "0" },
    { label: "Avg price", value: data!.metrics?.averagePrice ?? "Dynamic" },
  ];
  const hasOffers = data!.offers.length > 0;

  return (
    <div className="min-h-screen bg-[#010508] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <ShopHero
          name={data!.affiliate.name}
          avatarUrl={data!.affiliate.avatar_url}
          shopUrl={shopUrl}
          tagline={data!.affiliate.bio}
          heroBlurb={data!.settings.hero_blurb}
          heroImageUrl={data!.settings.hero_image_url}
          stats={stats}
          theme={data!.settings.theme}
        />

        {hasOffers ? (
          <ShopGrid>
            {data!.offers.map((offer) => (
              <ProductCard
                key={offer.id}
                title={offer.title}
                description={offer.description}
                price={offer.priceLabel}
                imageUrl={offer.image}
                ctaHref={`/go/${offer.id}___${data!.affiliate.email}`}
                theme={data!.settings.theme}
              />
            ))}
          </ShopGrid>
        ) : (
          <div className="rounded-[32px] border border-dashed border-white/15 bg-white/[0.02] p-10 text-center space-y-4">
            <p className="text-white/70">
              No offers are live just yet. Follow this storefront to catch the
              first drops.
            </p>
            <a
              href="https://www.nettmark.com"
              className="inline-flex items-center justify-center rounded-full bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/15"
            >
              Visit Nettmark
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
