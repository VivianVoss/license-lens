# Knowledge-base research & consolidation

The `data.js` knowledge base was built from four parallel research passes, one
per product family, each grounded only in official Microsoft sources.

| File | Contents |
|---|---|
| `SCHEMA.md` | The brief every research pass followed — schema, rules, modelling guidance |
| `m365.json` / `security.json` / `azure.json` / `bizapps.json` | Raw research output per family |
| `data.seed.js` | The hand-authored seed `data.js` the research extended (pristine, for re-runs) |
| `consolidate.mjs` | Merges `data.seed.js` + the four JSON files into `../../data.js` |

## Re-running / extending

Edit or add entries in the family JSON files (same schema), then:

```bash
node scripts/research/consolidate.mjs --dry   # report only
node scripts/research/consolidate.mjs         # writes ../../data.js
node scripts/validate/validate.mjs            # verify
```

The consolidation folds duplicate capability ids into canonical ones
(`CAP_ALIAS`), renames cross-family path-id collisions, drops stray
cross-references, scrubs price strings, and fixes known-dead source URLs
(`URL_FIX`). It is idempotent.
