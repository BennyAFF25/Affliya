'use client';

// Helper: friendlyObjective
function friendlyObjective(objective?: string): string {
  switch (objective) {
    case 'OUTCOME_SALES':
      return 'Sales';
    case 'OUTCOME_LEADS':
      return 'Leads';
    case 'OUTCOME_ENGAGEMENT':
      return 'Engagement';
    case 'OUTCOME_VIDEO_VIEWS':
      return 'Video Views';
    case 'OUTCOME_REACH':
      return 'Reach';
    case 'OUTCOME_AWARENESS':
      return 'Awareness';
    default:
      return 'Traffic';
  }
}
// eslint-disable-next-line

import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { nmToast } from "@/components/ui/toast";
import { FaSpinner } from "react-icons/fa";
import { useRouter, useParams } from 'next/navigation';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from '@/../utils/supabase/pages-client';
import { fetchReachEstimate } from '@/../utils/meta/fetchReachEstimate';

import { AdFormState, GenderOpt, PlacementKey } from '../types';

import { INPUT } from '../constants';

import { AdCampaignWizard } from '../components/AdCampaignWizard';
import { OrganicSubmissionForm } from '../components/OrganicSubmissionForm';
import { PreviewSidebar } from '../components/PreviewSidebar';

  // --- Lightweight row types for Supabase queries
  type OfferRow = {
    title?: string | null;
    logo_url?: string | null;
    business_email?: string | null;
    website?: string | null; // use website from offers table
    meta_page_id?: string | null;
  };

  type OfferBusinessEmailRow = {
    business_email: string | null;
  };

  type MetaConnectionRow = {
    access_token?: string | null;
    ad_account_id?: string | null;
    page_id?: string | null;
    updated_at?: string | null;
  };

