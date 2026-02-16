import { Project } from "ts-morph";
import path from "path";

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

const file = getArg("--file");
const importFrom = getArg("--importFrom");
const componentName = getArg("--component");

if (!file || !importFrom || !componentName) {
  console.error(
    "Usage: yarn -s codemod:insert-header --file <path> --importFrom <module> --component <Name>"
  );
  process.exit(1);
}

const absFile = path.isAbsolute(file) ? file : path.join(process.cwd(), file);

const project = new Project({
  tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
});

const sourceFile = project.addSourceFileAtPath(absFile);

/**
 * 1) Ensure import exists (default import)
 */
const existingImport = sourceFile
  .getImportDeclarations()
  .find((d) => d.getModuleSpecifierValue() === importFrom);

if (!existingImport) {
  sourceFile.addImportDeclaration({
    moduleSpecifier: importFrom,
    defaultImport: componentName,
  });
} else {
  const def = existingImport.getDefaultImport();
  if (!def) existingImport.setDefaultImport(componentName);
}

/**
 * 2) Deterministic JSX insertion (no fragile AST root detection)
 * Insert `<Component />` just before the first `<main` if present,
 * otherwise right after the first opening tag of the returned JSX wrapper.
 */
const insertion = `  <${componentName} />\n`;
const text = sourceFile.getFullText();

if (text.includes(`<${componentName} />`)) {
  console.log("ℹ️ Component already present, no JSX insertion needed.");
  process.exit(0);
}

// Find "return (" and then the first "<" after it (start of returned JSX)
const returnIdx = text.indexOf("return");
if (returnIdx === -1) {
  console.error("❌ No 'return' found. Aborting.");
  process.exit(2);
}

const mainIdx = text.indexOf("<main", returnIdx);
if (mainIdx !== -1) {
  sourceFile.insertText(mainIdx, insertion);
  sourceFile.formatText({ ensureNewLineAtEndOfFile: true });
  project.saveSync();
  console.log(`✅ Inserted <${componentName} /> before <main in ${absFile}`);
  process.exit(0);
}

// Fallback: insert after first opening tag of returned wrapper
const firstTagIdx = text.indexOf("<", returnIdx);
if (firstTagIdx === -1) {
  console.error("❌ No JSX tag found after return. Aborting.");
  process.exit(2);
}

// Insert after the end of that opening tag `>`
const openTagEnd = text.indexOf(">", firstTagIdx);
if (openTagEnd === -1) {
  console.error("❌ Could not find end of opening tag. Aborting.");
  process.exit(2);
}

sourceFile.insertText(openTagEnd + 1, `\n${insertion}`);
sourceFile.formatText({ ensureNewLineAtEndOfFile: true });
project.saveSync();

console.log(`✅ Inserted <${componentName} /> after first wrapper tag in ${absFile}`);
