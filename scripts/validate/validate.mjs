/* License Lens — knowledge-base validator
 * Run: node scripts/validate/validate.mjs
 * Exits non-zero on any structural error. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const src = readFileSync(resolve(root, "data.js"), "utf8");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "data.js" });
const D = sandbox.window.LL;

const errors = [];
const warns = [];
const E = (m) => errors.push(m);
const W = (m) => warns.push(m);

if (!D) { console.error("data.js did not set window.LL"); process.exit(1); }

const { META, CATEGORIES, LICENSES, CLARIFIERS, CAPABILITIES, PATHS } = D;

// --- basic shape ---
for (const [name, arr] of Object.entries({ CATEGORIES, LICENSES, CLARIFIERS, CAPABILITIES, PATHS })) {
  if (!Array.isArray(arr) || arr.length === 0) E(`${name} is missing or empty`);
}

const catIds = new Set(CATEGORIES.map((c) => c.id));
const licIds = new Set(LICENSES.map((l) => l.id));
const clarIds = new Set(CLARIFIERS.map((c) => c.id));
const capIds = new Set(CAPABILITIES.map((c) => c.id));
const pathIds = new Set(PATHS.map((p) => p.id));

const dupe = (arr) => arr.filter((v, i) => arr.indexOf(v) !== i);
for (const [n, ids] of Object.entries({ CATEGORIES: CATEGORIES.map(c=>c.id), LICENSES: LICENSES.map(l=>l.id), CLARIFIERS: CLARIFIERS.map(c=>c.id), CAPABILITIES: CAPABILITIES.map(c=>c.id), PATHS: PATHS.map(p=>p.id) })) {
  const d = dupe(ids); if (d.length) E(`${n} has duplicate ids: ${[...new Set(d)].join(", ")}`);
}

const MS_HOST = /^https:\/\/([a-z0-9-]+\.)*(microsoft\.com|azure\.com|microsoftonline\.com|github\.com)\//i;
const PRICE = /(\$|€|£|USD|EUR|DKK|\bper user\/month\b|\/mo\b)\s?\d|\bfree\b.*\/\s*month/i;
const okUrl = (u) => typeof u === "string" && MS_HOST.test(u);

// --- META ---
if (!META || !/^\d{4}-\d{2}-\d{2}$/.test(META.updated || "")) E("META.updated must be an ISO date");
if (!okUrl(META?.productTerms)) E("META.productTerms must be a microsoft.com URL");

// --- LICENSES ---
const TYPES = new Set(["suite", "addon", "standalone", "consumption", "benefit"]);
for (const l of LICENSES) {
  if (!l.name) E(`licence ${l.id}: missing name`);
  if (!catIds.has(l.family)) E(`licence ${l.id}: family "${l.family}" is not a category id`);
  if (!TYPES.has(l.type)) E(`licence ${l.id}: type "${l.type}" invalid`);
  if (typeof l.rank !== "number") E(`licence ${l.id}: rank must be a number`);
  if (!Array.isArray(l.prerequisites)) E(`licence ${l.id}: prerequisites must be an array`);
  if (l.includes !== undefined) {
    if (!Array.isArray(l.includes)) E(`licence ${l.id}: includes must be an array`);
    else for (const inc of l.includes) {
      if (!licIds.has(inc)) E(`licence ${l.id}: includes missing licence "${inc}"`);
      if (inc === l.id) E(`licence ${l.id}: includes itself`);
    }
  }
  if (!okUrl(l.source)) E(`licence ${l.id}: source is not a microsoft.com URL (${l.source})`);
  if (l.note && PRICE.test(l.note)) W(`licence ${l.id}: note looks like it contains a price — keep prices out`);
}

// --- CLARIFIERS ---
for (const c of CLARIFIERS) {
  if (!c.question) E(`clarifier ${c.id}: missing question`);
  if (!Array.isArray(c.options) || c.options.length < 2) E(`clarifier ${c.id}: needs >= 2 options`);
  for (const o of c.options || []) if (!o.id || !o.label) E(`clarifier ${c.id}: option missing id/label`);
}

// --- CAPABILITIES ---
for (const c of CAPABILITIES) {
  if (!c.title) E(`capability ${c.id}: missing title`);
  if (!catIds.has(c.category)) E(`capability ${c.id}: category "${c.category}" invalid`);
  if (!Array.isArray(c.keywords) || c.keywords.length < 2) E(`capability ${c.id}: needs >= 2 keywords`);
  if (!c.description) E(`capability ${c.id}: missing description`);
  if (!Array.isArray(c.paths) || c.paths.length === 0) E(`capability ${c.id}: has no paths`);
  for (const pid of c.paths || []) {
    if (!pathIds.has(pid)) E(`capability ${c.id}: references missing path "${pid}"`);
    else if (PATH_BY_ID(pid).capabilityId !== c.id) E(`capability ${c.id}: path "${pid}" points at a different capability`);
  }
}
function PATH_BY_ID(id) { return PATHS.find((p) => p.id === id); }

// --- PATHS ---
for (const p of PATHS) {
  if (!capIds.has(p.capabilityId)) E(`path ${p.id}: capabilityId "${p.capabilityId}" invalid`);
  if (!CAPABILITIES.find((c) => c.id === p.capabilityId)?.paths.includes(p.id)) E(`path ${p.id}: not listed on its capability`);
  if (!Array.isArray(p.licenses) || p.licenses.length === 0) E(`path ${p.id}: needs >= 1 licence`);
  for (const lid of p.licenses || []) if (!licIds.has(lid)) E(`path ${p.id}: references missing licence "${lid}"`);
  if (!p.rationale || p.rationale.length < 20) E(`path ${p.id}: rationale too short / missing`);
  if (PRICE.test(p.rationale || "")) W(`path ${p.id}: rationale looks like it contains a price`);
  if (!Array.isArray(p.conditions)) E(`path ${p.id}: conditions must be an array`);
  for (const cond of p.conditions || []) {
    if (!clarIds.has(cond.clarifier)) E(`path ${p.id}: condition clarifier "${cond.clarifier}" invalid`);
    const cl = CLARIFIERS.find((c) => c.id === cond.clarifier);
    if (!Array.isArray(cond.in) || cond.in.length === 0) E(`path ${p.id}: condition.in must be a non-empty array`);
    for (const oid of cond.in || []) if (cl && !cl.options.find((o) => o.id === oid)) E(`path ${p.id}: condition option "${oid}" not in clarifier "${cond.clarifier}"`);
  }
  if (!Array.isArray(p.sources) || p.sources.length === 0) E(`path ${p.id}: needs >= 1 source`);
  for (const s of p.sources || []) if (!okUrl(s)) E(`path ${p.id}: source not a microsoft.com URL (${s})`);
}

// --- every capability must be solvable with no answers ---
for (const c of CAPABILITIES) {
  const anyUnconditional = c.paths.some((pid) => (PATH_BY_ID(pid).conditions || []).length === 0);
  const coverage = {};
  for (const pid of c.paths) for (const cond of PATH_BY_ID(pid).conditions || []) {
    coverage[cond.clarifier] = coverage[cond.clarifier] || new Set();
    for (const o of cond.in) coverage[cond.clarifier].add(o);
  }
  // for each clarifier used, the union of accepted options should cover all its options,
  // otherwise some answer leaves the capability with zero viable paths
  for (const [clar, seen] of Object.entries(coverage)) {
    const cl = CLARIFIERS.find((x) => x.id === clar);
    const missing = cl.options.filter((o) => !seen.has(o.id)).map((o) => o.id);
    if (missing.length && !anyUnconditional) W(`capability ${c.id}: answering ${clar}=${missing.join("/")} leaves no viable path`);
  }
}

console.log(`checked: ${LICENSES.length} licences, ${CAPABILITIES.length} capabilities, ${PATHS.length} paths, ${CLARIFIERS.length} clarifiers`);
if (warns.length) { console.log("\nwarnings:"); warns.forEach((w) => console.log("  ! " + w)); }
if (errors.length) { console.error("\nerrors:"); errors.forEach((e) => console.error("  x " + e)); process.exit(1); }
console.log("\nOK — knowledge base is structurally valid.");
