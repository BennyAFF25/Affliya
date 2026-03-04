'use client';

interface ShopHeroProps {
  name: string;
  avatarUrl?: string | null;
  shopUrl: string;
}

export function ShopHero({ name, avatarUrl, shopUrl }: ShopHeroProps) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-gradient-to-r from-[#04151a] via-[#03070c] to-[#050f14] p-6 sm:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="h-20 w-20 rounded-3xl object-cover border border-white/20"
            />
          ) : (
            <div className="h-20 w-20 rounded-3xl bg-white/10 text-2xl font-semibold grid place-items-center">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">NettmarkShop</p>
            <h1 className="text-3xl font-bold text-white mt-1">{name}</h1>
            <p className="text-sm text-white/60">Curated offers powered by Nettmark tracking.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="text-xs text-white/50 break-all">{shopUrl}</div>
          <button
            onClick={() => navigator.clipboard.writeText(shopUrl)}
            className="rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/15"
          >
            Copy link
          </button>
        </div>
      </div>
    </section>
  );
}
