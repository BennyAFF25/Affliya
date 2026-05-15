type NumericLike = number | string | null | undefined;

type OfferScopeConfig = {
  conversion_scope?: string | null;
  eligible_product_ids?: unknown;
  eligible_variant_ids?: unknown;
};

type ResolvedOfferScope = {
  scope: "store_wide" | "specific_products";
  eligibleProductIds: string[];
  eligibleVariantIds: string[];
};

type EligibleAmountResult = {
  eligibleAmount: number;
  matchCount: number;
  matchedProductIds: string[];
  matchedVariantIds: string[];
  reason:
    | "store_wide"
    | "matched_specific_products"
    | "no_matching_products"
    | "missing_item_data"
    | "invalid_scope_config";
};

type LineItem = {
  productId: string | null;
  variantId: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  raw: Record<string, unknown>;
};

function toMoney(value: NumericLike) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function normalizeId(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.toLowerCase() : null;
}

function normalizeIdAliases(value: unknown) {
  const normalized = normalizeId(value);
  if (!normalized) return [] as string[];

  const aliases = new Set<string>([normalized]);

  const gidMatch = normalized.match(/\/([0-9]+)(?:\?.*)?$/);
  if (gidMatch?.[1]) aliases.add(gidMatch[1]);

  const trailingDigits = normalized.match(/([0-9]+)$/)?.[1];
  if (trailingDigits) aliases.add(trailingDigits);

  return Array.from(aliases);
}

function normalizeIdList(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.flatMap((entry) => normalizeIdAliases(entry)).filter(Boolean)),
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/[\n,]/)
          .flatMap((entry) => normalizeIdAliases(entry))
          .filter(Boolean) as string[],
      ),
    );
  }

  return [];
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = normalizeId(value);
    if (text) return text;
  }
  return null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asObjectArray(value: unknown) {
  if (Array.isArray(value)) return value;

  const record = asRecord(value);
  if (!record) return [] as unknown[];

  if (Array.isArray(record.edges)) {
    return record.edges
      .map((edge) => asRecord(edge)?.node ?? edge)
      .filter(Boolean) as unknown[];
  }

  if (Array.isArray(record.nodes)) {
    return record.nodes;
  }

  return [] as unknown[];
}

function getCandidateItemArrays(eventData: Record<string, unknown>) {
  const candidates: unknown[] = [
    eventData.line_items,
    eventData.lineItems,
    eventData.items,
    eventData.contents,
    asRecord(eventData.checkout)?.lineItems,
    asRecord(eventData.checkout)?.line_items,
    asRecord(eventData.checkout)?.items,
    asRecord(eventData.checkout)?.contents,
    asRecord(eventData.data)?.line_items,
    asRecord(eventData.data)?.lineItems,
    asRecord(eventData.data)?.items,
    asRecord(eventData.data)?.contents,
  ];

  return candidates
    .map((value) => asObjectArray(value))
    .filter((rows) => rows.length > 0);
}

function extractLineItems(eventData: Record<string, unknown>): LineItem[] {
  const itemArrays = getCandidateItemArrays(eventData);
  const extracted: LineItem[] = [];

  for (const entries of itemArrays) {
    for (const entry of entries) {
      const row = asRecord(entry);
      if (!row) continue;

      const quantity = Math.max(1, firstNumber(row.quantity, row.qty) ?? 1);
      const unitPrice = firstNumber(
        row.price,
        row.unit_price,
        row.unitPrice,
        asRecord(row.price)?.amount,
      );
      const lineTotal = firstNumber(
        row.line_total,
        row.lineTotal,
        row.total,
        row.amount,
        row.final_line_price,
        row.finalLinePrice,
        row.line_price,
        row.linePrice,
        row.subtotal,
        row.sub_total,
      );

      extracted.push({
        productId: firstText(
          row.product_id,
          row.productId,
          row.item_group_id,
          row.itemGroupId,
          row.merchandise_id,
          asRecord(row.product)?.id,
        ),
        variantId: firstText(
          row.variant_id,
          row.variantId,
          row.item_id,
          row.itemId,
          row.sku,
          row.id,
          asRecord(row.variant)?.id,
          asRecord(row.merchandise)?.id,
        ),
        quantity,
        unitPrice,
        lineTotal,
        raw: row,
      });
    }

    if (extracted.length > 0) return extracted;
  }

  return extracted;
}

