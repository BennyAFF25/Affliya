// app/for-partners/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'For Partners — Nettmark',
  description:
    'Run approved ads via brand accounts, fund spend from your wallet, and get paid automatically on verified conversions.',
  openGraph: {
    title: 'For Partners — Nettmark',
    description:
      'Run approved ads via brand accounts, fund spend from your wallet, and get paid automatically on verified conversions.',
  },
};

export default function ForPartnersPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* TOP BAR (same UI as home) */}
      <header
        className="fixed inset-x-0 top-0 z-50 w-full h-16 px-6 bg-black/80 backdrop-blur text-white flex justify-between items-center border-b border-white/10"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Link href="/" className="flex items-center gap-2 group">
          <Image src="/nettmark-logo.png" alt="Nettmark" width={140} height={40} priority className="rounded-sm" />
        </Link>

        {/* centered primary nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm justify-center absolute left-1/2 -translate-x-1/2">
          <Link href="/for-businesses" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">For Businesses</Link>
          <Link href="/for-partners" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">For Partners</Link>
          <Link href="/pricing" className="text-[#00C2CB] hover:text-[#7ff5fb] font-semibold tracking-wide transition-colors">Pricing</Link>
        </nav>
      </header>
      <div aria-hidden className="pointer-events-none" style={{ height: 'calc(4rem + env(safe-area-inset-top))' }} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute left-1/2 top-[-10%] h-[60vh] w-[80vw] -translate-x-1/2 rounded-full blur-3xl opacity-30"
            style={{
              background:
                'radial-gradient(45% 60% at 50% 40%, rgba(0,194,203,0.25), rgba(0,0,0,0))',
            }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-6 pt-16 pb-10 md:pt-24 md:pb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#1e3a3b] bg-[#082123] px-3 py-1 text-xs text-[#7ff5fb] shadow-[0_0_30px_rgba(0,194,203,0.15)]">
            Performance with control
            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Bring the growth. <span className="text-[#7ff5fb]">Own the craft.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-300">
            Find offers, submit creatives for approval, and run ads via the brand’s Meta account. Fund spend from your
            Nettmark wallet and get paid automatically on verified conversions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/affiliate/marketplace" className="rounded-xl bg-[#00C2CB] px-5 py-3 font-semibold text-black hover:bg-[#00b0b8]">
              Browse Offers
            </Link>
            <Link href="/support" className="rounded-xl border border-[#24484a] bg-[#0d1c1d] px-5 py-3 font-semibold text-white hover:bg-[#0f2627]">
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      {/* VALUE CARDS (back to basics) */}
      <section className="mx-auto max-w-7xl px-6 pb-8 md:pb-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[{
            title: 'Wallet‑funded spend',
            desc: 'Pre‑fund your ads via Nettmark. No card sharing — clean accounting and caps.',
          }, {
            title: 'Brand‑hosted delivery',
            desc: 'Ads run on the brand’s Meta Ad Account. You execute, they keep control.',
          }, {
            title: 'Fast approvals',
            desc: 'Submit creative & targeting for review. Go live as soon as the brand approves.',
          }, {
            title: 'Auto payouts',
            desc: 'Commissions paid via Stripe on verified conversions — no screenshots or chasing.',
          }].map((i) => (
            <div key={i.title} className="rounded-2xl border border-[#1b3132] bg-[#0f1516] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="mb-3 flex items-center gap-2 text-[#7ff5fb]">
                <span className="inline-block h-2 w-2 rounded-full bg-[#00C2CB]" />
                <h3 className="font-semibold">{i.title}</h3>
              </div>
              <p className="text-sm text-gray-300">{i.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS (simple 4 steps) */}
      <section className="mx-auto max-w-7xl px-6 pb-12">
        <h2 className="text-2xl font-bold">How it works</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-4">
          {[
            { step: '1', title: 'Join & fund', desc: 'Create your account and pre‑fund your Nettmark wallet.' },
            { step: '2', title: 'Pick an offer', desc: 'Review brand rules & commission. Submit your creative plan.' },
            { step: '3', title: 'Get approved', desc: 'Your ads run via the brand’s account once approved.' },
            { step: '4', title: 'Earn automatically', desc: 'Stripe pays out commissions on verified conversions.' },
          ].map((s) => (
            <div key={s.step} className="rounded-2xl border border-[#1b3132] bg-[#0f1516] p-6">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#26494b] bg-[#0c1e1f] text-[#7ff5fb]">
                {s.step}
              </div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-gray-300">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRUSTED STRIP (animated) */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-3xl border border-[#142526] bg-[#0c1213] p-3 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap">
            <span className="mx-2 inline-flex items-center gap-2 rounded-full border border-[#1b3132] bg-[#0f1516] px-4 py-2 text-sm text-gray-200">Teams we power</span>
            {['UGC Pros','Media Buyers','Email/SMS','Community','Creators'].map((t) => (
              <span key={t} className="mx-2 inline-flex items-center gap-2 rounded-full border border-[#1b3132] bg-[#0f1516] px-4 py-2 text-sm text-gray-200">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNER EARNINGS ESTIMATOR */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-[#142526] bg-[#0b1112] p-6 md:p-10">
          {/* soft glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-30 blur-3xl"
            style={{
              background:
                'radial-gradient(60% 50% at 60% 0%, rgba(0,194,203,0.22) 0%, rgba(0,0,0,0) 70%)'
            }}
          />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#1e3a3b] bg-[#082123] px-3 py-1 text-xs text-[#7ff5fb] shadow-[0_0_30px_rgba(0,194,203,0.15)]">
                Quick calc
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C2CB]" />
              </span>
              <h3 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight">
                See what you’d make per sale
              </h3>
              <p className="mt-2 text-gray-300">
                Choose a product price and your commission rate. We’ll estimate your cut on each verified conversion.
              </p>
            </div>

            <div className="w-full md:max-w-lg">
              <div className="rounded-2xl border border-[#1b3132] bg-[#0f1516] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="grid gap-5">
                  {/* Product price */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="pp_price" className="text-sm text-gray-300">Product price</label>
                      <output id="pp_price_out" className="text-sm font-semibold text-white">$120.00</output>
                    </div>
                    <input
                      id="pp_price"
                      type="range"
                      min="10"
                      max="1000"
                      defaultValue="120"
                      step="1"
                      className="mt-2 w-full accent-[#00C2CB]"
                    />
                  </div>

                  {/* Commission */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="pp_comm" className="text-sm text-gray-300">Commission</label>
                      <output id="pp_comm_out" className="text-sm font-semibold text-white">25%</output>
                    </div>
                    <input
                      id="pp_comm"
                      type="range"
                      min="1"
                      max="80"
                      defaultValue="25"
                      step="1"
                      className="mt-2 w-full accent-[#00C2CB]"
                    />
                  </div>

                  {/* Earnings */}
                  <div className="mt-2 rounded-xl border border-[#24484a] bg-[#0d1c1d] p-4 text-center">
                    <div className="text-xs uppercase tracking-wide text-[#7ff5fb]">Your cut per sale</div>
                    <div id="pp_earn" className="mt-1 text-3xl md:text-4xl font-extrabold text-white">$30.00</div>
                    <div className="mt-1 text-[11px] text-gray-400">Paid automatically via Stripe on verified conversions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* vanilla JS island for the estimator (keeps this page as a Server Component) */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
          (function(){
            function fmt(n){ try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(n); } catch(e){ return '$' + (Math.round(n*100)/100).toFixed(2); } }
            function calc(){
              var price = parseFloat(document.getElementById('pp_price')?.value || '0');
              var comm  = parseFloat(document.getElementById('pp_comm')?.value || '0');
              var earn  = price * (comm/100);
              var priceOut = document.getElementById('pp_price_out');
              var commOut  = document.getElementById('pp_comm_out');
              var earnOut  = document.getElementById('pp_earn');
              if(priceOut) priceOut.textContent = fmt(price);
              if(commOut)  commOut.textContent  = comm + '%';
              if(earnOut)  earnOut.textContent  = fmt(earn);
            }
            function bind(){
              var p = document.getElementById('pp_price');
              var c = document.getElementById('pp_comm');
              if(!p || !c) return;
              p.addEventListener('input', calc);
              c.addEventListener('input', calc);
              calc();
            }
            if(document.readyState === 'loading'){
              document.addEventListener('DOMContentLoaded', bind);
            } else {
              bind();
            }
          })();
          `
        }}
      />
    </main>
  );
}
