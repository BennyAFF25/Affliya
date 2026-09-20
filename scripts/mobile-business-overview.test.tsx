import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MobileBusinessOverview from "../app/business/my-business/MobileBusinessOverview";

const base = {
  view: "overview" as const, onNavigate: () => {}, loading: false,
  offers: [{ id: "offer-1", title: "Example brand", commission: 20 }],
  requests: 0, adIdeas: 0, postIdeas: 0,
  reviewHref: "/business/my-business/affiliate-requests",
  billingRequired: false, onSupport: () => {},
};
const render = (props = {}) => renderToStaticMarkup(<MobileBusinessOverview {...base} {...props} />);
assert.match(render(), /Add creative/);
assert.doesNotMatch(render(), /Create an offer/);
assert.match(render(), /edit-offer\/offer-1/);
assert.match(render({ offers: [] }), /Create an offer/);
assert.match(render({ requests: 2 }), /Review submissions/);
assert.match(render({ billingRequired: true }), /Continue billing setup/);
assert.doesNotMatch(render({ loading: true, offers: [] }), /Create an offer/);
assert.doesNotMatch(render({ view: "offers" }), /Your next move/);
assert.doesNotMatch(render({ view: "setup" }), /Your next move/);
for (const path of ["affiliate-requests", "ad-ideas", "post-ideas", "publish-creatives"]) {
  assert.match(render(), new RegExp(`/business/my-business/${path}`));
}
assert.match(render(), /\/business\/manage-campaigns/);
console.log("Mobile overview: existing-offer, empty, pending, billing, loading, navigation and destinations passed.");
