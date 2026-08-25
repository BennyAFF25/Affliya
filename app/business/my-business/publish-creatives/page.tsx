"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import {
  FiArchive,
  FiEdit3,
  FiEye,
  FiFilm,
  FiFolder,
  FiGlobe,
  FiLayers,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { nmToast } from "@/components/ui/toast";
import type { ContentLibraryAsset } from "@/../utils/contentLibrary";
import { getApprovalLabel, getUsageScopeLabel } from "@/../utils/contentLibrary";

const FILTERS = ["all", "image", "video", "paid", "organic", "archived"] as const;
type FilterKey = (typeof FILTERS)[number];

type OfferOption = { id: string; title: string };

type AssetFormState = {
  id: string | null;
  title: string;
  caption: string;
  offerId: string;
  usageScope: "all" | "offer";
  allowOrganic: boolean;
  allowPaid: boolean;
  organicPreapproved: boolean;
  paidPreapproved: boolean;
  isActive: boolean;
  file: File | null;
  thumbnail: File | null;
  clearThumbnail: boolean;
};

const EMPTY_FORM: AssetFormState = {
  id: null,
  title: "",
  caption: "",
  offerId: "",
  usageScope: "all",
  allowOrganic: true,
  allowPaid: false,
  organicPreapproved: false,
  paidPreapproved: false,
  isActive: true,
  file: null,
  thumbnail: null,
  clearThumbnail: false,
};

function StatBadge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" }) {
  const className =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : "border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)]";

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}>{children}</span>;
}

function buildFormData(form: AssetFormState) {
  const fd = new FormData();
  fd.set("title", form.title);
  fd.set("caption", form.caption);
  fd.set("offer_id", form.usageScope === "offer" ? form.offerId : "");
  fd.set("allow_organic", String(form.allowOrganic));
  fd.set("allow_paid", String(form.allowPaid));
  fd.set("organic_preapproved", String(form.organicPreapproved));
  fd.set("paid_preapproved", String(form.paidPreapproved));
  fd.set("is_active", String(form.isActive));
  fd.set("replace_thumbnail", String(form.clearThumbnail));
  if (form.file) fd.set("file", form.file);
  if (form.thumbnail) fd.set("thumbnail", form.thumbnail);
  return fd;
}

function deriveFormState(asset: ContentLibraryAsset): AssetFormState {
  return {
    id: asset.id,
    title: asset.title || "",
    caption: asset.caption || "",
    offerId: asset.offer_id || "",
    usageScope: asset.offer_id ? "offer" : "all",
    allowOrganic: !!asset.allow_organic,
    allowPaid: !!asset.allow_paid,
    organicPreapproved: !!asset.organic_preapproved,
    paidPreapproved: !!asset.paid_preapproved,
    isActive: !!asset.is_active,
    file: null,
    thumbnail: null,
    clearThumbnail: false,
  };
}

