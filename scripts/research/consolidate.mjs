/* Phase 3 consolidation: merge the 4 research JSON files into data.js.
 * Usage: node consolidate.mjs            (writes ../../../..; prints report)
 *        node consolidate.mjs --dry      (report only)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const dry = process.argv.includes("--dry");

// --- load PRISTINE seed data.js (never the script's own output) ---
const srcText = readFileSync(resolve(here, "data.seed.js"), "utf8");
const sb = { window: {} };
vm.createContext(sb);
vm.runInContext(srcText, sb, { filename: "data.js" });
const SEED = sb.window.LL;

// --- load the 4 research files ---
const families = ["m365", "security", "azure", "bizapps"];
const parts = families.map((f) => ({ f, d: JSON.parse(readFileSync(resolve(here, f + ".json"), "utf8")) }));

const warn = [];
const W = (m) => warn.push(m);

// capabilities agents re-invented under a new id — fold into the canonical one
const CAP_ALIAS = {
  "manage-mobile-devices": "mdm-enroll",
  "build-custom-agent": "custom-agent",
  "manage-shared-kiosk-devices": "intune-device-only",
};
const canonCap = (id) => CAP_ALIAS[id] || id;
// scrub stray price fragments the validator flags
const scrubPrice = (s) => typeof s === "string"
  ? s.replace(/\s*\(?(?:for|at)?\s*\$\s?\d[\d.,]*\s*(?:per|\/)\s*(?:user|month|mo)[^).,]*\)?/gi, "")
      .replace(/\$\s?\d[\d.,]*/g, "a per-user rate")
  : s;

for (const { d } of parts) {
  for (const c of d.capabilities || []) c.id = canonCap(c.id);
  for (const p of d.paths || []) p.capabilityId = canonCap(p.capabilityId);
  for (const c of d.capabilities || []) if (Array.isArray(c.paths)) c.paths = c.paths.slice();
}

// --- merge helpers ---
// licenses: seed wins for existing ids (hand-checked); fill includes from agent if missing.
const licenses = new Map(SEED.LICENSES.map((l) => [l.id, { ...l }]));
for (const { f, d } of parts) {
  for (const l of d.licenses || []) {
    if (licenses.has(l.id)) {
      const cur = licenses.get(l.id);
      if (!cur.includes && Array.isArray(l.includes) && l.includes.length) cur.includes = l.includes;
      // don't overwrite seed name/note/source
    } else {
      licenses.set(l.id, { ...l, _src: f });
    }
  }
}

// clarifiers: union options by id; keep first question text, warn on conflict.
const clarifiers = new Map(SEED.CLARIFIERS.map((c) => [c.id, { id: c.id, question: c.question, options: [...c.options] }]));
for (const { d } of parts) {
  for (const c of d.clarifiers || []) {
    if (!clarifiers.has(c.id)) { clarifiers.set(c.id, { id: c.id, question: c.question, options: [...(c.options || [])] }); continue; }
    const cur = clarifiers.get(c.id);
    if (cur.question !== c.question) W(`clarifier ${c.id}: question text differs ("${cur.question}" vs "${c.question}") — kept first`);
    for (const o of c.options || []) if (!cur.options.some((x) => x.id === o.id)) cur.options.push(o);
  }
}

// capabilities: merge by id; union paths; seed title/description win, else first agent's.
const capabilities = new Map(SEED.CAPABILITIES.map((c) => [c.id, { ...c, paths: [...c.paths], keywords: [...c.keywords] }]));
for (const { f, d } of parts) {
  for (const c of d.capabilities || []) {
    if (!capabilities.has(c.id)) {
      capabilities.set(c.id, { id: c.id, title: c.title, category: c.category, keywords: [...(c.keywords || [])], description: c.description, paths: [...(c.paths || [])], _src: f });
    } else {
      const cur = capabilities.get(c.id);
      for (const p of c.paths || []) if (cur.paths.indexOf(p) === -1) cur.paths.push(p);
      for (const k of c.keywords || []) if (cur.keywords.indexOf(k) === -1) cur.keywords.push(k);
      if (!SEED.CAPABILITIES.some((s) => s.id === c.id)) {
        // cross-agent collision on a new id
        if (cur.title !== c.title) W(`capability ${c.id}: title differs across families — kept "${cur.title}"`);
      }
    }
  }
}

