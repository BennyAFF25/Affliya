import fs from "node:fs";

const path = "scripts/apply-proposal-first-refactor.mjs";
let source = fs.readFileSync(path, "utf8");
const from = "bg\\\\[#00C2CB\\\\]";
const to = "bg-\\\\[#00C2CB\\\\]";
if (!source.includes(from)) {
  throw new Error("Expected modal matcher fragment was not found");
}
source = source.replace(from, to);
fs.writeFileSync(path, source);
console.log("Prepared proposal refactor matcher.");