export default function BusinessCreativesPage() {
  const session = useSession();
  const user = session?.user;
  const [assets, setAssets] = useState<ContentLibraryAsset[]>([]);
  const [offers, setOffers] = useState<OfferOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState<AssetFormState>(EMPTY_FORM);

  const loadLibrary = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/business/content-library", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load content library");
      }
      setAssets(json.assets || []);
      setOffers(json.offers || []);
    } catch (error: any) {
      console.error("[content-library] load error", error);
      nmToast.error(error?.message || "Failed to load content library");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.email) return;
    void loadLibrary();
  }, [user?.email]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const shouldOpen = params.get("open") === "1";
    if (!shouldOpen) return;

    const offerId = params.get("offerId") || "";
    const requestedScope = params.get("scope") === "offer" ? "offer" : "all";

    if (requestedScope === "offer") {
      openCreateForScope("offer", offerId);
      return;
    }

    openCreateForScope("all");
  }, []);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "archived") return !asset.is_active;
      if (activeFilter === "image") return asset.media_type === "image" && asset.is_active;
      if (activeFilter === "video") return asset.media_type === "video" && asset.is_active;
      if (activeFilter === "paid") return !!asset.allow_paid && asset.is_active;
      if (activeFilter === "organic") return !!asset.allow_organic && asset.is_active;
      return true;
    });
  }, [activeFilter, assets]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setIsEditorOpen(true);
  };

  const openCreateForScope = (scope: "all" | "offer", offerId = "") => {
    setForm({
      ...EMPTY_FORM,
      usageScope: scope,
      offerId: scope === "offer" ? offerId : "",
    });
    setIsEditorOpen(true);
  };

  const openEdit = (asset: ContentLibraryAsset) => {
    setForm(deriveFormState(asset));
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setForm(EMPTY_FORM);
    setIsEditorOpen(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      nmToast.error("Add a title so affiliates can recognize this creative.");
      return;
    }
    if (!form.allowOrganic && !form.allowPaid) {
      nmToast.error("Choose at least one usage mode.");
      return;
    }
    if (form.usageScope === "offer" && !form.offerId) {
      nmToast.error("Choose an offer or switch this asset to all offers.");
      return;
    }
    if (!form.id && !form.file) {
      nmToast.error("Upload an image or video to create the asset.");
      return;
    }

    setSaving(true);
    try {
      const endpoint = form.id ? `/api/business/content-library/${form.id}` : "/api/business/content-library";
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        body: buildFormData(form),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to save asset");
      }
      nmToast.success(form.id ? "Asset updated" : "Asset uploaded");
      closeEditor();
      await loadLibrary();
    } catch (error: any) {
      console.error("[content-library] save error", error);
      nmToast.error(error?.message || "Failed to save asset");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (asset: ContentLibraryAsset) => {
    try {
      const fd = new FormData();
      fd.set("title", asset.title || "Untitled creative");
      fd.set("caption", asset.caption || "");
      fd.set("offer_id", asset.offer_id || "");
      fd.set("allow_organic", String(!!asset.allow_organic));
      fd.set("allow_paid", String(!!asset.allow_paid));
      fd.set("organic_preapproved", String(!!asset.organic_preapproved));
      fd.set("paid_preapproved", String(!!asset.paid_preapproved));
      fd.set("is_active", String(!asset.is_active));
      const res = await fetch(`/api/business/content-library/${asset.id}`, { method: "PATCH", body: fd });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to update asset");
      nmToast.success(asset.is_active ? "Asset archived" : "Asset restored");
      await loadLibrary();
    } catch (error: any) {
      nmToast.error(error?.message || "Failed to update asset");
    }
  };

  const handleDelete = async (asset: ContentLibraryAsset) => {
    const confirmed = window.confirm(`Delete \"${asset.title || "Untitled creative"}\"? This only works if it has never been used in a promotion.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/business/content-library/${asset.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to delete asset");
      nmToast.success("Asset deleted");
      await loadLibrary();
    } catch (error: any) {
      nmToast.error(error?.message || "Failed to delete asset");
    }
  };

  const activeCount = assets.filter((asset) => asset.is_active).length;
  const readyCount = assets.filter((asset) => asset.is_active && (asset.allow_organic || asset.allow_paid)).length;
  const offerScopedCount = assets.filter((asset) => asset.is_active && !!asset.offer_id).length;

  return (
    <div className="publish-creatives-theme min-h-screen w-full bg-[var(--background)] p-6 sm:p-10 text-[var(--foreground)]">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#7ff5fb]">
                <FiFolder className="h-3.5 w-3.5" />
                Content Library
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">Content Library</h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--muted-foreground)] sm:text-base">
                Upload approved ads, images, videos, and suggested copy that affiliates can use to promote your offers. You can keep assets global across all offers or attach them to one specific offer.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadLibrary()}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-sm font-medium text-[var(--secondary-foreground)] transition hover:opacity-90"
              >
                <FiRefreshCw /> Refresh
              </button>
              <button
                type="button"
                onClick={() => openCreateForScope("all")}
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-[0_0_18px_rgba(0,194,203,0.18)] transition hover:brightness-110"
              >
                <FiPlus /> Upload content
              </button>
              <button
                type="button"
                onClick={() => openCreateForScope("offer")}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-4 py-3 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/15"
              >
                <FiLayers /> Attach to an offer
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Active assets</p>
              <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{activeCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Affiliate-ready now</p>
              <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{readyCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Archived</p>
              <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{assets.length - activeCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Offer-specific assets</p>
              <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{offerScopedCount}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              <FiEye /> How this works
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted-foreground)]">
              <li>• Upload brand content once, then let affiliates pick it directly inside <strong>Start promoting</strong>.</li>
              <li>• Choose <strong>All business offers</strong> for reusable evergreen assets.</li>
              <li>• Choose <strong>One specific offer</strong> when a creative should only appear for one offer.</li>
              <li>• Paid video assets need a thumbnail before they can be used in paid ad flows.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              <FiLayers /> Offer attachment
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Want a creative to show only on one offer? Use <strong>Attach to an offer</strong>, then choose the offer inside the upload form.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {offers.slice(0, 6).map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => openCreateForScope("offer", offer.id)}
                  className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs font-medium text-[var(--secondary-foreground)] hover:border-[var(--primary)]/35"
                >
                  {offer.title}
                </button>
              ))}
              {!offers.length ? (
                <span className="text-xs text-[var(--muted-foreground)]">Create an offer first, then attach creatives to it here.</span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={[
                  "rounded-full border px-3 py-2 text-sm font-medium transition",
                  activeFilter === filter
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-90",
                ].join(" ")}
              >
                {filter === "all" ? "All" : filter === "image" ? "Images" : filter === "video" ? "Videos" : filter === "paid" ? "Paid approved" : filter === "organic" ? "Organic approved" : "Archived"}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-12 text-center text-[var(--muted-foreground)]">Loading content library…</div>
        ) : filteredAssets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--secondary)] text-[var(--primary)]">
              <FiUpload className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Give affiliates something to start with.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--muted-foreground)]">
              Upload product images, videos, or existing content so affiliates can start promoting faster.
            </p>
            <button
              type="button"
              onClick={() => openCreateForScope("all")}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)]"
            >
              <FiPlus /> Upload your first creative
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredAssets.map((asset) => (
              <article key={asset.id} className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
                <div className="relative aspect-[4/3] bg-black/60">
                  {asset.media_type === "video" ? (
                    <video controls className="h-full w-full object-cover" poster={asset.thumbnail_url || undefined}>
                      <source src={asset.media_url} />
                    </video>
                  ) : (
                    <img src={asset.media_url} alt={asset.title || "Creative preview"} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <StatBadge tone={asset.is_active ? "success" : "warning"}>{asset.is_active ? "Available" : "Archived"}</StatBadge>
                    <StatBadge>{asset.media_type === "video" ? "Video" : "Image"}</StatBadge>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">{asset.title || "Untitled creative"}</h3>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)] line-clamp-3">{asset.caption || "No suggested copy yet."}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {asset.allow_organic && <StatBadge>Organic</StatBadge>}
                    {asset.allow_paid && <StatBadge>Paid ads</StatBadge>}
                    <StatBadge>{getApprovalLabel(asset)}</StatBadge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Offer scope</p>
                      <p className="mt-2 font-medium text-[var(--foreground)]">{getUsageScopeLabel(asset)}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Usage count</p>
                      <p className="mt-2 font-medium text-[var(--foreground)]">{asset.usage_count || 0}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEdit(asset)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]">
                      <FiEdit3 /> Edit
                    </button>
                    <button type="button" onClick={() => void handleArchiveToggle(asset)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)]">
                      <FiArchive /> {asset.is_active ? "Archive" : "Restore"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(asset)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-500/25 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-500/10"
                    >
                      <FiTrash2 /> Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">{form.id ? "Edit content asset" : "Upload content"}</h2>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">Upload once, then let affiliates reuse it in the existing paid and organic promotion flows.</p>
              </div>
              <button type="button" onClick={closeEditor} className="rounded-full border border-[var(--border)] p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <FiX />
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Title</span>
                  <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] px-4 py-3 text-[var(--foreground)]" placeholder="e.g. Hero product shot" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">Suggested caption / copy</span>
                  <textarea value={form.caption} onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))} className="min-h-[140px] w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] px-4 py-3 text-[var(--foreground)]" placeholder="Give affiliates a strong starting point for their caption or ad copy." />
                </label>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"><FiLayers /> Offer association</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                    Attach this media to <strong>all offers</strong> or keep it limited to <strong>one specific offer</strong> if the creative is only approved for that listing.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, usageScope: "all", offerId: "" }))} className={`rounded-full px-3 py-2 text-sm ${form.usageScope === "all" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)]"}`}>
                      All business offers
                    </button>
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, usageScope: "offer" }))} className={`rounded-full px-3 py-2 text-sm ${form.usageScope === "offer" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)]"}`}>
                      One specific offer
                    </button>
                  </div>
                  {form.usageScope === "offer" && (
                    <div className="mt-4 space-y-3">
                      <select value={form.offerId} onChange={(e) => setForm((prev) => ({ ...prev, offerId: e.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] px-4 py-3 text-[var(--foreground)]">
                        <option value="">Select offer</option>
                        {offers.map((offer) => (
                          <option key={offer.id} value={offer.id}>{offer.title}</option>
                        ))}
                      </select>
                      {!!offers.length && (
                        <div className="flex flex-wrap gap-2">
                          {offers.slice(0, 8).map((offer) => (
                            <button
                              key={offer.id}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, offerId: offer.id, usageScope: "offer" }))}
                              className={`rounded-full px-3 py-2 text-xs font-medium ${form.offerId === offer.id ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)]"}`}
                            >
                              {offer.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"><FiGlobe /> Usage permissions</div>
                  <div className="mt-4 space-y-3">
                    <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] p-3">
                      <input type="checkbox" checked={form.allowOrganic} onChange={(e) => setForm((prev) => ({ ...prev, allowOrganic: e.target.checked }))} className="mt-1" />
                      <span>
                        <span className="block font-medium text-[var(--foreground)]">Available for organic</span>
                        <span className="block text-sm text-[var(--muted-foreground)]">Affiliates can use this in the organic review flow.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] p-3">
                      <input type="checkbox" checked={form.allowPaid} onChange={(e) => setForm((prev) => ({ ...prev, allowPaid: e.target.checked }))} className="mt-1" />
                      <span>
                        <span className="block font-medium text-[var(--foreground)]">Available for paid ads</span>
                        <span className="block text-sm text-[var(--muted-foreground)]">Affiliates can use this in the existing ad idea flow.</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"><FiEye /> Asset approval state</div>
                  <div className="mt-4 space-y-3">
                    <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] p-3">
                      <input type="checkbox" checked={form.organicPreapproved} onChange={(e) => setForm((prev) => ({ ...prev, organicPreapproved: e.target.checked }))} className="mt-1" />
                      <span>
                        <span className="block font-medium text-[var(--foreground)]">Organic pre-approved</span>
                        <span className="block text-sm text-[var(--muted-foreground)]">The media asset itself is approved for organic use, but affiliates still submit the final promotion for review.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] p-3">
                      <input type="checkbox" checked={form.paidPreapproved} onChange={(e) => setForm((prev) => ({ ...prev, paidPreapproved: e.target.checked }))} className="mt-1" />
                      <span>
                        <span className="block font-medium text-[var(--foreground)]">Paid pre-approved</span>
                        <span className="block text-sm text-[var(--muted-foreground)]">The media asset is approved for paid use, but budget, targeting, and final ad setup still follow the normal approval path.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] p-3">
                      <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} className="mt-1" />
                      <span>
                        <span className="block font-medium text-[var(--foreground)]">Available to affiliates</span>
                        <span className="block text-sm text-[var(--muted-foreground)]">Turn this off to archive the asset without breaking historical promotions.</span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"><FiUpload /> Media</div>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm text-[var(--muted-foreground)]">Image or video</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm" onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] px-4 py-3 text-[var(--foreground)]" />
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">Use JPG, PNG, WebP, MP4, MOV, or WebM. Paid video assets need a thumbnail.</p>
                  </label>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm text-[var(--muted-foreground)]">Video thumbnail (optional unless using paid video)</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setForm((prev) => ({ ...prev, thumbnail: e.target.files?.[0] || null, clearThumbnail: false }))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] px-4 py-3 text-[var(--foreground)]" />
                    {form.id && (
                      <label className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                        <input type="checkbox" checked={form.clearThumbnail} onChange={(e) => setForm((prev) => ({ ...prev, clearThumbnail: e.target.checked, thumbnail: e.target.checked ? null : prev.thumbnail }))} />
                        Remove current thumbnail
                      </label>
                    )}
                  </label>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"><FiFilm /> What affiliates will see</div>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--muted-foreground)]">
                    <li>• The asset appears directly inside <strong>Start promoting</strong>.</li>
                    <li>• Paid-only assets stay out of the organic picker.</li>
                    <li>• Organic-only assets stay out of the paid picker.</li>
                    <li>• Archived assets disappear for new promotions but stay intact for historical ones.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeEditor} className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--foreground)]">Cancel</button>
              <button type="button" disabled={saving} onClick={() => void handleSave()} className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60">
                {saving ? "Saving…" : form.id ? "Save changes" : "Upload asset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
