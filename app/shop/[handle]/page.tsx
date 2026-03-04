import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ProductCard } from '../components/ProductCard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

const formatPrice = (price: number | null, currency: string | null) => {
  if (!price || !currency) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(price);
};

async function getShopData(handle: string) {
  const normalizedHandle = handle.trim().toLowerCase();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, username')
    .ilike('username', normalizedHandle)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const affiliateEmail = profile.email;
  const affiliateId = profile.id;

  const { data: affiliateProfile } = await supabase
    .from('affiliate_profiles')
    .select('display_name, avatar_url')
    .eq('email', affiliateEmail)
    .maybeSingle();

  const { data: approved } = await supabase
    .from('affiliate_requests')
    .select('offer_id')
    .eq('affiliate_email', affiliateEmail)
    .eq('status', 'approved');

  if (!approved || approved.length === 0) {
    return {
      affiliate: {
        id: affiliateId,
        email: affiliateEmail,
        name: affiliateProfile?.display_name || profile.username || affiliateEmail,
        avatar_url: affiliateProfile?.avatar_url || null,
      },
      offers: [],
    };
  }

  const offerIds = approved.map((row) => row.offer_id);

  const { data: offers } = await supabase
    .from('offers')
    .select('id, title, description, price, currency, logo_url, website')
    .in('id', offerIds);

  const { data: overrides } = await supabase
    .from('affiliate_shop_items')
    .select('offer_id, custom_image_url, custom_price, custom_description, display_order')
    .eq('affiliate_email', affiliateEmail)
    .in('offer_id', offerIds);

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
    };
  });

  cards.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  return {
    affiliate: {
      id: affiliateId,
      email: affiliateEmail,
      name: affiliateProfile?.display_name || profile.username || affiliateEmail,
      avatar_url: affiliateProfile?.avatar_url || null,
    },
    offers: cards,
  };
}

export default async function ShopPage({ params }: { params: { handle: string } }) {
  const data = await getShopData(params.handle);

  if (!data) {
    notFound();
  }

  const shopUrl = `https://www.nettmark.com/shop/${params.handle}`;

  return (
    <div className="min-h-screen bg-[#02070a] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          {data!.affiliate.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data!.affiliate.avatar_url}
              alt={data!.affiliate.name}
              className="h-20 w-20 rounded-full object-cover border border-white/20"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center text-2xl font-semibold">
              {data!.affiliate.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">NettmarkShop</p>
            <h1 className="text-3xl font-bold mt-2">{data!.affiliate.name}</h1>
            <p className="text-sm text-white/60 mt-1">Shop link: {shopUrl}</p>
          </div>
        </header>

        {data!.offers.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/70">
            No products yet. Check back soon!
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data!.offers.map((offer) => (
              <ProductCard
                key={offer.id}
                title={offer.title}
                description={offer.description}
                price={offer.priceLabel}
                imageUrl={offer.image}
                ctaHref={`/go/${offer.id}___${data!.affiliate.email}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
