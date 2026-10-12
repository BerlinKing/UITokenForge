# UITokenForge

**Understand the styles in your frontend. Define shared tokens. Review changes with evidence.**

UITokenForge is a Codex Skill for designers who work with code, individual developers, and product teams maintaining existing interfaces. It inventories styles from source, provides an editable semantic Token specification, and helps Codex plan and verify scoped UI improvements.

Start with a single page or module. Expand into a shared governance workflow when you need it.

## What you can do

- Inspect Token definitions, CSS aliases, direct style values, and UI assets with source locations.
- Explore a standalone offline scan report, with category filters and source attribution.
- Define and edit semantic Tokens across 12 atomic categories, with typed properties and previews.
- Export a Token specification and design manual for durable handoff.
- Ask Codex to review contextual mappings, apply authorized changes, and record verification gaps.
- Compare historical findings against a baseline to identify new high-confidence debt.

Equal values do not necessarily have equal meanings. A missing static reference does not prove an asset is safe to delete. Source analysis does not prove visual or runtime correctness.

## For individuals and teams

| | Individual designers and developers | Product teams |
|---|---|---|
| Start with | One page, feature, or module | An agreed product scope and module map |
| Review | Existing styles and proposed Tokens | Shared owners, contextual mappings, and batch decisions |
| Keep | Scan report, Token specification, design manual | Versioned decisions, execution receipts, and verification records |

The same core workflow supports both. Team records are maintained through Codex and exported files; UITokenForge does not provide a hosted collaboration service.

## Install

Core scanning requires Git, Codex, and Node.js 20 or newer.

For a new installation:

```bash
git clone https://github.com/BerlinKing/UITokenForge.git "${CODEX_HOME:-$HOME/.codex}/skills/ui-token-forge"
```

If that directory already exists, compare and preserve your local changes before updating it. Invoke the Skill as `$ui-token-forge` once it is available in your Codex session.

Element-level TSX reconnaissance additionally requires an installed TypeScript parser. Browser verification requires a browser and suitable automation tooling. Resolving package icon geometry may require the target project's installed dependencies. These are optional for the first scan.

## Quick start in Codex

For an individual project:

```text
Use $ui-token-forge to inspect this frontend's styles. Start with the settings page,
show the scan report, and identify which source observations need review.
```

For a team:

```text
Use $ui-token-forge to map this frontend's modules and inspect shared style owners.
Prepare a Token specification and propose a small migration batch with affected
pages and states. Explain what has been verified and what remains unresolved.
```

For Token definition:

```text
Use $ui-token-forge to prepare an editable semantic Token specification from the
inspected source. Keep observed values separate from proposed defaults.
```

Specify the scope you want. Generating reports and confirming a specification do not authorize application changes or GitHub publication.

## Try the scanner directly

Run these commands from the installed UITokenForge directory:

```bash
node scripts/govern.mjs library /path/to/frontend --out /tmp/govern-ui-scan
```

Open `/tmp/govern-ui-scan/scan.html`. The output also contains `scan-data.json` and `style-library-detail.html` for detailed evidence and aliases. Store reports outside the scanned repository.

Try the bundled fixture without a separate application:

```bash
node scripts/govern.mjs library scripts/tests/fixtures/migrate --out /tmp/govern-ui-demo
```

Fixture results demonstrate the tool; they are not acceptance evidence for your application.

## Workflow and outputs

| Stage | Purpose | Entry | How it is produced |
|---|---|---|---|
| Scan | Source inventory and factual clues | `scan.html` | `govern.mjs library`; optional `recon` detail |
| Specify | Editable semantic Tokens and typed bindings | `token-spec.html` | `framework.mjs` with explicit input |
| Review | Contextual mappings and governance decisions | `governance-audit.html` | `artifacts.mjs` with evidence supplied by Codex |
| Report | Actual scoped outcomes and remaining verification gaps | `governance-report.html` | `artifacts.mjs` with outcome records supplied by Codex |

The four stages can be used progressively. A single scan does not require a complete migration. Missing stages display as not produced.

The Token editor covers Color, Typography, Icons, Shadows, Stroke, Radius, Spacing/sizing, Opacity, Blur/filter, Layers, Motion, and Responsive layout. Proposed defaults are not observations or confirmed adoption. Icons use actual assets; missing previews or usage sizes remain unresolved.

HTML works offline. Browser storage is a draft cache: export JSON before handing decisions to another person or environment. Editing the HTML does not update generated CSS or application source.

See [Token editor inputs](references/atomic-framework.md), [element-level reconnaissance](references/element-reconnaissance.md), and [artifact inputs and rendering](references/fixed-html.md).

## Team baseline checks

After reviewing the initial findings and excluded scope:

```bash
node scripts/govern.mjs baseline accept /path/to/frontend --out /tmp/govern-ui-baseline.json
node scripts/govern.mjs check /path/to/frontend --baseline /tmp/govern-ui-baseline.json
```

Keep the reviewed baseline with your team's records. The check compares findings and gates newly added high-confidence, high-severity findings; it does not prove design quality or replace runtime verification.

## Upgrading from GovernUI

The Skill is now named `ui-token-forge` and the repository is `BerlinKing/UITokenForge`. Existing installations should preserve local edits and rename the Skill directory to `ui-token-forge` before updating; the Skill metadata and invocation use the new name.

Export filenames, JSON schema identifiers, browser draft storage keys, environment variables, and the `scripts/govern.mjs` command retain their existing identifiers for compatibility. The rename does not migrate or invalidate saved project decisions.

## Current boundaries

- Module maps, review decisions, batch authorization, and execution receipts require Codex and source inspection; they are not automatically discovered or enforced end to end.
- The main scanner uses static heuristics. Finding a framework does not mean every syntax or runtime style in that framework is supported.
- Scan exclusions and unresolved observations must be reviewed before consolidation or deletion.
- Review and outcome pages render explicit records; the renderer cannot independently prove that source changes were applied or visually verified.
- Visual regression consumes supplied screenshots and a state manifest. It does not capture the application's states automatically.
- `review` is a legacy diagnostic generator. Its Token contract uses schema 2; `implement` currently expects schema 1. Their exports cannot be connected directly. Framework and audit exports are separate formats too.
- `implement` and `submit` are experimental advanced helpers. The executor requires an explicitly qualified schema-1 contract bound to the inspected source baseline, matching decision identities, and exact declaration evidence. Source drift blocks execution; this does not make review-v2 or framework/audit exports compatible. See [the execution contract](references/implementation-schema.md).
- The scanner and HTML do not upload your project by themselves. Your Codex environment and any tools you explicitly invoke have their own data handling behavior.

## Development

Core fixture suite:

```bash
node scripts/tests/run-tests.mjs
```

Install the locked development dependencies, then run syntax checks and all non-browser suites:

```bash
npm ci
npm run check
npm test
```

The test runner supplies the installed TypeScript parser to fixture repositories. A real-project icon acceptance test remains explicitly skipped unless `GOVERN_UI_TEST_REPO` identifies the intended repository.

Browser editor checks use the development Playwright dependency and Chromium:

```bash
npx playwright install chromium
npm run test:browser
```

Alternatively, set `GOVERNUI_CHROME` to an existing Chrome executable. `GOVERNUI_PLAYWRIGHT` can identify an existing Playwright installation when development dependencies are unavailable.

The tests cover fixtures and editor behavior. Application-level visual acceptance remains a separate check. CI runs all non-browser suites on Node.js 20 and 22, plus the Token editor browser suite on Node.js 22. This does not replace real-project acceptance.

## License

[MIT](LICENSE)
