import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaidCurrencyWarning } from "../app/affiliate/dashboard/promote/components/PaidCurrencyWarning";
import type { AdFormState } from "../app/affiliate/dashboard/promote/types";

const loadMocked = createRequire(__filename);
const loader = Module as unknown as { _load: (name: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
loader._load = function (name, parent, isMain) {
  if (name.includes("MetaInterestPicker")) return { MetaInterestPicker: () => null };
  if (name === "react") return { ...React, useState: (initial: unknown) => React.useState(initial === 1 ? 4 : initial) };
  return original.call(this, name, parent, isMain);
};

try {
  const { AdCampaignWizard } = loadMocked("../app/affiliate/dashboard/promote/components/AdCampaignWizard") as typeof import("../app/affiliate/dashboard/promote/components/AdCampaignWizard");
  const noop = () => {};
  const form: AdFormState = {
    campaign_name: "Currency proposal", objective: "OUTCOME_TRAFFIC", budget_type: "DAILY", budget_amount_dollars: 20,
    interests: [], placements: { facebook_feed: true, instagram_feed: false, instagram_reels: false, facebook_reels: false, facebook_stories: false, instagram_stories: false },
    location_countries: "AU", age_min: 18, age_max: 65, gender: "", start_time: "", end_time: "2026-12-01T12:00",
    headline: "Example", caption: "Example", call_to_action: "LEARN_MORE", display_link: "https://example.invalid",
    bid_strategy: "LOWEST_COST", bid_cap_dollars: "", advantage_audience: false,
  };
  const props: React.ComponentProps<typeof AdCampaignWizard> = {
    offerId: "offer", form, setForm: noop, onInput: () => noop, onPlacementToggle: noop, applyEstimatorPreset: noop,
    walletBalance: 0, walletLoading: true, canRunWithWallet: false, walletDeficit: 20, starterSpendRemaining: 0, starterSpendLabel: null,
    incBudget: noop, setStartIn15m: noop, setEndIn7d: noop, reachDaily: null, reachMonthly: null, reachStatus: "loading", reachMessage: "", interestsIgnored: false,
    videoFile: null, setVideoFile: noop, imageFile: null, setImageFile: noop, thumbnailFile: null, setThumbnailFile: noop,
    thumbnailError: null, setThumbnailError: noop, validateThumbnailFile: () => null, setVideoPreviewUrl: noop, setThumbPreviewUrl: noop,
    handleAdSubmit: async () => true, currency: "", currencyLoading: false, onNavigateToWallet: noop,
  };
  for (const currency of ["USD", "GBP", "CAD", "AUD"]) {
    // No brand Meta Page/account: warning depends only on offer currency and selected mode.
    const offer = { currency, meta_page_id: null, meta_ad_account_id: null };
    for (const mode of ["ad", "organic"] as const) {
      const early = renderToStaticMarkup(React.createElement(PaidCurrencyWarning, { currency: offer.currency, mode }));
      assert.equal(early.includes('role="alert"'), mode === "ad" && currency !== "AUD", `${currency} ${mode} early`);
    }
    const review = renderToStaticMarkup(React.createElement(AdCampaignWizard, { ...props, currency: offer.currency }));
    assert.equal(review.includes("Paid launches currently support AUD"), currency !== "AUD", `${currency} review`);
    if (currency !== "AUD") {
      assert.match(review, /cannot launch until multi-currency support is available/);
      assert.ok(review.indexOf('role="alert"') < review.indexOf("Submit Campaign Proposal"));
    }
    const submit = review.match(/<button[^>]*>Submit Campaign Proposal<\/button>/)?.[0];
    assert.ok(submit, "Final submit action rendered");
    assert.doesNotMatch(submit, /disabled/, "Currency alone must not disable proposal submission");
  }
  const source = readFileSync("app/affiliate/dashboard/promote/[offerId]/page.tsx", "utf8");
  assert.match(source, /<PaidCurrencyWarning currency=\{offerCurrency\} mode=\{mode\}/);
  assert.doesNotMatch(source, /offerAllowsPaid|setOfferAllowsPaid/);
  assert.ok(source.indexOf("<PaidCurrencyWarning") < source.indexOf("<AIPromotionPackPanel"), "Early warning precedes downstream loads");
  assert.match(source, /mode === "ad"[\s\S]*<AdCampaignWizard/, "Paid wizard only rendered in Ad mode");
  console.log("Segment 1c: rendered early/review USD, GBP, CAD without Meta setup; Organic/AUD hidden; proposal submission enabled");
} finally {
  loader._load = original;
}
