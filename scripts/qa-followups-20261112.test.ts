import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { reviewMedia } from "../utils/affiliate/reviewMedia";

const read = (path: string) => readFileSync(path, "utf8");
for (const extension of ["mp4", "mov", "webm", "m4v"]) {
  for (const suffix of ["", "?token=test", "#t=1"]) {
    const url = `https://example.test/clip.${extension.toUpperCase()}${suffix}`;
    assert.deepEqual(reviewMedia({ file_url: url }), {
      mediaType: "video", thumbnailUrl: null, videoUrl: url, previewUrl: null,
    });
  }
}
for (const media_type of ["video", "video/mp4"]) {
  assert.equal(reviewMedia({ media_type, file_url: "extensionless" }).videoUrl, "extensionless");
}
for (const thumbnailField of ["thumbnail_url", "thumbnail"]) {
  const media = reviewMedia({ video_url: "clip", [thumbnailField]: "poster.jpg", image_url: "image.jpg" });
  assert.equal(media.previewUrl, "poster.jpg");
  assert.equal(media.videoUrl, "clip");
}
assert.equal(reviewMedia({ image_url: "photo.jpg" }).previewUrl, "photo.jpg");
assert.equal(reviewMedia({}).previewUrl, null);
for (const path of ["app/api/affiliate/reviews/route.ts", "utils/affiliate/portalData.ts"]) {
  const source = read(path);
  assert.match(source, /reviewMedia\(row\)/);
  // Optional metadata is read without selecting columns absent on older source tables.
  assert.match(source, /ad_ideas[\s\S]*?media_type,thumbnail_url/);
}
const page = read("app/affiliate/dashboard/reviews/page.tsx");
assert.match(page, /item\.previewUrl\s*\?\s*\(\s*<img/);
assert.match(page, /item\.videoUrl\s*\?\s*\(\s*<video src=\{item.videoUrl\} muted playsInline preload="metadata"/);

const create = read("app/business/my-business/create-offer/page.tsx");
const uploadStart = create.indexOf('let uploadedLogoUrl');
const uploadEnd = create.indexOf('const metaPageId', uploadStart);
const uploads = create.slice(uploadStart, uploadEnd);
assert.match(uploads, /throw new Error\(error.message\)/);
assert.match(uploads, /throw new Error\(heroError.message\)/);
assert.match(uploads, /uploadingFileName = file.name/);
assert.match(uploads, /catch \(error\)\s*\{\s*setIsPublishing\(false\);\s*const message = `Image upload failed for "\$\{uploadingFileName\}"/);
assert.match(uploads, /setUploadError\(message\);\s*alert\(message\);\s*return;/);
assert.match(create, /role="alert"[\s\S]*\{uploadError\}/);
assert.match(create, /Remove logo/);
assert.match(create, /Remove images/);
assert.match(uploads, /error instanceof Error \? error.message/);
assert.match(uploads, /return;\s*\}/);
assert.ok(create.indexOf('.upsert(', uploadStart) > uploadEnd, "offer insertion follows successful uploads");
assert.doesNotMatch(uploads, /setLogoFile\(null\)|setHeroImageFiles\(\[\]\)/);
const onboarding = read("app/onboarding/for-business/page.tsx");
assert.match(onboarding, /if \(logoError\)\s*\{\s*throw new Error\(\s*`Logo upload failed for "\$\{logoFile.name\}": \$\{logoError.message/);
assert.match(onboarding, /if \(imageError\)\s*\{\s*throw new Error\(\s*`Product image upload failed for "\$\{file.name\}": \$\{imageError.message/);
assert.ok(onboarding.indexOf('.insert([payload])') > onboarding.indexOf('if (imageError)'));
assert.match(onboarding, /finally\s*\{\s*setSubmitting\(false\)/);
console.log("QA followups: media mapping/rendering and fail-closed image uploads passed");

// Execute the actual upload block with a storage mock; no network or database access.
async function verifyUploads() {
  const run = new Function("supabase", "logoFile", "heroImageFiles", "user", "safeStorageFileName", "setLogoUrl", "setIsPublishing", "alert", "setUploadError",
    ts.transpile(`return (async () => { ${uploads} return "ready-to-publish"; })();`, { target: ts.ScriptTarget.ES2020 }));
  for (const failure of ["logo.png", "product.png", "throw", null]) {
    let publishing = true;
    const alerts: string[] = [];
    const attempted: string[] = [];
    const inline: string[] = [];
    const storage = { from: () => ({
      upload: async (_path: string, file: { name: string }) => {
        attempted.push(file.name);
        if (failure === "throw") throw new Error("transport failed");
        return { error: file.name === failure ? { message: "Storage policy denied" } : null };
      },
      getPublicUrl: () => ({ data: { publicUrl: "image.jpg" } }),
    }) };
    const result = await run({ storage }, { name: "logo.png" }, [{ name: "product.png" }], { id: "user" }, (name: string) => name, () => {}, (value: boolean) => { publishing = value; }, (message: string) => alerts.push(message), (message: string | null) => { if (message) inline.push(message); });
    if (failure) {
      assert.equal(result, undefined, "failure cannot reach publishing");
      assert.equal(publishing, false);
      assert.equal(alerts.length, 1);
      assert.deepEqual(inline, alerts, "inline error matches alert");
      assert.ok(alerts[0].includes(failure === "throw" ? "logo.png" : failure));
      assert.ok(alerts[0].includes(failure === "throw" ? "transport failed" : "Storage policy denied"));
      if (failure !== "product.png") assert.deepEqual(attempted, ["logo.png"]);
    } else {
      assert.equal(result, "ready-to-publish");
      assert.equal(alerts.length, 0);
      assert.deepEqual(attempted, ["logo.png", "product.png"]);
    }
  }
}
verifyUploads().then(() => console.log("Mocked upload success, logo/product failure and transport failure passed"))
  .catch(error => { console.error(error); process.exitCode = 1; });