function resolveLineTotal(item: LineItem) {
  if (item.lineTotal != null) return toMoney(item.lineTotal);
  if (item.unitPrice != null) return toMoney(item.unitPrice * item.quantity);
  return null;
}

function matchesAnyAlias(value: string | null, allowed: string[]) {
  if (!value) return false;
  const aliases = normalizeIdAliases(value);
  return aliases.some((alias) => allowed.includes(alias));
}

export function resolveOfferScopeConfig(offer: OfferScopeConfig): ResolvedOfferScope {
  const scope = offer.conversion_scope === "specific_products" ? "specific_products" : "store_wide";
  return {
    scope,
    eligibleProductIds: normalizeIdList(offer.eligible_product_ids),
    eligibleVariantIds: normalizeIdList(offer.eligible_variant_ids),
  };
}

export function computeEligibleConversionAmount(params: {
  offer: OfferScopeConfig;
  grossAmount: number;
  eventData: unknown;
}): EligibleAmountResult {
  const { offer, grossAmount } = params;
  const eventData = asRecord(params.eventData) || {};
  const scope = resolveOfferScopeConfig(offer);

  if (scope.scope === "store_wide") {
    return {
      eligibleAmount: toMoney(grossAmount),
      matchCount: 0,
      matchedProductIds: [],
      matchedVariantIds: [],
      reason: "store_wide",
    };
  }

  if (scope.eligibleProductIds.length === 0 && scope.eligibleVariantIds.length === 0) {
    return {
      eligibleAmount: 0,
      matchCount: 0,
      matchedProductIds: [],
      matchedVariantIds: [],
      reason: "invalid_scope_config",
    };
  }

  const lineItems = extractLineItems(eventData);
  if (lineItems.length === 0) {
    const eventProductId = firstText(
      eventData.product_id,
      eventData.productId,
      eventData.item_group_id,
      eventData.itemGroupId,
    );
    const eventVariantId = firstText(
      eventData.variant_id,
      eventData.variantId,
      eventData.item_id,
      eventData.itemId,
      eventData.sku,
    );

    const productMatch = matchesAnyAlias(eventProductId, scope.eligibleProductIds);
    const variantMatch = matchesAnyAlias(eventVariantId, scope.eligibleVariantIds);

    if (productMatch || variantMatch) {
      return {
        eligibleAmount: toMoney(grossAmount),
        matchCount: 1,
        matchedProductIds: productMatch && eventProductId ? [eventProductId] : [],
        matchedVariantIds: variantMatch && eventVariantId ? [eventVariantId] : [],
        reason: "matched_specific_products",
      };
    }

    return {
      eligibleAmount: 0,
      matchCount: 0,
      matchedProductIds: [],
      matchedVariantIds: [],
      reason: eventProductId || eventVariantId ? "no_matching_products" : "missing_item_data",
    };
  }

  let eligibleAmount = 0;
  const matchedProductIds = new Set<string>();
  const matchedVariantIds = new Set<string>();
  let matchCount = 0;

  for (const item of lineItems) {
    const productMatch = matchesAnyAlias(item.productId, scope.eligibleProductIds);
    const variantMatch = matchesAnyAlias(item.variantId, scope.eligibleVariantIds);
    if (!productMatch && !variantMatch) continue;

    const lineTotal = resolveLineTotal(item);
    if (lineTotal == null) continue;

    eligibleAmount += lineTotal;
    matchCount += 1;
    if (productMatch && item.productId) matchedProductIds.add(item.productId);
    if (variantMatch && item.variantId) matchedVariantIds.add(item.variantId);
  }

  if (matchCount === 0) {
    return {
      eligibleAmount: 0,
      matchCount: 0,
      matchedProductIds: [],
      matchedVariantIds: [],
      reason: "no_matching_products",
    };
  }

  return {
    eligibleAmount: toMoney(eligibleAmount),
    matchCount,
    matchedProductIds: Array.from(matchedProductIds),
    matchedVariantIds: Array.from(matchedVariantIds),
    reason: "matched_specific_products",
  };
}
