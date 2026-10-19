export type OfferMetaRow = {
  id?: string | null;
  business_email?: string | null;
  meta_page_id?: string | null;
  meta_ad_account_id?: string | null;
  meta_pixel_id?: string | null;
  site_host?: string | null;
};

export type MetaConnectionRow = {
  page_id?: string | null;
  page_name?: string | null;
  ad_account_id?: string | null;
  ad_account_name?: string | null;
  pixel_id?: string | null;
  pixel_name?: string | null;
};

export type OfferMetaReadiness = {
  metaConnected: boolean;
  metaReady: boolean;
  metaReason: "ready" | "missing_business" | "not_connected" | "needs_offer_selection" | "missing_page" | "missing_ad_account";
  metaSource: "offer" | "meta_connections" | null;
  resolvedMeta: {
    pageId: string | null;
    pageName: string | null;
    adAccountId: string | null;
    adAccountName: string | null;
    pixelId: string | null;
    pixelName: string | null;
  };
  counts: {
    pages: number;
    adAccounts: number;
    pixels: number;
  };
};

function compact(value?: string | null) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function uniqueById<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    const id = compact(row[key] as string | null | undefined);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(row);
  }
  return result;
}

// Connections must belong to the offer business. Preserve offer selections and
// fall back independently only when a connected asset is unambiguous.
export function computeOfferMetaReady(offer: OfferMetaRow, connections: MetaConnectionRow[] = []): OfferMetaReadiness {
  const businessEmail = compact(offer.business_email);
  const offerPageId = compact(offer.meta_page_id);
  const offerAdAccountId = compact(offer.meta_ad_account_id);
  const offerPixelId = compact(offer.meta_pixel_id);

  if (offerPageId && offerAdAccountId) {
    return {
      metaConnected: true,
      metaReady: true,
      metaReason: "ready",
      metaSource: "offer",
      resolvedMeta: {
        pageId: offerPageId,
        pageName: null,
        adAccountId: offerAdAccountId,
        adAccountName: null,
        pixelId: offerPixelId,
        pixelName: null,
      },
      counts: { pages: 1, adAccounts: 1, pixels: offerPixelId ? 1 : 0 },
    };
  }

  if (!businessEmail) {
    return {
      metaConnected: false,
      metaReady: false,
      metaReason: "missing_business",
      metaSource: null,
      resolvedMeta: { pageId: offerPageId, pageName: null, adAccountId: offerAdAccountId, adAccountName: null, pixelId: offerPixelId, pixelName: null },
      counts: { pages: 0, adAccounts: 0, pixels: 0 },
    };
  }

  const pages = uniqueById(connections, "page_id");
  const adAccounts = uniqueById(connections, "ad_account_id");
  const pixels = uniqueById(connections, "pixel_id");
  const metaConnected = pages.length > 0 || adAccounts.length > 0;

  const fallbackPage = pages.length === 1 ? pages[0] : null;
  const fallbackAdAccount = adAccounts.length === 1 ? adAccounts[0] : null;
  const fallbackPixel = pixels.length === 1 ? pixels[0] : null;

  const resolvedPageId = offerPageId || compact(fallbackPage?.page_id);
  const resolvedAdAccountId = offerAdAccountId || compact(fallbackAdAccount?.ad_account_id);
  const resolvedPixelId = offerPixelId || compact(fallbackPixel?.pixel_id);

  const canUseConnectionFallback = Boolean(resolvedPageId && resolvedAdAccountId);
  const needsOfferSelection = metaConnected && !canUseConnectionFallback && (pages.length > 1 || adAccounts.length > 1);

  return {
    metaConnected,
    metaReady: canUseConnectionFallback,
    metaReason: canUseConnectionFallback
      ? "ready"
      : needsOfferSelection
        ? "needs_offer_selection"
        : !metaConnected
          ? "not_connected"
          : !resolvedPageId
            ? "missing_page"
            : "missing_ad_account",
    metaSource: canUseConnectionFallback ? (offerPageId && offerAdAccountId ? "offer" : "meta_connections") : null,
    resolvedMeta: {
      pageId: resolvedPageId,
      pageName: fallbackPage?.page_name || null,
      adAccountId: resolvedAdAccountId,
      adAccountName: fallbackAdAccount?.ad_account_name || null,
      pixelId: resolvedPixelId,
      pixelName: fallbackPixel?.pixel_name || null,
    },
    counts: {
      pages: pages.length,
      adAccounts: adAccounts.length,
      pixels: pixels.length,
    },
  };
}
