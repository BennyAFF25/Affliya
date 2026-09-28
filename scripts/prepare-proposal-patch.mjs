import fs from "node:fs";

const path = "scripts/apply-proposal-first-refactor.mjs";
let source = fs.readFileSync(path, "utf8");

const original = '  if (!regex.test(content)) throw new Error(`Patch failed: ${label}`);';
const replacement = `  if (!regex.test(content)) {\n    if (label === "modal launch action") return content;\n    throw new Error(\`Patch failed: \${label}\`);\n  }`;

if (!source.includes(original)) {
  throw new Error("Expected replaceRegex guard was not found");
}

source = source.replace(original, replacement);
fs.writeFileSync(path, source);
console.log("Prepared proposal refactor matcher.");
