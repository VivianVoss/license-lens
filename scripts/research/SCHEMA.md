# License Lens — Phase 2 research brief (shared by all 4 agents)

You are building part of the knowledge base for **License Lens**, a static web app that
maps "the functionality a customer needs" → "the minimum Microsoft licence set that
covers it, with the reasoning and an official Microsoft source per line".

Repo: `/Users/vivianvoss/Documents/Claude/Projects/502nm/License Lens/`
Current data: `data.js` in that repo — **read it first** to learn the exact schema in
practice and the IDs already in use. Your job is to produce a superset: keep every
existing id/shape, extend and add.

## Hard rules

1. **Verifiable Microsoft sources only.** Every `path` needs ≥1 `sources` URL on
   `microsoft.com`, `learn.microsoft.com`, `azure.microsoft.com`, or `github.com`.
   Every `license` needs a `source` URL on those hosts. If you cannot find a Microsoft
   page that supports a claim, **drop the claim** — do not guess, do not use blogs,
   do not use third-party licensing sites.
2. **No prices.** No currency figures, no "$X per user/month". You may say a thing is
   "consumption-metered", "a per-user add-on", "a no-cost preview SKU", "included in X".
3. **Point-in-time is fine.** Note "preview" where Microsoft's page says preview.
4. **One pass.** Fetch your assigned pages, extract, write your file once, stop.
   Do NOT loop, re-fetch the same page, or re-verify more than once. Do NOT crawl
   beyond the assigned URLs except to follow at most one link when a page explicitly
   points to "the licensing requirements are here".
5. **Use the Microsoft Learn MCP** (`microsoft_docs_search`, `microsoft_docs_fetch`) —
   it is authoritative and compact. Use `WebFetch` only as a fallback. Only use a
   browser for a page you confirm is client-rendered and returned nothing useful.

## Output

Write exactly one file: `<scratchpad>/phase2/<family>.json` (the dispatch tells you
the filename). It is a JSON object with four arrays:

```json
{
  "licenses":   [ ... ],
  "clarifiers": [ ... ],
  "capabilities":[ ... ],
  "paths":      [ ... ]
}
```

### license object
```json
{
  "id": "kebab-case-stable-id",
  "name": "Exact Microsoft product name",
  "family": "m365 | security | azure | bizapps",
  "type": "suite | addon | standalone | consumption | benefit",
  "rank": 40,                     // rough breadth/cost ordering, 5–80. A broad suite
                                  // outranks a narrow add-on. Used only to prefer one
                                  // suite over a stack of add-ons. NOT a price.
  "includes": ["other-license-id"],   // OPTIONAL. other licence ids this one already
                                      // grants (transitively). e.g. m365-e5 includes
                                      // entra-p2. Only concrete grants you can source.
  "prerequisites": ["free text, e.g. 'A qualifying Microsoft 365 base licence'"],
  "note": "1–2 sentences: what it is and what it grants. No prices.",
  "source": "https://learn.microsoft.com/..."
}
```

### clarifier object
Reuse existing clarifiers where possible: `base-license`, `org-size`, `win-device`,
`sa-server-licenses`, `powerapps-context`. Add a new one only when an answer would
genuinely change which licence is recommended.
```json
{
  "id": "crm-system",
  "question": "Which CRM is in use?",
  "options": [ { "id": "dynamics", "label": "Dynamics 365" }, { "id": "salesforce", "label": "Salesforce" } ]
}
```

### capability object
The functionality a customer searches for. Aim for **80+** in your family.
```json
{
  "id": "kebab-case-id",
  "title": "Plain-language outcome the customer wants (not a product name)",
  "category": "m365 | security | azure | bizapps",   // = your family
  "keywords": ["search terms","synonyms","the product name","the acronym"],  // ≥4
  "description": "1–2 sentences of what this capability actually is.",
  "paths": ["path-id", "path-id"]     // ids of PATHS below, ≥1
}
```

### path object
One way to satisfy a capability = a set of licences + the reasoning + sources.
```json
{
  "id": "p-...unique...",
  "capabilityId": "the-capability-id",
  "licenses": ["license-id", "license-id"],   // the MINIMUM set for this path
  "preferred": true,                          // the recommended path (omit on others)
  "conditions": [ { "clarifier": "base-license", "in": ["none","o365-e3"] } ],  // usually []
  "rationale": "Why these licences cover it. Name the specific entitlement. ≥20 chars.",
  "note": "OPTIONAL. Caveats, setup prerequisites, preview status.",
  "sources": ["https://learn.microsoft.com/...", "..."]   // ≥1, Microsoft hosts only
}
```

## Modelling guidance (learned building the seed)

- **Prefer unconditional paths.** Model the minimum licence that grants the capability
  (e.g. Conditional Access → `entra-p1`, standalone). The engine seeds any base licence
  the user says they own and dedupes via `includes`, so you do NOT need a
  "already covered by E3 / E5 / …" path for every suite. Add a `conditions` clause only
  where the answer changes the *buy* (e.g. "no base at all" → must also buy a base).
- **`preferred`** marks the path the tool recommends. A degraded/partial path (fewer
  features) should exist as a non-preferred alternative with a `note` saying what's lost.
- **Multi-licence paths are normal** (base + add-on; Copilot + CRM). List every licence
  the path truly requires.
- **Name collisions are the main risk.** Microsoft reuses "agent", "Copilot", "Premium",
  "Plan 2". When two products share words, make two capabilities with distinct titles,
  keywords, and descriptions, and say in each description how it differs.
- Keep `rationale` specific: "Microsoft Purview DLP for Exchange/SharePoint/OneDrive is
  included in Microsoft 365 E3" — not "E3 has security features".

## Existing ids (extend, don't collide)

LICENCES: o365-e3, m365-e3, m365-e5, m365-bp, m365-f3, copilot-m365, entra-p1, entra-p2,
ems-e3, ems-e5, intune-p1, intune-suite, mdo-p2, mde-p2, e5-security, purview-eda,
win-e3-user, azure-plan, azure-hub, powerbi-pro, powerbi-ppu, fabric-capacity,
github-copilot-business, powerapps-premium, powerautomate-premium, copilot-studio,
d365-sales-ent, d365-team-members, d365-sales-prem, teams-ent, agent-365

CAPABILITIES: dlp-email-external, conditional-access, identity-protection-pim, mdm-enroll,
remote-help, edr-endpoint, copilot-m365, microsoft-scout, fabric-iq, eDiscovery-premium,
win-enterprise, vm-linux-basic, vm-windows-sql, powerbi-share, custom-canvas-app,
rpa-desktop-flow, custom-agent, d365-sales-agent, d365-sales-dev-agent,
d365-builtin-sales-agents, d365-sales

If your family overlaps one of these, REUSE the id and add more paths / better rationale
in your file — the consolidation step merges by id.

## Validation your output must pass

- every `paths[].capabilityId` exists in your `capabilities` (or the existing set)
- every `capabilities[].paths[]` id exists in your `paths`
- every `paths[].licenses[]` id exists in your `licenses` (or the existing set)
- every `conditions[].clarifier` exists; every `conditions[].in` value is a real option
- every source URL matches `^https://([a-z0-9-]+\.)*(microsoft\.com|azure\.com|microsoftonline\.com|github\.com)/`
- no price strings anywhere

Run a quick self-check before writing. Then write the file and STOP.
