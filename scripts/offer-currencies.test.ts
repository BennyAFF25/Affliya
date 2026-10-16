import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OFFER_CURRENCIES, OFFER_CURRENCY_MESSAGE, isOfferCurrency, isOfferCurrencyCheckViolation } from "../utils/currency/offerCurrencies";
import { paidLaunchCurrencies } from "../utils/currency/paidCurrencyGuard";

assert.deepEqual(OFFER_CURRENCIES, ["AUD", "USD", "GBP", "CAD"]);
for (const code of OFFER_CURRENCIES) assert.equal(isOfferCurrency(code), true);
for (const value of [null, undefined, "", "EUR", "NZD", "aud", " AUD", 123]) assert.equal(isOfferCurrency(value), false);
assert.equal(OFFER_CURRENCY_MESSAGE, "Offers can be priced in AUD, USD, GBP or CAD only.");
for (const detail of [{ constraint: "offers_currency_supported" }, { message: 'new row violates check constraint "offers_currency_supported"' }, { details: "offers_currency_supported" }]) {
  assert.equal(isOfferCurrencyCheckViolation({ code: "23514", ...detail }), true);
  assert.equal(isOfferCurrencyCheckViolation({ code: "23505", ...detail }), false);
}
for (const error of [null, "23514", { code: "23514", message: "another_constraint" }]) assert.equal(isOfferCurrencyCheckViolation(error), false);
assert.deepEqual(paidLaunchCurrencies(" usd, AUD,usd,EUR,CAD,GBP "), ["USD", "AUD", "CAD", "GBP"]);
assert.deepEqual(paidLaunchCurrencies("AUD"), ["AUD"]);
assert.deepEqual(paidLaunchCurrencies(""), []);
const sql = readFileSync("supabase/migrations/20261016250000_offers_currency_check.sql", "utf8");
assert.match(sql, /CHECK \(currency IS NULL OR currency IN \('AUD','USD','GBP','CAD'\)\)/);
assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|INSERT)\b/i);
const undo = readFileSync("supabase/undo/20261016250000_offers_currency_check.undo.sql", "utf8");
assert.match(undo, /DROP CONSTRAINT offers_currency_supported;/);
for (const file of ["app/business/my-business/create-offer/page.tsx", "app/business/my-business/edit-offer/[offerId]/page.tsx", "app/onboarding/for-business/page.tsx"]) {
  const source = readFileSync(file, "utf8");
  assert.match(source, /OFFER_CURRENCIES.map/);
  assert.match(source, /!isOfferCurrency\(currency\)/);
  assert.match(source, /isOfferCurrencyCheckViolation/);
  assert.doesNotMatch(source, /<option value="(?:EUR|NZD)"/);
}
console.log("Offer currency checks passed");