// paths: merge by id; seed wins; on cross-agent collision with different content, rename.
const paths = new Map(SEED.PATHS.map((p) => [p.id, { ...p }]));
for (const { f, d } of parts) {
  for (const p of d.paths || []) {
    let pid = p.id;
    if (paths.has(pid)) {
      const cur = paths.get(pid);
      const same = JSON.stringify(cur.licenses) === JSON.stringify(p.licenses) && cur.capabilityId === p.capabilityId;
      if (same) continue; // true duplicate, keep first
      pid = p.id + "-" + f;
      W(`path ${p.id}: collided with different content — renamed this one to ${pid}`);
      // fix any capability in THIS family that referenced the old id for this capability
      for (const c of d.capabilities || []) {
        const i = (c.paths || []).indexOf(p.id);
        if (i !== -1 && canonCap(c.id) === p.capabilityId) c.paths[i] = pid;
      }
    }
    paths.set(pid, { ...p, id: pid, _src: f });
  }
}

// --- ensure every path is listed on its capability; drop stray cross-refs ---
for (const p of paths.values()) {
  const cap = capabilities.get(p.capabilityId);
  if (!cap) { W(`path ${p.id}: capabilityId "${p.capabilityId}" has no capability`); continue; }
  if (cap.paths.indexOf(p.id) === -1) cap.paths.push(p.id);
}
for (const cap of capabilities.values()) {
  const before = cap.paths.length;
  cap.paths = cap.paths.filter((pid) => paths.has(pid) && paths.get(pid).capabilityId === cap.id);
  if (cap.paths.length !== before) W(`capability ${cap.id}: dropped ${before - cap.paths.length} stray/foreign path ref(s)`);
  if (!cap.paths.length) W(`capability ${cap.id}: NO valid paths after filtering — REVIEW`);
}
// scrub prices in notes/rationale
for (const l of licenses.values()) if (l.note) l.note = scrubPrice(l.note);
for (const p of paths.values()) { if (p.rationale) p.rationale = scrubPrice(p.rationale); if (p.note) p.note = scrubPrice(p.note); }

// dead source URLs -> current equivalents
const URL_FIX = {
  "https://learn.microsoft.com/en-us/dynamics365/get-started/licensing": "https://learn.microsoft.com/en-us/dynamics365/sales/buy-dynamics-365-sales",
  "https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plan-options": "https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-overview",
  "https://learn.microsoft.com/en-us/defender-endpoint/defender-endpoint-plan-1-2": "https://learn.microsoft.com/en-us/defender-endpoint/microsoft-defender-endpoint",
  "https://learn.microsoft.com/en-us/microsoftteams/teams-add-on-licensing/teams-premium-licensing": "https://learn.microsoft.com/en-us/microsoftteams/enhanced-teams-experience",
  "https://learn.microsoft.com/en-us/purview/dlp-microsoft-365-licensing": "https://learn.microsoft.com/en-us/purview/dlp-learn-about-dlp",
  "https://learn.microsoft.com/intune/copilot/copilot-in-intune": "https://learn.microsoft.com/en-us/intune/intune-service/copilot/copilot-intune-overview",
};
const fixUrl = (u) => URL_FIX[u] || u;
for (const l of licenses.values()) if (l.source) l.source = fixUrl(l.source);
for (const p of paths.values()) if (Array.isArray(p.sources)) p.sources = [...new Set(p.sources.map(fixUrl))];
// the team-members licence and its path point at a Sales page after the generic fix — retarget
const tm = licenses.get("d365-team-members");
if (tm) tm.source = "https://learn.microsoft.com/en-us/dynamics365/get-started/team-members-license";
const tmp = paths.get("p-sales-team");
if (tmp) tmp.sources = ["https://learn.microsoft.com/en-us/dynamics365/get-started/team-members-license"];