export default function PromoteOfferPage() {
  // Advanced bidding accordion state
  // Removed loading states
  const router = useRouter();
  const params = useParams();
  const offerId = params.offerId as string;

  const session = useSession();
  const userEmail = session?.user?.email || '';

  // ─────────────────────────────
  // Organic flow state (non-invasive)
  // ─────────────────────────────
  const [mode, setMode] = useState<'ad' | 'organic'>('ad');

  // Wallet balance state (real-time gating)
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState<boolean>(true);
  // ─────────────────────────────
  // Wallet balance loader
  // ─────────────────────────────
  useEffect(() => {
    if (!userEmail) return;

    const loadWallet = async () => {
      setWalletLoading(true);
      const { data, error } = await (supabase as any)
        .from('wallet_topups')
        .select('amount_net, amount_refunded, status')
        .eq('affiliate_email', userEmail)
        .eq('status', 'succeeded');

      if (error) {
        console.error('[wallet load error]', error);
        setWalletBalance(0);
      } else {
        const total = (data || []).reduce((sum: number, row: any) => {
          const net = Number(row.amount_net || 0);
          const refunded = Number(row.amount_refunded || 0);
          return sum + Math.max(0, net - refunded);
        }, 0);
        setWalletBalance(total);
      }
      setWalletLoading(false);
    };

    loadWallet();
  }, [userEmail]);

  // Organic method + fields
  const [ogMethod, setOgMethod] = useState<'social' | 'email' | 'forum' | 'other'>('social');
  const [ogPlatform, setOgPlatform] = useState<string>('Facebook'); // for social
  const [ogCaption, setOgCaption] = useState<string>('');           // social caption OR email subject OR forum title/url
  const [ogContent, setOgContent] = useState<string>('');           // email body / forum body
  const [ogFile, setOgFile] = useState<File | null>(null);          // optional media for social
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
  // ─────────────────────────────
  // Simplified, Meta-aligned form state
  // (campaign → ad set → ad creative)
  // ─────────────────────────────
  const [form, setForm] = useState<AdFormState>({
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

    // Bidding
    bid_strategy: 'LOWEST_COST' as 'LOWEST_COST' | 'BID_CAP',
    bid_cap_dollars: '' as number | '',
  });

  // ─────────────────────────────
  // Wallet gating derived values (safe – after form init)
  // ─────────────────────────────
  const requiredBudget = Number(form?.budget_amount_dollars || 0);
  const walletDeficit = Math.max(0, requiredBudget - walletBalance);
  const canRunWithWallet = walletBalance >= requiredBudget;

  // Media
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  // Thumbnail error state for submission validation
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  // Thumbnail validation (Meta does NOT accept SVG thumbnails)
  const ALLOWED_THUMB_MIME = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_THUMB_BYTES = 8 * 1024 * 1024; // 8MB

  function validateThumbnailFile(file: File): string | null {
    const name = (file?.name || '').toLowerCase();
    const type = file?.type || '';

    // Block SVG explicitly (Meta ingestion fails)
    if (type === 'image/svg+xml' || name.endsWith('.svg')) {
      return 'Thumbnail must be a PNG/JPG/WebP (SVG is not supported by Meta).';
    }

    // Block HEIC/HEIF (common iPhone format that often fails)
    if (type === 'image/heic' || type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')) {
      return 'Thumbnail must be a PNG/JPG/WebP (HEIC/HEIF is not supported).';
    }

    if (!ALLOWED_THUMB_MIME.includes(type)) {
      return 'Thumbnail must be a PNG/JPG/WebP image.';
    }

    if (file.size > MAX_THUMB_BYTES) {
      return 'Thumbnail is too large. Please upload an image under 8MB.';
    }

    return null;
  }

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
        .select('title, logo_url, business_email, website, meta_page_id')
        .eq('id', offerId)
        .single();

      if (offerErr) {
        console.error('[offer fetch error]', offerErr);
        return;
      }

      // Preview title + logo
      setBrandName(offer?.title || 'Your Brand Name');
      setBrandLogoUrl(offer?.logo_url || null);
      // Pre-fill Destination URL with the business website if available
      if (offer?.website) {
        setForm((p) => ({
          ...p,
          display_link: p.display_link || offer.website!,
        }));
      }

      // 2) Meta creds by business_email (from meta_connections)
      // AppleDash + similar cases can have multiple rows per business_email (different pages/ad accounts).
      // Pick the row that matches offer.meta_page_id first, then fallback to most recent valid row.
      setBiz(null);
      if (offer?.business_email) {
        const { data: mcRows, error: mcErr } = await (supabase as any)
          .from('meta_connections')
          .select('access_token, ad_account_id, page_id, updated_at')
          .eq('business_email', offer.business_email as string)
          .order('updated_at', { ascending: false });

        if (mcErr) {
          console.warn('[meta_connections fetch warn]', mcErr);
        } else {
          const rows = (mcRows || []) as MetaConnectionRow[];
          const valid = rows.filter((r) => !!r?.access_token && !!r?.ad_account_id);
          const offerPageId = String((offer as OfferRow)?.meta_page_id || '').trim();

          const matchedByPage = offerPageId
            ? valid.find((r) => String(r.page_id || '').trim() === offerPageId)
            : null;

          const chosen = matchedByPage || valid[0] || null;

          if (chosen?.access_token && chosen?.ad_account_id) {
            setBiz({ access_token: chosen.access_token, ad_account_id: chosen.ad_account_id });
          }
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
  const [reachStatus, setReachStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>('idle');
  const [reachMessage, setReachMessage] = useState<string>('');
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
      // We prefer client-resolved biz creds when available, but server can fallback via offer_id.
      const numericAd = biz?.ad_account_id ? String(biz.ad_account_id).replace(/^act_/, '') : '';

      const countries = form.location_countries
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (countries.length === 0) {
        setReachStatus('idle');
        setReachMessage('Select at least one country to estimate reach.');
        setReachDaily(null);
        setReachMonthly(null);
        return;
      }

      const age_min = Number(form.age_min || 18);
      const age_max = Number(form.age_max || 65);
      if (age_min < 13 || age_max < age_min) {
        setReachStatus('idle');
        setReachMessage('Adjust age range to continue estimating reach.');
        setReachDaily(null);
        setReachMonthly(null);
        return;
      }

      setReachStatus('loading');
      setReachMessage('Loading estimate…');

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
        access_token: biz?.access_token,
        ad_account_id: numericAd,
        offer_id: offerId,
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

      if (dau !== null || mau !== null) {
        setReachStatus('ready');
        setReachMessage('Estimate updated from Meta delivery data.');
      } else {
        setReachStatus('unavailable');
        setReachMessage('Meta returned no estimate for this targeting.');
      }
    } catch (e: any) {
      console.warn('[Reach Estimate Error]', e);
      setReachDaily(null);
      setReachMonthly(null);
      setReachStatus('error');
      const msg = e?.message?.toLowerCase?.() || '';
      if (msg.includes('access token')) {
        setReachMessage('Meta token expired or invalid. Reconnect Meta to restore estimates.');
      } else {
        setReachMessage('Could not load estimate right now. Please try again.');
      }
    }
  }, 600);

  useEffect(() => {
    triggerReach();
    // include placements so toggling them updates estimate
  }, [
    biz,
    offerId,
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
  function applyEstimatorPreset(kind: 'dtc' | 'lead') {
    if (kind === 'dtc') { setAssumeCPM(12); setAssumeCTR(1.5); setAssumeCVR(1.5); }
    if (kind === 'lead') { setAssumeCPM(10); setAssumeCTR(1.0); setAssumeCVR(4.0); }
  }

  const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');



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


  // ─────────────────────────────
  // Organic submit (direct insert to organic_posts)
  // ─────────────────────────────
  const handleOrganicSubmit = async () => {
    try {
      if (!userEmail) { nmToast.error("You must be signed in."); return; }
      if (!userId) { nmToast.error("Missing user session."); return; }

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

      nmToast.success("Organic post submitted for review");
      // Reset organic fields
      setOgCaption('');
      setOgContent('');
      setOgFile(null);
    } catch (e: any) {
      const msg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
      console.error('[Organic Submit Error]', msg, e);
      nmToast.error(msg || "Failed to submit organic post");
    }
  };

  // ─────────────────────────────
  // Submit (Uploads → ad_ideas insert)
  // ─────────────────────────────
  const handleAdSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      // UI-side safety: if Bid Cap selected, require a value
      if (form.bid_strategy === 'BID_CAP') {
        const cap = Number(form.bid_cap_dollars);
        if (!cap || cap <= 0) {
          nmToast.error('Please enter a valid bid cap amount when using Bid Cap.');
          return;
        }
      }
      // Require thumbnail before submission
      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        // This will be set after upload, but for validation before upload, check existence
        thumbnailUrl = thumbnailFile.name;
      }
      if (!thumbnailUrl || thumbnailUrl.trim() === '') {
        setThumbnailError('Please upload a thumbnail before submitting.');
        return;
      } else {
        setThumbnailError(null);
      }

      if (!videoFile) {
        nmToast.error("Please upload a video file");
        return;
      }

      // 0) Ensure budget does not exceed prefunded wallet
      const budgetDollars = Number(form.budget_amount_dollars || 0);
      if (!budgetDollars || budgetDollars <= 0) {
        nmToast.error("Please enter a valid daily budget");
        return;
      }

      const { data: walletRows, error: walletErr } = await (supabase as any)
        .from('wallet_topups')
        .select('amount_net, amount_refunded, status')
        .eq('affiliate_email', userEmail)
        .eq('status', 'succeeded');

      if (walletErr) {
        console.error('[wallet_topups check error]', walletErr);
      }

      const walletTotal = (walletRows || []).reduce((sum: number, row: any) => {
        const net = Number(row.amount_net || 0);
        const refunded = Number(row.amount_refunded || 0);
        return sum + Math.max(0, net - refunded);
      }, 0);

      if (walletTotal < budgetDollars) {
        nmToast.error(
          `Daily budget ($${budgetDollars.toFixed(2)}) exceeds your available wallet balance ($${walletTotal.toFixed(2)}).`
        );
        return;
      }

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

      // Force stronger optimisation defaults (critical for spend)
      const optimisation_goal =
        form.objective === 'OUTCOME_SALES'
          ? 'OFFSITE_CONVERSIONS'
          : 'REACH';

      const conversion_location =
        form.objective === 'OUTCOME_SALES' ? 'WEBSITE' : null;

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
        performance_goal: optimisation_goal,
        conversion_location,
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
        // display_link is what appears on the ad (brand/site URL)
        display_link: form.display_link || null,
        // tracking_link is the hidden redirect we use for attribution
        tracking_link: trackingLink,

        // bidding
        // NOTE: bid_cap is stored in DOLLARS in `ad_ideas`.
        // The server route should convert to cents ONCE right before sending to Meta.
        bid_strategy: form.bid_strategy,
        bid_cap:
          form.bid_strategy === 'BID_CAP'
            ? Number(form.bid_cap_dollars)
            : null,

        // workflow
        status: 'pending', // business will approve → then we push to Meta via server route
        meta_status: null,
      };

      console.log('[BID CAP DEBUG]', {
        bid_strategy: form.bid_strategy,
        bid_cap_dollars: form.bid_cap_dollars,
        bid_cap_saved_to_db: insertPayload.bid_cap,
      });

      const { error: insertErr } = await (supabase.from('ad_ideas') as any).insert([
        insertPayload as any,
      ]);
      if (insertErr) throw insertErr;

      nmToast.success("Ad idea submitted for review");
      router.push('/affiliate/dashboard'); // back to dashboard after submit
    } catch (e: any) {
      console.error('[❌ Submit Error]', e);
      nmToast.error(e?.message || "Failed to submit ad idea");
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


  return (
    <div className="min-h-screen py-10 px-6 bg-surface text-white pb-8">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_360px] gap-8">
        {/* Mode toggle (Ad vs Organic) */}
        <div className="lg:col-span-2 -mb-2 flex items-center justify-between">
          <div className="flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setMode('ad')}
              className={['px-4 py-2 rounded-lg border text-sm', mode === 'ad' ? 'bg-[#00C2CB] text-black border-[#00C2CB]' : 'border-[#2a2a2a] text-gray-300 hover:bg-[#151515]'].join(' ')}
            >
              Submit Ad
            </button>
            <button
              type="button"
              onClick={() => setMode('organic')}
              className={['px-4 py-2 rounded-lg border text-sm', mode === 'organic' ? 'bg-[#00C2CB] text-black border-[#00C2CB]' : 'border-[#2a2a2a] text-gray-300 hover:bg-[#151515]'].join(' ')}
            >
              Submit Organic
            </button>
          </div>
        </div>
        {/* LEFT: single card wizard */}
        {mode === 'ad' && (
          <AdCampaignWizard
            form={form}
            setForm={setForm}
            onInput={onInput}
            onPlacementToggle={onPlacementToggle}
            applyEstimatorPreset={applyEstimatorPreset}
            walletBalance={walletBalance}
            walletLoading={walletLoading}
            canRunWithWallet={canRunWithWallet}
            walletDeficit={walletDeficit}
            incBudget={incBudget}
            setStartIn15m={setStartIn15m}
            setEndIn7d={setEndIn7d}
            reachDaily={reachDaily}
            reachMonthly={reachMonthly}
            interestsIgnored={interestsIgnored}
            videoFile={videoFile}
            setVideoFile={setVideoFile}
            thumbnailFile={thumbnailFile}
            setThumbnailFile={setThumbnailFile}
            thumbnailError={thumbnailError}
            setThumbnailError={setThumbnailError}
            validateThumbnailFile={validateThumbnailFile}
            setVideoPreviewUrl={setVideoPreviewUrl}
            setThumbPreviewUrl={setThumbPreviewUrl}
            handleAdSubmit={handleAdSubmit}
            onNavigateToWallet={() => router.push('/affiliate/wallet')}
          />
        )}


        {mode === 'organic' && (
          <OrganicSubmissionForm
            ogMethod={ogMethod}
            setOgMethod={setOgMethod}
            ogPlatform={ogPlatform}
            setOgPlatform={setOgPlatform}
            ogCaption={ogCaption}
            setOgCaption={setOgCaption}
            ogContent={ogContent}
            setOgContent={setOgContent}
            ogFile={ogFile}
            setOgFile={setOgFile}
            handleOrganicSubmit={handleOrganicSubmit}
          />
        )}

        {/* RIGHT: Preview / Metrics */}
        <PreviewSidebar
          mode={mode}
          reachDaily={reachDaily}
          reachMonthly={reachMonthly}
          reachStatus={reachStatus}
          reachMessage={reachMessage}
          interestsIgnored={interestsIgnored}
          dailyConversions={dailyConversions}
          monthlyConversions={monthlyConversions}
          brandName={brandName}
          brandLogoUrl={brandLogoUrl}
          videoPreviewUrl={videoPreviewUrl}
          thumbPreviewUrl={thumbPreviewUrl}
          form={form}
          ogMethod={ogMethod}
          ogFile={ogFile}
          ogPlatform={ogPlatform}
          ogCaption={ogCaption}
        />
      </div>
    </div>
  );
}