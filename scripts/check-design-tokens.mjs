#!/usr/bin/env node
/**
 * Design token guard.
 *
 * Reports raw colour values in app/ and components/: Tailwind palette classes
 * (bg-zinc-900, text-emerald-400, border-white/10, ...), hex colours (#1C1F24)
 * and rgb()/hsl() literals in TypeScript. New UI uses the design tokens from
 * app/globals.css instead (bg-surface, text-ink-2, border-line, ...).
 *
 * The redesign migrates screens phase by phase, so the check is a ratchet:
 * scripts/design-tokens-baseline.json records how many raw values each
 * not-yet-migrated file may still contain. A file that is not in the baseline
 * must be clean, and a listed file may not grow. The baseline shrinks after
 * every phase and is empty at the end, when --strict becomes the CI check.
 *
 * Usage:
 *   node scripts/check-design-tokens.mjs                    report; exit 1 on regressions
 *   node scripts/check-design-tokens.mjs --verbose          also list every finding
 *   node scripts/check-design-tokens.mjs --update-baseline  record the current counts
 *   node scripts/check-design-tokens.mjs --strict           exit 1 on any finding
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_FILE = path.join(root, "scripts", "design-tokens-baseline.json");
const SCAN_DIRS = ["app", "components"];
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

/**
 * Files that define colours themselves: raw values are their job. The legacy
 * palette bridge is transitional and goes away with the last legacy screen.
 */
const TOKEN_SOURCES = new Set(["app/globals.css"]);

const HUES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PROPERTIES =
  "bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|divide|from|via|to|fill|stroke|shadow|inset-shadow|drop-shadow|placeholder|caret|accent|decoration";

const RULES = [
  {
    kind: "palette class",
    pattern: new RegExp(
      `(?<![\\w-])(?:[\\w-]+:)*(?:${PROPERTIES})-(?:(?:${HUES})-(?:50|[1-9]00|950)|white|black)(?:\\/[\\w.[\\]]+)?(?![\\w-])`,
      "g"
    ),
  },
  { kind: "hex colour", pattern: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g },
  { kind: "rgb/hsl literal", pattern: /\b(?:rgba?|hsla?)\(\s*\d/g, onlyIn: new Set([".ts", ".tsx"]) },
];

const args = new Set(process.argv.slice(2));
const unknown = [...args].filter((arg) => !["--verbose", "--update-baseline", "--strict"].includes(arg));
if (unknown.length > 0) {
  console.error(`Unknown option ${unknown.join(", ")}. Use --verbose, --update-baseline or --strict.`);
  process.exit(2);
}
const verbose = args.has("--verbose");
const strict = args.has("--strict");
const updateBaseline = args.has("--update-baseline");

function listFiles(dir) {
  const out = [];
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return out;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(relative));
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(relative);
  }
  return out;
}

function scan(file) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const extension = path.extname(file);
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.onlyIn && !rule.onlyIn.has(extension)) continue;
      rule.pattern.lastIndex = 0;
      for (const match of line.matchAll(rule.pattern)) {
        findings.push({ line: index + 1, kind: rule.kind, value: match[0] });
      }
    }
  });
  return findings;
}

const files = SCAN_DIRS.flatMap(listFiles).sort();
const results = new Map();
for (const file of files) {
  if (TOKEN_SOURCES.has(file)) continue;
  const findings = scan(file);
  if (findings.length > 0) results.set(file, findings);
}

const total = [...results.values()].reduce((sum, findings) => sum + findings.length, 0);

if (updateBaseline) {
  const baseline = {
    note: "Raw colour values each not-yet-migrated file may still contain. Regenerate with `bun run lint:tokens --update-baseline` after a phase migrates files; it must only shrink.",
    total,
    files: Object.fromEntries([...results.entries()].map(([file, findings]) => [file, findings.length])),
  };
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline written: ${total} raw values in ${results.size} files.`);
  process.exit(0);
}

let baselineFiles = {};
if (!strict && fs.existsSync(BASELINE_FILE)) {
  baselineFiles = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")).files || {};
}

const regressions = [];
for (const [file, findings] of results) {
  const allowed = strict ? 0 : baselineFiles[file] || 0;
  if (findings.length > allowed) regressions.push({ file, count: findings.length, allowed, findings });
}

const byKind = new Map();
for (const findings of results.values()) {
  for (const finding of findings) byKind.set(finding.kind, (byKind.get(finding.kind) || 0) + 1);
}

console.log(`Design tokens: ${total} raw colour values in ${results.size} of ${files.length} files (app/, components/).`);
for (const [kind, count] of byKind) console.log(`  ${kind}: ${count}`);

const baselineTotal = Object.values(baselineFiles).reduce((sum, count) => sum + count, 0);
if (!strict && baselineTotal > 0) {
  const migrated = Object.keys(baselineFiles).filter((file) => !results.has(file)).length;
  console.log(`  baseline: ${baselineTotal} allowed in ${Object.keys(baselineFiles).length} legacy files (${migrated} now clean)`);
}

if (verbose) {
  for (const [file, findings] of results) {
    console.log(`\n${file} (${findings.length})`);
    for (const finding of findings) console.log(`  ${finding.line}: ${finding.kind} ${finding.value}`);
  }
}

if (regressions.length > 0) {
  console.error(`\n${regressions.length} file(s) use raw colours ${strict ? "" : "beyond the baseline "}— use the tokens in app/globals.css:`);
  for (const { file, count, allowed, findings } of regressions) {
    console.error(`  ${file}: ${count} (allowed ${allowed})`);
    for (const finding of findings.slice(0, 8)) console.error(`    ${finding.line}: ${finding.value}`);
    if (findings.length > 8) console.error(`    … ${findings.length - 8} more`);
  }
  process.exit(1);
}

console.log(strict ? "\nNo raw colour values." : "\nNo new raw colour values.");