// --- referential integrity report ---
const licIds = new Set(licenses.keys());
const capIds = new Set(capabilities.keys());
const pathIds = new Set(paths.keys());
const clarIds = new Set(clarifiers.keys());
const errs = [];
const E = (m) => errs.push(m);

for (const c of capabilities.values()) {
  if (!c.title) E(`capability ${c.id}: no title`);
  if (!["m365", "security", "azure", "bizapps"].includes(c.category)) E(`capability ${c.id}: bad category "${c.category}"`);
  if (!c.paths || !c.paths.length) E(`capability ${c.id}: no paths`);
  for (const pid of c.paths || []) if (!pathIds.has(pid)) E(`capability ${c.id}: missing path "${pid}"`);
}
for (const p of paths.values()) {
  if (!capIds.has(p.capabilityId)) E(`path ${p.id}: missing capability "${p.capabilityId}"`);
  for (const l of p.licenses || []) if (!licIds.has(l)) E(`path ${p.id}: missing licence "${l}"`);
  for (const c of p.conditions || []) {
    if (!clarIds.has(c.clarifier)) E(`path ${p.id}: missing clarifier "${c.clarifier}"`);
    else {
      const cl = clarifiers.get(c.clarifier);
      for (const o of c.in || []) if (!cl.options.some((x) => x.id === o)) E(`path ${p.id}: clarifier "${c.clarifier}" has no option "${o}"`);
    }
  }
  if (!p.sources || !p.sources.length) E(`path ${p.id}: no sources`);
}
for (const l of licenses.values()) {
  for (const inc of l.includes || []) if (!licIds.has(inc)) E(`licence ${l.id}: includes missing "${inc}"`);
}

// --- serialize ---
const clean = (o) => { const x = { ...o }; delete x._src; return x; };
function jsVal(v, indent) {
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    if (v.every((x) => typeof x === "string")) return "[" + v.map((s) => JSON.stringify(s)).join(", ") + "]";
    return "[\n" + v.map((x) => indent + "  " + jsVal(x, indent + "  ")).join(",\n") + "\n" + indent + "]";
  }
  if (v && typeof v === "object") {
    const keys = Object.keys(v);
    return "{ " + keys.map((k) => JSON.stringify(k) + ": " + jsVal(v[k], indent)).join(", ") + " }";
  }
  return JSON.stringify(v);
}
function arrLit(name, items) {
  return "const " + name + " = [\n" +
    items.map((it) => "  " + jsVal(clean(it), "  ")).join(",\n") +
    "\n];\n";
}

const header = srcText.slice(0, srcText.indexOf("const META"));
const today = new Date().toISOString().slice(0, 10);
const metaBlock = srcText.slice(srcText.indexOf("const META"), srcText.indexOf("const CATEGORIES"))
  .replace(/updated:\s*"[^"]*"/, `updated: "${today}"`)
  .replace(/seed:\s*true,\s*\/\/[^\n]*/, "seed: false, // full researched dataset");
const catBlock = srcText.slice(srcText.indexOf("const CATEGORIES"), srcText.indexOf("const LICENSES"));

const out =
  header +
  metaBlock +
  catBlock +
  arrLit("LICENSES", [...licenses.values()]) + "\n" +
  arrLit("CLARIFIERS", [...clarifiers.values()]) + "\n" +
  arrLit("CAPABILITIES", [...capabilities.values()]) + "\n" +
  arrLit("PATHS", [...paths.values()]) + "\n" +
  "window.LL = { META, CATEGORIES, LICENSES, CLARIFIERS, CAPABILITIES, PATHS };\n";

console.log(`merged: ${licenses.size} licences, ${clarifiers.size} clarifiers, ${capabilities.size} capabilities, ${paths.size} paths`);
console.log(`\nwarnings (${warn.length}):`);
warn.forEach((w) => console.log("  ! " + w));
console.log(`\nintegrity errors (${errs.length}):`);
errs.slice(0, 120).forEach((e) => console.log("  x " + e));
if (errs.length > 120) console.log(`  ... and ${errs.length - 120} more`);

if (!dry) {
  writeFileSync(resolve(REPO, "data.js"), out);
  console.log(`\nwrote ${resolve(REPO, "data.js")} (${out.length} bytes)`);
}
