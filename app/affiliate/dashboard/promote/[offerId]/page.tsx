// eslint-disable-next-line
'use client';

import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from '@/../utils/supabase/pages-client';
import { fetchReachEstimate } from '@/../utils/meta/fetchReachEstimate';

type GenderOpt = '' | '1' | '2'; // 1=Male, 2=Female

type PlacementKey =
  | 'facebook_feed'
  | 'instagram_feed'
  | 'instagram_reels'
  | 'facebook_reels'
  | 'facebook_stories'
  | 'instagram_stories';

  // --- Lightweight row types for Supabase queries
  type OfferRow = {
    title?: string | null;
    logo_url?: string | null;
    business_email?: string | null;
  };

  type OfferBusinessEmailRow = {
    business_email: string | null;
  };

  type MetaConnectionRow = {
    access_token?: string | null;
    ad_account_id?: string | null;
  };

export default function PromoteOfferPage() {
  const router = useRouter();
  const params = useParams();
  const offerId = params.offerId as string;

  const session = useSession();
  const userEmail = session?.user?.email || '';

  // ─────────────────────────────
  // Organic flow state (non-invasive)
  // ─────────────────────────────
  const [mode, setMode] = useState<'ad' | 'organic'>('ad');

  // Organic method + fields
  const [ogMethod, setOgMethod] = useState<'social' | 'email' | 'forum' | 'other'>('social');
  const [ogPlatform, setOgPlatform] = useState<string>('Facebook'); // for social
  const [ogCaption, setOgCaption] = useState<string>('');           // social caption OR email subject OR forum title/url
  const [ogContent, setOgContent] = useState<string>('');           // email body / forum body
  const [ogFile, setOgFile] = useState<File | null>(null);          // optional media for social
  const [ogLoading, setOgLoading] = useState<boolean>(false);
  const userId = (session as any)?.user?.id as string | undefined;

  // ─────────────────────────────
  // Auth guard (avoid loop)
  // ─────────────────────────────
  useEffect(() => {
    if (session === undefined) return;
    if (session === null) router.push('/');
  }, [session, router]);

  // ─────────────────────────────
  // Derived tracking link
  // ─────────────────────────────
  const trackingLink = useMemo(
    () => `https://www.nettmark.com/go/${offerId}___${userEmail}`,
    [offerId, userEmail]
  );

  // ─────────────────────────────
  // Simplified, Meta-aligned form state
  // (campaign → ad set → ad creative)
  // ─────────────────────────────
  const [form, setForm] = useState({
    // Campaign
    campaign_name: '',
    objective: 'OUTCOME_TRAFFIC',

    // Ad Set
    budget_amount_dollars: 10, // UI in dollars; we will save as cents in DB
    budget_type: 'DAILY', // DAILY | LIFETIME
    start_time: '',
    end_time: '',
    location_countries: 'AU', // comma-separated ISO codes (e.g., AU,US)
    age_min: 18,
    age_max: 65,
    gender: '' as GenderOpt, // '' = All, '1'=Male, '2'=Female
    interests_csv: '', // comma-separated

    // Placements (jsonb)
    placements: {
      facebook_feed: true,
      instagram_feed: true,
      instagram_reels: true,
      facebook_reels: false,
      facebook_stories: false,
      instagram_stories: false,
    } as Record<PlacementKey, boolean>,

    // Ad Creative
    headline: '',
    caption: '',
    call_to_action: 'LEARN_MORE',
    display_link: '',
  });

  // Media
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Brand preview data (from offers table / offer-logos bucket)
  const [brandName, setBrandName] = useState<string>('Your Brand Name');
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);

  // Local preview URLs for selected files
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
    };
  }, [videoPreviewUrl, thumbPreviewUrl]);

  // Meta business connection (for reach estimate)
  const [biz, setBiz] = useState<{ access_token: string; ad_account_id: string } | null>(null);

  useEffect(() => {
    if (session === undefined || session === null) return;

    const go = async () => {
      // 1) Offer core fields
      const { data: offer, error: offerErr } = await (supabase as any)
        .from('offers')
        .select('title, logo_url, business_email')
        .eq('id', offerId)
        .single();

      if (offerErr) {
        console.error('[offer fetch error]', offerErr);
        return;
      }

      // Preview title + logo
      setBrandName(offer?.title || 'Your Brand Name');
      setBrandLogoUrl(offer?.logo_url || null);

      // 2) Meta creds by business_email (from meta_connections)
      if (offer?.business_email) {
        const { data: mc, error: mcErr } = await (supabase as any)
          .from('meta_connections')
          .select('access_token, ad_account_id')
          .eq('business_email', offer.business_email as string)
          .single();

        if (mcErr) {
          console.warn('[meta_connections fetch warn]', mcErr);
        } else if (mc?.access_token && mc?.ad_account_id) {
          setBiz({ access_token: mc.access_token, ad_account_id: mc.ad_account_id });
        }
      }
    };

    go();
  }, [offerId, session]);

  // Debounce helper – prevents spamming Graph while typing
  function useDebounce(fn: (...args: any[]) => void, delay = 600) {
    const t = useRef<number | null>(null);
    return (...args: any[]) => {
      if (t.current) window.clearTimeout(t.current);
      t.current = window.setTimeout(() => fn(...args), delay) as unknown as number;
    };
  }

  // Map our placements to Meta positions (publisher_platforms + *_positions)
  function buildPlacementTargeting(placements: Record<PlacementKey, boolean>) {
    const publisher_platforms: string[] = [];
    const facebook_positions: string[] = [];
    const instagram_positions: string[] = [];

    if (placements.facebook_feed) { if (!publisher_platforms.includes('facebook')) publisher_platforms.push('facebook'); facebook_positions.push('feed'); }
    if (placements.facebook_stories) { if (!publisher_platforms.includes('facebook')) publisher_platforms.push('facebook'); facebook_positions.push('story'); }
    if (placements.facebook_reels) { if (!publisher_platforms.includes('facebook')) publisher_platforms.push('facebook'); facebook_positions.push('facebook_reels'); }

    if (placements.instagram_feed) { if (!publisher_platforms.includes('instagram')) publisher_platforms.push('instagram'); instagram_positions.push('stream'); }
    if (placements.instagram_stories) { if (!publisher_platforms.includes('instagram')) publisher_platforms.push('instagram'); instagram_positions.push('story'); }
    if (placements.instagram_reels) { if (!publisher_platforms.includes('instagram')) publisher_platforms.push('instagram'); instagram_positions.push('reels'); }

    const out: any = { publisher_platforms };
    if (facebook_positions.length) out.facebook_positions = facebook_positions;
    if (instagram_positions.length) out.instagram_positions = instagram_positions;
    return out;
  }

  // ─────────────────────────────
  // Reach estimate (optional) - split daily/monthly
  // ─────────────────────────────
  const [reachDaily, setReachDaily] = useState<number | null>(null);
  const [reachMonthly, setReachMonthly] = useState<number | null>(null);
  const [interestsIgnored, setInterestsIgnored] = useState(false);
  const [assumeCPM, setAssumeCPM] = useState<number>(10); // $10 CPM default
  const [assumeCTR, setAssumeCTR] = useState<number>(1);  // 1% CTR default
  const [assumeCVR, setAssumeCVR] = useState<number>(3);  // 3% CVR default

  const impressions = useMemo(() => {
    const budget = Number(form?.budget_amount_dollars || 0);
    return assumeCPM > 0 ? (budget / assumeCPM) * 1000 : 0;
  }, [form.budget_amount_dollars, assumeCPM]);

  const clicks = useMemo(() => impressions * (assumeCTR / 100), [impressions, assumeCTR]);
  const dailyConversions = useMemo(() => clicks * (assumeCVR / 100), [clicks, assumeCVR]);
  const monthlyConversions = useMemo(() => dailyConversions * 30, [dailyConversions]);

  // Sparkline for 30-day projection (tiny sideways line chart)
  function buildSparkPath(values: number[], w = 120, h = 36, pad = 2) {
    const max = Math.max(1, ...values);
    const n = values.length;
    if (n === 0) return '';
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    return values
      .map((val, i) => {
        const x = pad + (i * innerW) / (n - 1 || 1);
        const y = h - pad - (Math.max(0, val) / max) * innerH;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  }

  const sparkValues = useMemo(() => {
    const v = Number.isFinite(dailyConversions) ? Math.max(0, dailyConversions) : 0;
    // 30 points flat projection (daily × 30). Keep flat to avoid fake volatility.
    return Array.from({ length: 30 }, () => v);
  }, [dailyConversions]);

  const sparkPath = useMemo(() => buildSparkPath(sparkValues), [sparkValues]);

  const triggerReach = useDebounce(async () => {
    try {
      if (!biz?.access_token || !biz?.ad_account_id) return;

      // Normalize ad account id: ensure numeric only (server will prefix act_ once)
      const numericAd = String(biz.ad_account_id).replace(/^act_/, '');
      if (!numericAd) return;

      const countries = form.location_countries
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (countries.length === 0) return; // wait until user picks at least one

      const age_min = Number(form.age_min || 18);
      const age_max = Number(form.age_max || 65);
      if (age_min < 13 || age_max < age_min) return;

      const genders = form.gender === '' ? [] : [Number(form.gender)];

      const interests = form.interests_csv
        ? form.interests_csv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((i) => ({ id: i, name: i }))
        : [];

      // (Future) placements – server can merge into targeting_spec if supported
      const placementSpec = buildPlacementTargeting(form.placements);

      const est = await fetchReachEstimate({
        access_token: biz.access_token,
        ad_account_id: numericAd,
        countries,
        age_min,
        age_max,
        genders,
        interests,
        optimization_goal: 'REACH',
        currency: 'AUD', // ignored by server route
        placementSpec, // ← added to send placements
      } as any);

      // Graph returns: { data: [{ estimate_dau, estimate_mau, estimate_ready, ... }] }
      const first = Array.isArray(est?.data) ? est.data[0] : null as any;
      setInterestsIgnored(Boolean((est as any)?.meta?.interests_ignored));

      function extractEstimate(val: any): number | null {
        if (val == null) return null;
        if (typeof val === 'number' && isFinite(val)) return val;
        if (typeof val === 'object') {
          // common shapes: { estimate }, { value }, { lower_bound, upper_bound }
          if (typeof val.estimate === 'number' && isFinite(val.estimate)) return val.estimate;
          if (typeof val.value === 'number' && isFinite(val.value)) return val.value;
          if (typeof val.lower_bound === 'number' && typeof val.upper_bound === 'number') {
            // pick midpoint when a range is provided
            const mid = (val.lower_bound + val.upper_bound) / 2;
            return isFinite(mid) ? mid : null;
          }
        }
        return null;
      }

      const dau = extractEstimate(first?.estimate_dau);
      const mau = extractEstimate(first?.estimate_mau);

      setReachDaily(dau);
      setReachMonthly(mau);
    } catch (e) {
      console.warn('[Reach Estimate Error]', e);
      setReachDaily(null);
      setReachMonthly(null);
    }
  }, 600);

  useEffect(() => {
    triggerReach();
    // include placements so toggling them updates estimate
  }, [
    biz,
    form.location_countries,
    form.age_min,
    form.age_max,
    form.gender,
    form.interests_csv,
    form.placements.facebook_feed,
    form.placements.instagram_feed,
    form.placements.instagram_reels,
    form.placements.facebook_reels,
    form.placements.facebook_stories,
    form.placements.instagram_stories,
  ]);

  // ─────────────────────────────
  // Helpers
  // ─────────────────────────────
  const onInput =
    (name: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
      setForm((prev) => ({ ...prev, [name]: val as any }));
    };

  const onPlacementToggle = (key: PlacementKey) => {
    setForm((p) => ({ ...p, placements: { ...p.placements, [key]: !p.placements[key] } }));
  };

  // Apply estimator preset for CPM, CTR, CVR
  function applyEstimatorPreset(kind: 'ugc' | 'dtc' | 'lead') {
    if (kind === 'ugc') { setAssumeCPM(8); setAssumeCTR(1.2); setAssumeCVR(2.0); }
    if (kind === 'dtc') { setAssumeCPM(12); setAssumeCTR(1.5); setAssumeCVR(1.5); }
    if (kind === 'lead') { setAssumeCPM(10); setAssumeCTR(1.0); setAssumeCVR(4.0); }
  }

  const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Input styling helpers (brand focus glow + tray)
  const INPUT =
    'mt-1 w-full bg-[#101010] border border-[#232323] rounded-lg px-3 py-2 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition ' +
    'focus:outline-none focus:border-[#00C2CB] focus:ring-2 focus:ring-[#00C2CB]/30 ' +
    'focus:shadow-[0_0_0_3px_rgba(0,194,203,0.12)]';

  // Tiny action chip
  function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-[11px] px-2 py-1 rounded-full border border-[#2a2a2a] text-gray-300 hover:text-white hover:border-[#3a3a3a] hover:bg-[#1a1a1a]"
      >
        {children}
      </button>
    );
  }

  // Branded Disclosure (accordion)
  function Disclosure({
    title,
    children,
    defaultOpen = false,
  }: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
  }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div className="border border-[#232323] rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#121212] hover:bg-[#151515]"
        >
          <span className="text-sm font-semibold">{title}</span>
          <span
            className={[
              'inline-block text-[#00C2CB] transition-transform duration-200',
              open ? 'rotate-180' : 'rotate-0',
            ].join(' ')}
            aria-hidden
          >
            ▾
          </span>
        </button>
        {open && (
          <div className="px-4 py-3 bg-[#0f0f0f] text-[13px] text-gray-300 space-y-2">
            {children}
          </div>
        )}
      </div>
    );
  }

  // Date helpers
  const pad = (n: number) => String(n).padStart(2, '0');
  const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const incBudget = (amt: number) =>
    setForm((p) => ({ ...p, budget_amount_dollars: Math.max(1, Number(p.budget_amount_dollars || 0) + amt) }));

  const setStartIn15m = () => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    setForm((p) => ({ ...p, start_time: toLocalInput(d) }));
  };

  const setEndIn7d = () => {
    const base = form.start_time ? new Date(form.start_time) : new Date();
    const d = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    setForm((p) => ({ ...p, end_time: toLocalInput(d) }));
  };

  // Countries (ISO) — compact list + multi-select dropdown that stores CSV in form.location_countries
  const COUNTRIES: { code: string; name: string }[] = [
    { code: 'AU', name: 'Australia' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'CA', name: 'Canada' },
    { code: 'IE', name: 'Ireland' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'ES', name: 'Spain' },
    { code: 'IT', name: 'Italy' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'SG', name: 'Singapore' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'PH', name: 'Philippines' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'IN', name: 'India' },
    { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'BR', name: 'Brazil' },
    { code: 'MX', name: 'Mexico' },
  ];

  function CountryMultiSelect({
    value,
    onChange,
  }: {
    value: string;
    onChange: (csv: string) => void;
  }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement | null>(null);

    const selected = useMemo(() => value.split(',').map(s => s.trim()).filter(Boolean), [value]);

    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (!ref.current) return;
        if (!ref.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const toggle = (code: string) => {
      const set = new Set(selected);
      set.has(code) ? set.delete(code) : set.add(code);
      onChange(Array.from(set).join(','));
    };

    const remove = (code: string) => {
      const set = new Set(selected);
      set.delete(code);
      onChange(Array.from(set).join(','));
    };

    const filtered = COUNTRIES.filter(c =>
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      c.name.toLowerCase().includes(query.toLowerCase())
    );

    return (
      <div ref={ref} className="relative">
        {/* Display (chips) */}
        <button
          type="button"
          className={`${INPUT} flex items-center gap-2 min-h-[42px] text-left`}
          onClick={() => setOpen((o) => !o)}
        >
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selected.map((code) => (
                <span key={code} className="text-[11px] px-2 py-1 rounded-full border border-[#2a2a2a] bg-[#121212]">
                  {code}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); remove(code); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); remove(code); } }}
                    className="ml-1 text-gray-400 hover:text-white cursor-pointer select-none"
                    aria-label={`Remove ${code}`}
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-gray-500">Select countries…</span>
          )}
          <span className="ml-auto text-[11px] text-gray-500">{open ? 'Close' : 'Open'}</span>
        </button>

        {/* Popover */}
        {open && (
          <div className="absolute z-20 mt-2 w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] shadow-xl">
            <div className="p-2 border-b border-[#1f1f1f]">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country"
                className={`${INPUT} mt-0`}
              />
            </div>
            <div className="max-h-56 overflow-auto py-1">
              {filtered.map((c) => {
                const isSel = selected.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggle(c.code)}
                    className={`w-full px-3 py-2 text-sm flex items-center justify-between hover:bg-[#141414] ${isSel ? 'text-[#00C2CB]' : 'text-gray-200'}`}
                  >
                    <span>{c.name}</span>
                    <span className="text-[11px] opacity-70">{c.code}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-xs text-gray-500">No matches</div>
              )}
            </div>
            <div className="px-3 py-2 border-t border-[#1f1f1f] text-right">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1 rounded-md border border-[#2a2a2a] hover:bg-[#151515]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Brand DateTime picker (no external deps)
  function DateTimeField({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string; // 'YYYY-MM-DDTHH:mm' or ''
    onChange: (v: string) => void;
  }) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState(() => {
      const d = value ? new Date(value) : new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const ref = useRef<HTMLDivElement | null>(null);

    // derived selected date/time
    const sel = value ? new Date(value) : null;

    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (!ref.current) return;
        if (!ref.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const pad = (n: number) => String(n).padStart(2, '0');
    const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const startWeekday = (y: number, m: number) => new Date(y, m, 1).getDay(); // 0 Sun..6 Sat

    const y = view.getFullYear();
    const m = view.getMonth();
    const dim = daysInMonth(y, m);
    const start = startWeekday(y, m);

    const hours = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
    const minutes = Array.from({ length: 12 }, (_, i) => pad(i * 5)); // 00..55 step 5
    const isPM = sel ? sel.getHours() >= 12 : true;
    const hour12 = sel ? ((sel.getHours() % 12) || 12) : 12;
    const minuteStr = sel ? pad(sel.getMinutes() - (sel.getMinutes() % 5)) : '00';

    const setPart = (part: 'hour' | 'minute' | 'ampm', val: number | 'am' | 'pm') => {
      const base = sel ? new Date(sel) : new Date();
      let h = base.getHours();
      if (part === 'hour') {
        const as24 = ((val as number) % 12) + (h >= 12 ? 12 : 0);
        base.setHours(as24);
      } else if (part === 'minute') {
        base.setMinutes(val as number);
      } else {
        // am/pm
        const wasPM = h >= 12;
        if (val === 'pm' && !wasPM) base.setHours(h + 12);
        if (val === 'am' && wasPM) base.setHours(h - 12);
      }
      onChange(toLocalInput(base));
    };

    const selectDay = (d: number) => {
      const base = sel ? new Date(sel) : new Date();
      base.setFullYear(y); base.setMonth(m); base.setDate(d);
      onChange(toLocalInput(base));
    };

    const clear = () => onChange('');
    const setToday = () => onChange(toLocalInput(new Date()));

    return (
      <div ref={ref} className="relative">
        <button type="button" className={`${INPUT} text-left flex items-center gap-2`} onClick={() => setOpen(o => !o)}>
          {value ? new Date(value).toLocaleString() : <span className="text-gray-500">dd/mm/yyyy, --:-- --</span>}
          <span className="ml-auto text-[11px] text-gray-500">{open ? 'Close' : 'Open'}</span>
        </button>
        {open && (
          <div className="absolute z-30 mt-2 w-[320px] rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#1f1f1f]">
              <div className="text-sm font-semibold">{view.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
              <div className="flex items-center gap-2">
                <button type="button" className="h-7 w-7 grid place-items-center rounded-md border border-[#2a2a2a] hover:bg-[#151515]" onClick={() => setView(new Date(y, m - 1, 1))}>←</button>
                <button type="button" className="h-7 w-7 grid place-items-center rounded-md border border-[#2a2a2a] hover:bg-[#151515]" onClick={() => setView(new Date(y, m + 1, 1))}>→</button>
              </div>
            </div>
            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 p-3 text-center">
              {[...'SMTWTFS'].map((c, i) => (
                <div key={i} className="text-[11px] text-gray-400">{c}</div>
              ))}
              {Array.from({ length: (start || 0) }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: dim }).map((_, i) => {
                const d = i + 1;
                const isSel = sel && sel.getFullYear() === y && sel.getMonth() === m && sel.getDate() === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => selectDay(d)}
                    className={[
                      'h-8 rounded-md border text-sm',
                      isSel ? 'border-[#00C2CB] text-white bg-[#0b1f20]' : 'border-transparent hover:border-[#2a2a2a] hover:bg-[#141414]'
                    ].join(' ')}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            {/* Time */}
            <div className="flex items-center gap-2 px-3 pb-3">
              <select className={`${INPUT} mt-0 w-20`} value={hour12} onChange={(e) => setPart('hour', Number(e.target.value))}>
                {hours.map(h => <option key={h} value={h}>{pad(h)}</option>)}
              </select>
              <select className={`${INPUT} mt-0 w-20`} value={Number(minuteStr)} onChange={(e) => setPart('minute', Number(e.target.value))}>
                {minutes.map(mn => <option key={mn} value={Number(mn)}>{mn}</option>)}
              </select>
              <select className={`${INPUT} mt-0 w-24`} value={isPM ? 'pm' : 'am'} onChange={(e) => setPart('ampm', e.target.value as any)}>
                <option value="am">AM</option>
                <option value="pm">PM</option>
              </select>
              <div className="ml-auto flex items-center gap-2 text-[11px]">
                <button type="button" onClick={clear} className="px-2 py-1 rounded-md border border-[#2a2a2a] hover:bg-[#151515]">Clear</button>
                <button type="button" onClick={setToday} className="px-2 py-1 rounded-md border border-[#2a2a2a] hover:bg-[#151515]">Today</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────
  // Organic submit (direct insert to organic_posts)
  // ─────────────────────────────
  const handleOrganicSubmit = async () => {
    try {
      if (!userEmail) { alert('You must be signed in.'); return; }
      if (!userId) { alert('Missing user id.'); return; }

      setOgLoading(true);

      // Fetch business_email for this offer
      const { data: offerRow, error: offerErr } = await (supabase as any)
        .from('offers')
        .select('business_email')
        .eq('id', offerId)
        .single();
      if (offerErr || !offerRow?.business_email) throw new Error('Could not resolve business email for this offer.');
      const business_email = offerRow.business_email as string;

      // Optional upload (only for social with media)
      let image_url: string | null = null;
      let video_url: string | null = null;

      if (ogFile) {
        const bucket = 'organic-posts'; // ← Supabase storage bucket name
        const ts = Date.now();
        const path = `${ts}-${sanitize(ogFile.name)}`;
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, ogFile, { upsert: true, contentType: ogFile.type });
        if (upErr) throw new Error(upErr.message || JSON.stringify(upErr));
        const { data: pubUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
        let publicUrl = pubUrlData?.publicUrl || '';

        // Normalize to ensure `/public/` is present for public buckets
        if (publicUrl && publicUrl.includes('/storage/v1/object/') && !publicUrl.includes('/storage/v1/object/public/')) {
          publicUrl = publicUrl.replace('/storage/v1/object/', '/storage/v1/object/public/');
        }

        // Debug aid
        console.log('[Organic Upload]', { bucket, path, publicUrl });

        if (ogFile.type.startsWith('image/')) image_url = publicUrl;
        if (ogFile.type.startsWith('video/')) video_url = publicUrl;
      }

      // Map fields by method
      let platform = ogPlatform;
      let caption = ogCaption;
      let content = ogContent;

      if (ogMethod === 'email') {
        platform = 'Email';
        // caption = subject, content = body (already set)
      } else if (ogMethod === 'forum') {
        platform = 'Forum';
        // caption = forum URL/title, content = body (already set)
      }

      // Consolidate details into caption for review (schema doesn't include `content` or `method`)
      let captionForInsert = caption;
      if (ogMethod === 'email') {
        captionForInsert = `[EMAIL]\nSubject: ${caption || '(no subject)'}\n\nBody:\n${content || '(no body)'}`;
      } else if (ogMethod === 'forum') {
        captionForInsert = `[FORUM]\nURL/Title: ${caption || '(no url/title)'}\n\nPost:\n${content || '(no content)'}`;
      } else if (ogMethod === 'other') {
        captionForInsert = `[OTHER]\nSummary: ${caption || '(no summary)'}\n\nDetails:\n${content || '(no details)'}`;
      }

      // Insert to organic_posts (RLS expects affiliate_email to match auth.email())
      const { error: insertErr } = await (supabase.from('organic_posts') as any).insert([
        {
          offer_id: offerId,
          user_id: userId,
          affiliate_email: userEmail,
          business_email,
          caption: captionForInsert,
          platform, // Facebook/Instagram/TikTok OR Email/Forum
          image_url,
          video_url,
          status: 'pending',
        } as any,
      ]);
      if (insertErr) throw new Error(insertErr.message || JSON.stringify(insertErr));

      alert('Organic submission received. We’ll notify you when it’s approved.');
      // Reset organic fields
      setOgCaption('');
      setOgContent('');
      setOgFile(null);
    } catch (e: any) {
      const msg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
      console.error('[Organic Submit Error]', msg, e);
      alert(msg || 'Failed to submit organic post.');
    } finally {
      setOgLoading(false);
    }
  };

  // ─────────────────────────────
  // Submit (Uploads → ad_ideas insert)
  // ─────────────────────────────
  const handleSubmit = async () => {
    if (!videoFile) {
      alert('Please upload a video file.');
      return;
    }

    setLoading(true);
    try {
      // 1) Get business email for this offer (needed for row)
      const { data: offerRow, error: offerErr } = await (supabase as any)
        .from('offers')
        .select('business_email')
        .eq('id', offerId)
        .single();
      if (offerErr || !offerRow) throw new Error('Failed to fetch offer/business email');

      const business_email = offerRow.business_email;

      // 2) Upload video (and optional thumbnail) to "ad-ideas-assets" bucket
      const ts = Date.now();

      const videoPath = `videos/${ts}-${sanitize(videoFile.name)}`;
      const { error: upVidErr } = await supabase.storage
        .from('ad-ideas-assets')
        .upload(videoPath, videoFile, { upsert: true, contentType: videoFile.type });
      if (upVidErr) throw upVidErr;
      const videoPublicUrl = supabase.storage.from('ad-ideas-assets').getPublicUrl(videoPath).data.publicUrl;

      let thumbPublicUrl: string | null = null;
      if (thumbnailFile) {
        const thumbPath = `thumbnails/${ts}-thumb-${sanitize(thumbnailFile.name)}`;
        const { error: upThumbErr } = await supabase.storage
          .from('ad-ideas-assets')
          .upload(thumbPath, thumbnailFile, { upsert: true, contentType: thumbnailFile.type });
        if (!upThumbErr) {
          thumbPublicUrl = supabase.storage.from('ad-ideas-assets').getPublicUrl(thumbPath).data.publicUrl;
        }
      }

      // 3) Build normalized fields for DB
      const interests = form.interests_csv
        ? form.interests_csv.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const placements_selected = Object.entries(form.placements)
        .filter(([, v]) => v)
        .map(([k]) => k);

      // UI uses dollars; DB stores cents (int)
      const budget_amount = Math.round(Number(form.budget_amount_dollars || 0) * 100);

      // 4) Insert into ad_ideas
      const insertPayload: any = {
        offer_id: offerId,
        affiliate_email: userEmail,
        business_email,
        // media
        file_url: videoPublicUrl,
        thumbnail_url: thumbPublicUrl,
        media_type: 'VIDEO',
        type: 'Video',

        // campaign/adset/ad
        campaign_name: form.campaign_name || null,
        objective: form.objective || 'OUTCOME_TRAFFIC',
        budget_amount: budget_amount || 0,
        budget_type: form.budget_type,
        start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
        end_time: form.end_time ? new Date(form.end_time).toISOString() : null,

        // targeting
        location: form.location_countries, // store as CSV for now
        age_range: [String(form.age_min), String(form.age_max)], // reuse column (text[])
        gender: form.gender === '' ? 'All' : form.gender === '1' ? 'Male' : 'Female',
        interests: interests, // jsonb in table

        // placements
        manual_placements: placements_selected, // jsonb in table
        placements_type: 'MANUAL',

        // creative
        headline: form.headline || null,
        caption: form.caption || '',
        call_to_action: form.call_to_action || 'LEARN_MORE',
        display_link: form.display_link || trackingLink,

        // workflow
        status: 'pending', // business will approve → then we push to Meta via server route
        meta_status: null,
      };

      const { error: insertErr } = await (supabase.from('ad_ideas') as any).insert([
        insertPayload as any,
      ]);
      if (insertErr) throw insertErr;

      alert('Ad idea submitted for review.');
      router.push('/affiliate/inbox'); // back to inbox after submit
    } catch (e: any) {
      console.error('[❌ Submit Error]', e);
      alert(e?.message || 'Failed to submit.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────
  // Placements – branded toggle cards
  // ─────────────────────────────
  const PLACEMENT_ORDER: PlacementKey[] = [
    'facebook_feed',
    'instagram_feed',
    'instagram_reels',
    'facebook_reels',
    'facebook_stories',
    'instagram_stories',
  ];

  const PLACEMENT_META: Record<PlacementKey, { label: string; sub?: string; icon: ReactNode }> = {
    facebook_feed: {
      label: 'Facebook Feed',
      sub: 'Main feed',
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M22 12.073C22 6.505 17.523 2 12 2S2 6.505 2 12.073c0 4.999 3.657 9.144 8.438 9.878v-6.988H7.898v-2.89h2.54V9.845c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.242 0-1.63.772-1.63 1.562v1.875h2.773l-.443 2.889h-2.33v6.988C18.343 21.217 22 17.072 22 12.073z"/>
        </svg>
      ),
    },
    instagram_feed: {
      label: 'Instagram Feed',
      sub: 'Main feed',
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5zm5.25-3.25a1.25 1.25 0 1 1-1.25 1.25 1.25 1.25 0 0 1 1.25-1.25z"/>
        </svg>
      ),
    },
    instagram_reels: {
      label: 'Instagram Reels',
      sub: 'Short video',
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 1.5L10 8H7.5L5 4.5h1.5zm4 0L14 8h-2.5L8.5 4.5H10zm4 0L18 8h-2.5L12.5 4.5H14zM9 10.25v3.5a.75.75 0 0 0 1.125.654l3-1.75a.75.75 0 0 0 0-1.308l-3-1.75A.75.75 0 0 0 9 10.25z"/>
        </svg>
      ),
    },
    facebook_reels: {
      label: 'Facebook Reels',
      sub: 'Short video',
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm6 6.25v5.5a.75.75 0 0 0 1.125.654l4-2.25a.75.75 0 0 0 0-1.308l-4-2.25A.75.75 0 0 0 10 9.25zM6.5 4.5L9 8H7.5L5 4.5h1.5zM11 4.5L13.5 8H12L9.5 4.5H11zM15.5 4.5L18 8h-1.5L14 4.5h1.5z"/>
        </svg>
      ),
    },
    facebook_stories: {
      label: 'Facebook Stories',
      sub: 'Vertical story',
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M8 2.75A2.75 2.75 0 0 1 10.75 0h2.5A2.75 2.75 0 0 1 16 2.75v18.5A2.75 2.75 0 0 1 13.25 24h-2.5A2.75 2.75 0 0 1 8 21.25zM10 2.5h4v19h-4z"/>
        </svg>
      ),
    },
    instagram_stories: {
      label: 'Instagram Stories',
      sub: 'Vertical story',
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M6 1.75A2.75 2.75 0 0 1 8.75-1h6.5A2.75 2.75 0 0 1 18 1.75v20.5A2.75 2.75 0 0 1 15.25 25h-6.5A2.75 2.75 0 0 1 6 22.25zM8 3.5h8v18H8z"/>
        </svg>
      ),
    },
  };

  function PlacementCard({
    k,
    active,
    onToggle,
  }: {
    k: PlacementKey;
    active: boolean;
    onToggle: () => void;
  }) {
    const meta = PLACEMENT_META[k];
    return (
      <button
        type="button"
        onClick={onToggle}
        className={[
          'group w-full text-left rounded-xl border transition relative overflow-hidden',
          active ? 'border-[#00C2CB]/60 bg-gradient-to-br from-[#0d1f21] via-[#0f0f0f] to-[#0b0b0b] ring-1 ring-[#00C2CB]/40' : 'border-[#232323] hover:border-[#2f2f2f] bg-[#101010]'
        ].join(' ')}
      >
        <div className="p-3 flex items-center gap-3">
          <div className={['h-9 w-9 rounded-lg flex items-center justify-center', active ? 'bg-[#043a3d] text-[#7ff5fb]' : 'bg-[#171717] text-gray-300','border', active ? 'border-[#00C2CB]/50' : 'border-[#2a2a2a]'].join(' ')}>
            {meta.icon}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{meta.label}</div>
            <div className="text-[11px] text-gray-400">{meta.sub || (active ? 'Selected' : 'Tap to include')}</div>
          </div>
          {/* Toggle pill */}
          <div className={['ml-auto h-5 w-9 rounded-full relative transition', active ? 'bg-[#00C2CB]' : 'bg-[#2a2a2a]'].join(' ')}>
            <span className={['absolute top-0.5 h-4 w-4 rounded-full bg-black transition-all', active ? 'left-5' : 'left-0.5'].join(' ')} />
          </div>
        </div>
      </button>
    );
  }

  // ─────────────────────────────
  // UI (single card stepper + right preview)
  // ─────────────────────────────
  const [step, setStep] = useState(1);
  const steps = [
    { id: 1, label: 'Campaign' },
    { id: 2, label: 'Ad set' },
    { id: 3, label: 'Ad' },
    { id: 4, label: 'Review' },
  ];

  const StepPill = ({ active }: { active: boolean }) => (
    <span
      className={[
        'h-2 w-2 rounded-full',
        active ? 'bg-[#00C2CB]' : 'bg-[#2b2b2b]',
      ].join(' ')}
    />
  );

  return (
    <div className="min-h-screen py-10 px-6 bg-[#0e0e0e] text-white">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_360px] gap-8">
        {/* Mode toggle (Ad vs Organic) */}
        <div className="lg:col-span-2 -mb-2 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('ad')}
              className={['px-3 py-1.5 rounded-lg border text-sm', mode === 'ad' ? 'bg-[#00C2CB] text-black border-[#00C2CB]' : 'border-[#2a2a2a] text-gray-300 hover:bg-[#151515]'].join(' ')}
            >
              Submit Ad
            </button>
            <button
              type="button"
              onClick={() => setMode('organic')}
              className={['px-3 py-1.5 rounded-lg border text-sm', mode === 'organic' ? 'bg-[#00C2CB] text-black border-[#00C2CB]' : 'border-[#2a2a2a] text-gray-300 hover:bg-[#151515]'].join(' ')}
            >
              Submit Organic
            </button>
          </div>
        </div>
        {/* LEFT: single card wizard */}
        {mode === 'ad' && (
          <div className="relative bg-[#141414] border border-[#232323] rounded-2xl shadow-xl overflow-hidden">
            {/* Header / Stepper */}
            <div className="px-6 sm:px-8 py-5 border-b border-[#232323] flex items-center justify-between">
              <h1 className="text-2xl font-bold text-[#00C2CB]">
                Create New Ad Campaign
              </h1>
              <div className="flex items-center gap-2">
                {steps.map((s, i) => (
                  <StepPill key={s.id} active={step >= s.id} />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="px-6 sm:px-8 py-6 space-y-6">
              {/* Step labels */}
              <div className="flex gap-4 text-sm">
                {steps.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStep(s.id)}
                    className={[
                      'px-3 py-1 rounded-full border transition',
                      step === s.id
                        ? 'border-[#00C2CB] text-[#00C2CB]'
                        : 'border-transparent text-gray-400 hover:text-white',
                    ].join(' ')}
                  >
                    {s.id}. {s.label}
                  </button>
                ))}
              </div>

              {/* Step 1: Campaign */}
              {step === 1 && (
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs text-gray-400">Campaign name</span>
                    <input
                      placeholder="e.g. Affliya – Launch"
                      className={INPUT}
                      value={form.campaign_name}
                      onChange={onInput('campaign_name')}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-gray-400">Objective</span>
                    <select
                      className={INPUT}
                      value={form.objective}
                      onChange={onInput('objective')}
                    >
                      <option value="OUTCOME_AWARENESS">Awareness</option>
                      <option value="OUTCOME_TRAFFIC">Traffic</option>
                      <option value="OUTCOME_ENGAGEMENT">Engagement</option>
                      <option value="OUTCOME_LEADS">Leads</option>
                      <option value="OUTCOME_SALES">Sales</option>
                      <option value="OUTCOME_VIDEO_VIEWS">Video Views</option>
                      <option value="OUTCOME_REACH">Reach</option>
                    </select>
                  </label>
                </div>
              )}

              {/* Step 2: Ad set */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <label className="flex-1">
                      <span className="text-xs text-gray-400">Budget (AUD)</span>
                      <input
                        type="number"
                        min={1}
                        className={INPUT}
                        value={form.budget_amount_dollars}
                        onChange={onInput('budget_amount_dollars')}
                      />
                    </label>
                    <label className="w-40">
                      <span className="text-xs text-gray-400">Type</span>
                      <select
                        className={INPUT}
                        value={form.budget_type}
                        onChange={onInput('budget_type')}
                      >
                        <option value="DAILY">Daily</option>
                        <option value="LIFETIME">Lifetime</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 -mt-1">
                    <span className="text-[11px] text-gray-500 mr-1">Quick add:</span>
                    <Chip onClick={() => incBudget(5)}>+ $5</Chip>
                    <Chip onClick={() => incBudget(10)}>+ $10</Chip>
                    <Chip onClick={() => incBudget(20)}>+ $20</Chip>
                  </div>

                  <div className="flex gap-3">
                    <label className="flex-1">
                      <span className="text-xs text-gray-400">Start</span>
                      <DateTimeField
                        label="Start"
                        value={form.start_time}
                        onChange={(v) => setForm((p) => ({ ...p, start_time: v }))}
                      />
                    </label>
                    <label className="flex-1">
                      <span className="text-xs text-gray-400">End</span>
                      <DateTimeField
                        label="End"
                        value={form.end_time}
                        onChange={(v) => setForm((p) => ({ ...p, end_time: v }))}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 -mt-1">
                    <span className="text-[11px] text-gray-500 mr-1">Shortcuts:</span>
                    <Chip onClick={setStartIn15m}>Start now (+15m)</Chip>
                    <Chip onClick={setEndIn7d}>End in 7 days</Chip>
                  </div>

                  <label className="block">
                    <span className="text-xs text-gray-400">Countries (ISO, comma)</span>
                    <CountryMultiSelect
                      value={form.location_countries}
                      onChange={(csv) => setForm((p) => ({ ...p, location_countries: csv }))}
                    />
                  </label>

                  <div className="flex items-end gap-3">
                    <label>
                      <span className="text-xs text-gray-400">Age Min</span>
                      <input
                        type="number"
                        min={13}
                        max={65}
                        className={`${INPUT} w-24`}
                        value={form.age_min}
                        onChange={onInput('age_min')}
                      />
                    </label>
                    <label>
                      <span className="text-xs text-gray-400">Age Max</span>
                      <input
                        type="number"
                        min={13}
                        max={65}
                        className={`${INPUT} w-24`}
                        value={form.age_max}
                        onChange={onInput('age_max')}
                      />
                    </label>
                    <label className="flex-1">
                      <span className="text-xs text-gray-400">Gender</span>
                      <select
                        className={INPUT}
                        value={form.gender}
                        onChange={onInput('gender')}
                      >
                        <option value="">All</option>
                        <option value="1">Male</option>
                        <option value="2">Female</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs text-gray-400">Interests (comma separated)</span>
                    <input
                      placeholder="Fitness, Tech, Travel"
                      className={INPUT}
                      value={form.interests_csv}
                      onChange={onInput('interests_csv')}
                    />
                  </label>

                  <div>
                    <span className="block text-xs text-gray-400 mb-2">Placements</span>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {PLACEMENT_ORDER.map((key) => (
                        <PlacementCard
                          key={key}
                          k={key}
                          active={form.placements[key]}
                          onToggle={() => onPlacementToggle(key)}
                        />
                      ))}
                    </div>
                  </div>

                  {(reachDaily !== null || reachMonthly !== null) && (
                    <div className="mt-2 p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                      <div className="text-xs text-gray-400 mb-1">Estimated Reach (unique users)</div>
                      <div className="flex items-center gap-6">
                        <div>
                          <div className="text-[11px] text-gray-400">Daily</div>
                          <div className="text-lg font-bold text-[#00C2CB]">
                            {reachDaily !== null ? reachDaily.toLocaleString() : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-gray-400">Monthly</div>
                          <div className="text-lg font-bold text-[#00C2CB]">
                            {reachMonthly !== null ? reachMonthly.toLocaleString() : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Ad */}
              {step === 3 && (
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs text-gray-400">Headline</span>
                    <input
                      placeholder="Your headline"
                      className={INPUT}
                      value={form.headline}
                      onChange={onInput('headline')}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-gray-400">Caption</span>
                    <textarea
                      placeholder="Say something compelling…"
                      className={INPUT}
                      value={form.caption}
                      onChange={onInput('caption')}
                    />
                  </label>

                  <div className="flex gap-3">
                    <label className="flex-1">
                      <span className="text-xs text-gray-400">Call to Action</span>
                      <select
                        className={INPUT}
                        value={form.call_to_action}
                        onChange={onInput('call_to_action')}
                      >
                        <option value="LEARN_MORE">Learn More</option>
                        <option value="SHOP_NOW">Shop Now</option>
                        <option value="SIGN_UP">Sign Up</option>
                      </select>
                    </label>
                    <label className="flex-1">
                      <span className="text-xs text-gray-400">Destination URL</span>
                      <input
                        placeholder="https://your-landing-page.com"
                        className={INPUT}
                        value={form.display_link}
                        onChange={onInput('display_link')}
                      />
                    </label>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-xs text-gray-400">Upload Video</span>
                  <input
                    type="file"
                    accept="video/*"
                    className={INPUT}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setVideoFile(file);
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setVideoPreviewUrl(url);
                        // clear any thumbnail preview when video is chosen
                        setThumbPreviewUrl(null);
                      } else {
                        setVideoPreviewUrl(null);
                      }
                    }}
                  />
                    </label>

                    <label className="block">
                      <span className="text-xs text-gray-400">Optional Thumbnail</span>
                  <input
                    type="file"
                    accept="image/*"
                    className={INPUT}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setThumbnailFile(file);
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setThumbPreviewUrl(url);
                        // clear any video preview when thumbnail is chosen
                        setVideoPreviewUrl(null);
                      } else {
                        setThumbPreviewUrl(null);
                      }
                    }}
                  />
                    </label>
                  </div>

                  <div className="text-xs text-gray-500">
                    Tracking: <span className="text-white">{trackingLink}</span>
                  </div>
                  <Disclosure title="How to craft a high‑performing Meta ad (tips & disclaimers)">
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Hook in 3 seconds:</strong> Front‑load the problem and benefit. Keep captions under ~125 characters for feed placements.</li>
                      <li><strong>Clear CTA:</strong> Your button must match intent (e.g., “Shop Now” for sales, “Learn More” for top‑funnel).</li>
                      <li><strong>Mobile‑first creative:</strong> Upload 1080×1350 or 1080×1920 where possible; keep safe margins for subtitles.</li>
                      <li><strong>Destination vs Display link:</strong> Destination should be your <em>tracking link</em>; Display can be your brand URL.</li>
                      <li><strong>Budget realism:</strong> If CPM is high, broaden placements or interests; avoid stacking too many narrow interests.</li>
                      <li><strong>Compliance:</strong> Don’t include restricted claims. You’re responsible for adhering to Meta’s ad policies.</li>
                    </ul>
                    <div className="mt-3 text-[12px] text-gray-400">
                      Disclaimer: Results vary by audience and creative. We may pause or reject ads that violate platform policies.
                    </div>
                  </Disclosure>
                </div>
              )}

              {/* Step 4: Review */}
              {step === 4 && (
                <div className="space-y-4 text-sm">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-[#101010] border border-[#232323]">
                      <div className="text-gray-400 text-xs mb-1">Campaign</div>
                      <div className="font-semibold">{form.campaign_name || '—'}</div>
                      <div className="text-gray-400 mt-1">Objective: {form.objective}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#101010] border border-[#232323]">
                      <div className="text-gray-400 text-xs mb-1">Budget</div>
                      <div className="font-semibold">
                        ${Number(form.budget_amount_dollars || 0).toFixed(2)} ({form.budget_type})
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#101010] border border-[#232323]">
                      <div className="text-gray-400 text-xs mb-1">Targeting</div>
                      <div>
                        {form.location_countries} • {form.age_min}-{form.age_max} •{' '}
                        {form.gender === '' ? 'All' : form.gender === '1' ? 'Male' : 'Female'}
                      </div>
                      {form.interests_csv && <div className="text-gray-400">Interests: {form.interests_csv}</div>}
                    </div>
                    <div className="p-3 rounded-lg bg-[#101010] border border-[#232323]">
                      <div className="text-gray-400 text-xs mb-1">Creative</div>
                      <div className="font-semibold">{form.headline || 'No headline'}</div>
                      <div className="text-gray-400">{form.caption || 'No caption'}</div>
                      <div className="text-gray-400 mt-1">
                        CTA: {form.call_to_action} → {form.display_link || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer / Nav */}
            <div className="px-6 sm:px-8 py-5 border-t border-[#232323] flex items-center justify-between">
              <button
                className="px-4 py-2 rounded-lg border border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a]"
                onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
              >
                {step > 1 ? 'Back' : 'Cancel'}
              </button>

              {step < 4 ? (
                <button
                  className="px-6 py-2 rounded-lg bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8]"
                  onClick={() => setStep(step + 1)}
                >
                  Next
                </button>
              ) : (
                <button
                  disabled={loading}
                  onClick={handleSubmit}
                  className="px-6 py-2 rounded-lg bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8] disabled:opacity-50"
                >
                  {loading ? 'Submitting…' : 'Submit for Review'}
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'organic' && (
          <div className="bg-[#141414] border border-[#232323] rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 sm:px-8 py-5 border-b border-[#232323] flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[#00C2CB]">Submit Organic Promotion</h2>
            </div>

            <div className="px-6 sm:px-8 py-6 space-y-5">
              <label className="block">
                <span className="text-xs text-gray-400">Method</span>
                <select className={INPUT} value={ogMethod} onChange={(e) => setOgMethod(e.target.value as any)}>
                  <option value="social">Social Post</option>
                  <option value="email">Email Campaign</option>
                  <option value="forum">Forum Posting</option>
                  <option value="other">Other</option>
                </select>
              </label>

              {ogMethod === 'social' && (
                <>
                  <label className="block">
                    <span className="text-xs text-gray-400">Platform</span>
                    <select className={INPUT} value={ogPlatform} onChange={(e) => setOgPlatform(e.target.value)}>
                      <option>Facebook</option>
                      <option>Instagram</option>
                      <option>TikTok</option>
                      <option>LinkedIn</option>
                      <option>X (Twitter)</option>
                      <option>YouTube</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs text-gray-400">Post caption</span>
                    <textarea className={INPUT} placeholder="Write your caption…" value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} />
                  </label>

                  <label className="block">
                    <span className="text-xs text-gray-400">Optional image/video</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className={INPUT}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setOgFile(file || null);
                      }}
                    />
                    <div className="mt-2">
                      <Disclosure
                        title="Most devices supported — tap for video format details"
                        defaultOpen={false}
                      >
                        <div className="flex items-start gap-2">
                          <svg
                            width="18"
                            height="18"
                            fill="none"
                            className="shrink-0 mt-0.5"
                            viewBox="0 0 24 24"
                          >
                            <circle cx="12" cy="12" r="10" stroke="#00C2CB" strokeWidth="2" />
                            <rect x="11" y="7" width="2" height="2" rx="1" fill="#00C2CB" />
                            <rect x="11" y="11" width="2" height="6" rx="1" fill="#00C2CB" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-200">
                            Most iPhone and camera formats are supported (images + videos).
                            For the smoothest cross-platform playback we recommend
                            <span className="font-bold"> MP4/H.264</span>.
                            If a file doesn&apos;t play nicely in preview, you can still submit it, or
                            <span className="underline ml-1">
                              <a
                                href="https://cloudconvert.com"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                convert it here
                              </a>
                            </span>
                            if needed.
                          </span>
                        </div>
                      </Disclosure>
                    </div>
                  </label>
                </>
              )}

              {ogMethod === 'email' && (
                <>
                  <label className="block">
                    <span className="text-xs text-gray-400">Subject</span>
                    <input className={INPUT} value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} placeholder="e.g. A special offer just for you" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Body</span>
                    <textarea className={INPUT} rows={6} value={ogContent} onChange={(e) => setOgContent(e.target.value)} placeholder="Your email body here…" />
                  </label>
                </>
              )}

              {ogMethod === 'forum' && (
                <>
                  <label className="block">
                    <span className="text-xs text-gray-400">Forum / URL</span>
                    <input className={INPUT} value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} placeholder="e.g. reddit.com/r/yourcommunity" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Post content</span>
                    <textarea className={INPUT} rows={6} value={ogContent} onChange={(e) => setOgContent(e.target.value)} placeholder="What will you post?" />
                  </label>
                </>
              )}

              {ogMethod === 'other' && (
                <>
                  <label className="block">
                    <span className="text-xs text-gray-400">Summary</span>
                    <input className={INPUT} value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} placeholder="e.g. Influencer outreach, local event, SMS, etc." />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Details / Criteria</span>
                    <textarea className={INPUT} rows={6} value={ogContent} onChange={(e) => setOgContent(e.target.value)} placeholder="Describe how and where this will be executed. Include audience, platform/domain if relevant." />
                  </label>
                </>
              )}
    <Disclosure title="How to submit a strong organic promotion (tips & disclaimers)">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Video file format:</strong> We accept most common camera and phone formats (MOV, MP4, HEVC, etc.).
                    For the best compatibility across browsers, we still recommend <span className="font-bold">MP4/H.264</span>.
                    If a file doesn&apos;t preview correctly, you can try a quick
                    <a
                      href="https://cloudconvert.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline ml-1 hover:text-[#00C2CB]"
                    >
                      conversion
                    </a>
                    before re‑uploading.
                  </li>
                  <li><strong>Match the venue:</strong> Keep tone and length native to the platform (e.g., shorter for Instagram, value‑heavy for LinkedIn, context‑rich for forums).</li>
                  <li><strong>Be specific:</strong> Include audience and posting context (e.g., community names, newsletter segment, send time).</li>
                  <li><strong>Media matters:</strong> Prefer vertical 1080×1920 or square 1080×1080; add alt text where possible.</li>
                  <li><strong>Tracking:</strong> After business approval you’ll receive a <em>dynamic tracking link</em>. Use only in approved areas.</li>
                  <li><strong>Auto‑disable:</strong> If clicks originate outside approved areas, the link is automatically disabled.</li>
                  <li><strong>No misrepresentation:</strong> Don’t impersonate the brand; clearly mark affiliate content if required by the platform.</li>
                </ul>
                <div className="mt-3 text-[12px] text-gray-400">
                  Disclaimer: Organic performance depends on the platform algorithms and audience fit. We may revoke approval if posts are edited in a way that breaches guidelines.
                </div>
              </Disclosure>
            </div>

            <div className="px-6 sm:px-8 py-5 border-t border-[#232323] flex items-center justify-end">
              <button
                disabled={ogLoading}
                onClick={handleOrganicSubmit}
                className="px-6 py-2 rounded-lg bg-[#00C2CB] text-black font-semibold hover:bg-[#00b0b8] disabled:opacity-50"
              >
                {ogLoading ? 'Submitting…' : 'Submit for Review'}
              </button>
            </div>
          </div>
        )}

        {/* RIGHT: Preview / Metrics */}
        <aside className="space-y-6">
          {/* Estimated Reach */}
          {mode === 'ad' && (
            <div className="bg-[#141414] border border-[#232323] rounded-2xl p-5">
              <div className="text-sm font-semibold mb-2">Estimated Reach</div>
              <div className="flex items-center gap-8">
                <div>
                  <div className="text-[11px] text-gray-400">Daily</div>
                  <div className="text-2xl font-extrabold text-[#00C2CB]">{reachDaily !== null ? reachDaily.toLocaleString() : '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400">Monthly</div>
                  <div className="text-2xl font-extrabold text-[#00C2CB]">{reachMonthly !== null ? reachMonthly.toLocaleString() : '—'}</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Estimated unique users based on your ad set targeting.
                {interestsIgnored && (
                  <span className="block mt-1 text-[11px] text-gray-500">Some typed interests were ignored because they didn’t match official Meta interest IDs.</span>
                )}
              </div>
            </div>
          )}

          {mode === 'ad' && (
            <div className="rounded-2xl p-4 border border-[#232323] bg-[#121212]">
              <div className="text-sm font-semibold mb-3">Estimated Conversions</div>
              <div className="flex gap-8 items-end">
                <div>
                  <div className="text-[11px] text-gray-400">Daily</div>
                  <div className="text-2xl font-extrabold text-[#00C2CB]">
                    {Number.isFinite(dailyConversions) ? Math.floor(dailyConversions).toLocaleString() : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400">Monthly</div>
                  <div className="text-2xl font-extrabold text-[#00C2CB]">
                    {Number.isFinite(monthlyConversions) ? Math.floor(monthlyConversions).toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ad Preview Card */}
          {mode === 'ad' && (
            <div className="bg-[#141414] border border-[#232323] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                {brandLogoUrl ? (
                  <img
                    src={brandLogoUrl}
                    alt={brandName}
                    className="h-8 w-8 rounded-full object-cover border border-[#2a2a2a]"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#2a2a2a]" />
                )}
                <div>
                  <div className="text-sm font-semibold">{brandName}</div>
                  <div className="text-xs text-gray-400">Sponsored</div>
                </div>
              </div>

              <div className="aspect-[4/5] w-full rounded-lg bg-[#0f0f0f] border border-[#232323] overflow-hidden">
                {videoPreviewUrl ? (
                  <video
                    src={videoPreviewUrl}
                    className="h-full w-full object-cover"
                    controls
                    playsInline
                    muted
                  />
                ) : thumbPreviewUrl ? (
                  <img
                    src={thumbPreviewUrl}
                    alt="Thumbnail preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-500 text-sm">
                    Your ad image/video will appear here
                  </div>
                )}
              </div>

              <div className="mt-3">
                <div className="font-semibold">{form.headline || 'Your headline will appear here'}</div>
                <div className="text-sm text-gray-400">
                  {form.caption || 'Your ad description will appear here. Make it compelling!'}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {form.display_link || 'yourdomain.com'}
                  </div>
                  <button className="px-3 py-1 rounded-md bg-[#00C2CB] text-black text-sm font-semibold">
                    {form.call_to_action.replace('_', ' ') || 'Learn More'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {mode === 'organic' && ogMethod === 'social' && (
            <div className="bg-[#141414] border border-[#232323] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                {brandLogoUrl ? (
                  <img
                    src={brandLogoUrl}
                    alt={brandName}
                    className="h-8 w-8 rounded-full object-cover border border-[#2a2a2a]"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#2a2a2a]" />
                )}
                <div>
                  <div className="text-sm font-semibold">{brandName}</div>
                  <div className="text-xs text-gray-400">Organic Preview</div>
                </div>
              </div>

              <div className="aspect-[4/5] w-full rounded-lg bg-[#0f0f0f] border border-[#232323] overflow-hidden">
                {ogFile && ogFile.type.startsWith('video/') ? (
                  <video
                    src={ogFile ? URL.createObjectURL(ogFile) : undefined}
                    className="h-full w-full object-cover"
                    controls
                    playsInline
                    muted
                  />
                ) : ogFile && ogFile.type.startsWith('image/') ? (
                  <img
                    src={ogFile ? URL.createObjectURL(ogFile) : undefined}
                    alt="Organic media preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-500 text-sm">
                    Your social media image/video will appear here
                  </div>
                )}
              </div>

              <div className="mt-3">
                <div className="font-semibold">{ogPlatform}</div>
                <div className="text-sm text-gray-400 whitespace-pre-wrap">
                  {ogCaption || 'Write your caption to preview it here.'}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}