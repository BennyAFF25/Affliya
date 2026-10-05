import ts from "typescript";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const cwd = process.cwd();
const base = process.argv[2];
if (!base || !/^[a-f0-9]{40}$/i.test(base)) throw new Error("Pass an immutable base commit SHA");
const files = [
  "app/business/choose-plan/page.tsx",
  "app/onboarding/for-business/page.tsx",
  "app/create-account/page.tsx",
  "app/api/profile/onboarding-complete/route.ts",
  "app/api/product-events/route.ts",
  "components/analytics/BusinessProductAnalytics.tsx",
  "app/api/business-subscription/create-checkout-session/route.ts",
  "app/api/business-subscription/get-session/route.ts",
  "app/api/business-subscription/choose-free/route.ts",
  "app/api/business-subscription/webhook/route.ts",
  "app/api/business-subscription/trial-eligibility/route.ts",
  "app/api/marketing-events/route.ts",
  "app/internal/marketing/page.client.tsx",
  "utils/businessSubscriptions.ts"
];
const temporary = path.join(tmpdir(), "nettmark-business-funnel-types-" + process.pid);
mkdirSync(temporary);
execFileSync("git", ["archive", base, "--output", path.join(temporary, "base.tar")], { cwd });
execFileSync("tar", ["-xf", path.join(temporary, "base.tar"), "-C", temporary]);
symlinkSync(path.join(cwd, "node_modules"), path.join(temporary, "node_modules"), "dir");

function diagnostics(root: string) {
  const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, {
    incremental: false, noEmit: true, target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  });
  const program = ts.createProgram(files.map(file => path.join(root, file)).filter(existsSync), parsed.options);
  return ts.getPreEmitDiagnostics(program).map(diagnostic => {
    const file = diagnostic.file ? path.relative(root, diagnostic.file.fileName).replaceAll("\\", "/") : "<config>";
    // TS can reorder equivalent literal unions when new callers are imported.
    // Compare the same members rather than treating display order as a new error.
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      .replace(/"[^"]*"(?: \\| "[^"]*")+/g, value => value.split(" | ").sort().join(" | "));
    const line = diagnostic.file && diagnostic.start != null ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1 : 0;
    return { key: file + ":" + diagnostic.code + ":" + message, file, code: diagnostic.code, message, line };
  });
}
const before = diagnostics(temporary);
const after = diagnostics(cwd);
const remaining = new Map<string, number>();
for (const diagnostic of before) remaining.set(diagnostic.key, (remaining.get(diagnostic.key) || 0) + 1);
const added = after.filter(diagnostic => {
  const count = remaining.get(diagnostic.key) || 0;
  if (count > 0) { remaining.set(diagnostic.key, count - 1); return false; }
  return true;
});
writeFileSync("business-funnel-typecheck-report.json", JSON.stringify({ base, baselineErrors: before.length, currentErrors: after.length, newErrors: added }, null, 2));
console.log("Existing integration files: baseline " + before.length + " diagnostics; current " + after.length + "; new " + added.length + ".");
for (const error of added) console.error(error.file + ":" + error.line + " TS" + error.code + " " + error.message);
if (added.length) process.exitCode = 1;
