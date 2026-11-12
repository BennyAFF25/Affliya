import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { safeStorageFileName } from "../utils/storageFileName";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (["node_modules", ".git", ".next", "extensions"].includes(entry.name)) return [];
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : /\.[cm]?[jt]sx?$/.test(name) ? [name] : [];
  });
}
const expected = new Map([
  ["app/business/settings/page.tsx", 1],
  ["app/affiliate/settings/page.tsx", 1],
  ["app/affiliate/dashboard/my-shop/page.tsx", 2],
  ["app/onboarding/for-business/page.tsx", 2],
  ["app/business/my-business/create-offer/page.tsx", 2],
  ["app/business/my-business/publish-creatives/page.tsx", 1],
  ["app/affiliate/dashboard/promote/[offerId]/page.tsx", 4],
]);
const found = new Map<string, number>();
const serverWrites: string[] = [];
for (const file of files(".")) {
  if (file.startsWith("scripts/")) continue;
  const source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && ["upload", "update", "remove", "move", "copy"].includes(node.expression.name.text)
      && /\.storage\s*\.\s*from\s*\(/.test(node.expression.expression.getText(ast))) {
      if (file.startsWith("app/api/")) {
        assert.match(node.expression.expression.getText(ast), /^supabaseAdmin\.storage/, `review new server writer: ${file}`);
        serverWrites.push(file);
      } else {
        assert.equal(node.expression.name.text, "upload", `review new mutation: ${file}`);
        const arg = node.arguments[0];
        assert.ok(arg && ts.isIdentifier(arg), `${file}: upload path must have a reviewed declaration`);
        const pathName = arg.text;
        let initializer: ts.Expression | undefined;
        // Resolve the nearest enclosing scope's declaration, avoiding same-name paths in other handlers.
        for (let scope: ts.Node | undefined = node.parent; scope && !initializer; scope = scope.parent) {
          function declaration(candidate: ts.Node) {
            if (ts.isVariableDeclaration(candidate) && candidate.name.getText(ast) === pathName) initializer = candidate.initializer;
            if (!initializer) ts.forEachChild(candidate, declaration);
          }
          declaration(scope);
        }
        assert.ok(initializer && ts.isTemplateExpression(initializer), `${file}: missing template for ${pathName}`);
        assert.equal(initializer.head.text, "", `${file}: no folders before UID`);
        const first = initializer.templateSpans[0];
        assert.ok(first.literal.text.startsWith("/"), `${file}: UID must be entire first folder`);
        assert.ok(["user.id", "session.user.id", "submissionUser.id", "userId"].includes(first.expression.getText(ast)), `${file}: unreviewed identity source`);
        if (first.expression.getText(ast) === "submissionUser.id") assert.match(source, /const submissionUser\s*=\s*await requireSubmissionSession\(\)/);
        if (first.expression.getText(ast) === "userId") {
          assert.match(source, /uploadFile\(form.file,user.id,"asset"\)/);
          assert.match(source, /uploadFile\(form.thumbnail,user.id,"thumbnail"\)/);
        }
        found.set(file, (found.get(file) || 0) + 1);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
assert.deepEqual([...found].sort(), [...expected].sort(), "every client uploader must be reviewed");
assert.equal(serverWrites.length, 3, "review every server mutation");
assert.deepEqual([...new Set(serverWrites)].sort(), ["app/api/business/content-library/[id]/route.ts", "app/api/business/content-library/route.ts"].sort());
const migration = readFileSync("supabase/migrations/20261112210000_storage_own_prefix_policies.sql", "utf8");
const undo = readFileSync("supabase/undo/20261112210000_storage_own_prefix_policies.undo.sql", "utf8");
const previous = [
  "Allow ALL uploads to organic-posts", "Allow uploads to organic-posts", "Users can upload organic-posts",
  "Allow authenticated upload to organic-posts", "Allow authenticated upload to ad-ideas-assets",
  "Authenticated upload for offer logos", "Authenticated upload for profile images", "Authenticated users can upload ad assets",
  "Business creatives authenticated insert", "Users can upload their own avatars", "shop images write",
  "Allow authenticated update to ad-ideas-assets", "Authenticated update profile images", "Business creatives authenticated update",
  "Users can update their own avatars", "shop images update", "Allow authenticated delete from ad-ideas-assets",
  "Authenticated delete profile images", "Business creatives authenticated delete", "Users can delete their own avatars",
];
for (const name of previous) {
  assert.ok(migration.includes(`DROP POLICY IF EXISTS "${name}" ON storage.objects;`));
  assert.ok(undo.includes(`CREATE POLICY "${name}" ON storage.objects`));
}
assert.equal((migration.match(/CREATE POLICY/g) || []).length, 22);
assert.match(migration, /CREATE POLICY "offer-logos own-prefix read" ON storage.objects\s+AS PERMISSIVE FOR SELECT TO authenticated/);
assert.ok(undo.includes(`DROP POLICY IF EXISTS "offer-logos own-prefix read" ON storage.objects;`));
assert.equal((undo.match(/CREATE POLICY/g) || []).length, 20);
for (const bucket of ["organic-posts", "ad-ideas-assets", "offer-logos", "profile-images", "business-creatives", "avatars", "shop-images"]) {
  const predicate = `bucket_id = '${bucket}' AND (storage.foldername(name))[1] = (select auth.uid())::text`;
  for (const command of ["insert", "update", "delete"]) {
    const name = `${bucket} own-prefix ${command}`;
    const clauses = [command !== "insert" ? `USING (${predicate})` : "", command !== "delete" ? `WITH CHECK (${predicate})` : ""].filter(Boolean).join("\n");
    assert.ok(migration.includes(`CREATE POLICY "${name}" ON storage.objects\nAS PERMISSIVE FOR ${command.toUpperCase()} TO authenticated\n${clauses};`));
    assert.ok(undo.includes(`DROP POLICY IF EXISTS "${name}" ON storage.objects;`));
  }
}
assert.equal((migration.match(/(?:CREATE|DROP) POLICY[^;]*FOR SELECT/gi) || []).length, 1); // only the offer-logos own read
assert.doesNotMatch(migration, /DROP POLICY[^;]*(?:public read|Public read|shop images read)/);
for (const sql of [migration, undo]) { assert.match(sql, /\bBEGIN;/); assert.match(sql, /COMMIT;\s*$/); }
for (const file of ["app/onboarding/for-business/page.tsx", "app/business/my-business/create-offer/page.tsx"]) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source.match(/\.from\("offer-logos"\)[\s\S]*?\.upload\([\s\S]*?\}\)/)?.[0] || "", /upsert:\s*true/);
}
assert.equal(safeStorageFileName("../../My logo é.png"), "..-..-my-logo-e.png");
assert.equal(safeStorageFileName("🖼"), "image");
console.log("storage policies: 13 client uploads, 3 service-role mutations, 21 own-prefix write policies, 1 offer-logos own read and 20 undo names pass.");
