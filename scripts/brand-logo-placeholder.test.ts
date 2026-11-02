import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brandInitials } from "../app/components/brandInitials";

assert.ok(["MM", "MC"].includes(brandInitials("Mechanical Maintenance Course")));
assert.equal(brandInitials("Free Website Demo"), "FW");
assert.equal(brandInitials("CitoHR"), "C");
assert.equal(brandInitials("The Vine Letter"), "VL");
assert.equal(brandInitials(""), "N");
assert.equal(brandInitials(null), "N");
assert.equal(brandInitials("   !!  "), "N");

for (const f of ["app/affiliate/marketplace/page.tsx", "app/components/OfferCard.tsx"]) {
  const src = readFileSync(f, "utf8");
  assert.match(src, /import BrandLogo from/, `${f} imports BrandLogo`);
  assert.doesNotMatch(src, /logoFallback/, `${f} has no old letter fallback`);
}
const comp = readFileSync("app/components/BrandLogo.tsx", "utf8");
assert.match(comp, /onError/);
assert.match(comp, /#00c2cb/);
console.log("brand logo placeholder tests passed");
