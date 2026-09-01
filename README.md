# License Lens

**Microsoft licensing, explained.**

Describe the functionality you need covered. License Lens maps it to the minimum
Microsoft licence set, explains why each licence is needed, and asks clarifying
questions when there's more than one way to get there — then consolidates a basket
of requirements into a single recommendation.

> Independent tool. **Not affiliated with, endorsed by, or sponsored by Microsoft.**
> Every recommendation links to an official Microsoft page, but licensing terms
> change often and depend on your agreement type, region and negotiated terms.
> This is planning guidance, not licensing advice — always confirm against the
> [Microsoft Product Terms](https://www.microsoft.com/licensing/terms/).

## How it works

- A curated knowledge base (`data.js`) of **capabilities** (functionality a customer
  might need) → **paths** (sets of licences that grant it) → **licences**.
- Every path carries its reasoning and one or more official Microsoft source URLs.
  Nothing is included that can't be tied to `microsoft.com` / `learn.microsoft.com`.
- The engine (`app.js`) matches free text to capabilities, asks only the clarifying
  questions that actually change the answer, then runs a greedy consolidation so a
  basket of needs resolves to the fewest sensible licences (a suite is preferred
  over a stack of narrow add-ons when both fully cover the basket).
- Fully static. No backend, no accounts, no data leaves the browser.

## Coverage

Four areas: **Microsoft 365 & Copilot**, **Security, Identity & Devices**,
**Azure**, **Dynamics 365 & Power Platform**.

## Structure

| File | Contents |
|---|---|
| `index.html` | Page shell — loads `style.css`, then `data.js`, then `app.js` |
| `style.css` | All styling, light/dark theme support |
| `data.js` | The knowledge base: categories, licences, clarifiers, capabilities, paths |
| `app.js` | Matching, clarifier flow, consolidation engine, rendering |
| `staticwebapp.config.json` | Azure Static Web Apps routing config |
| `scripts/validate/validate.mjs` | Schema + referential-integrity + source-URL + no-price checks |

## Running locally

No build step, no dependencies.

```bash
git clone https://github.com/VivianVoss/license-lens.git
cd license-lens
python3 -m http.server 8080   # then open http://localhost:8080
```

## Validating the knowledge base

```bash
node scripts/validate/validate.mjs
```

## Where the content comes from

Microsoft's [licensing site](https://www.microsoft.com/en-us/licensing), the
Microsoft Product Terms, and the product documentation on
[learn.microsoft.com](https://learn.microsoft.com). Each entry is dated; the
knowledge base carries a `META.updated` field.

## License

Copyright (C) 2026 Vivian Voss

Licensed under the [GNU General Public License v3.0](LICENSE).
