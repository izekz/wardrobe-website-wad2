# Wardrobe & Outfit Planner - individual tests

Exactly **five tests: 1 unit, 2 component and 2 E2E**. Each has its own folder, package.json, runner configuration and README. This follows the course's Ex1 (function tests), Ex2 (`__tests__` with Vue Test Utils) and Ex3 (`tests/` with Playwright). Existing application files are imported rather than copied.

| ID | Type | Folder | What it tests |
|---|---|---|---|
| WOP-U01 | Unit | `01-match-score-unit` | No-occasion matching score |
| WOP-C01 | Component | `02-clothing-card-component` | Clothing card and colour tags |
| WOP-C02 | Component | `03-clothing-form-component` | Required style validation |
| WOP-E01 | End-to-end | `04-wardrobe-crud-e2e` | Wardrobe create, search, edit and delete |
| WOP-E02 | End-to-end | `05-outfit-save-edit-e2e` | Save and update the same outfit |

## Run all five from the project root

```powershell
pnpm install
pnpm --dir server install
pnpm test:wardrobe
```

For one test, open its folder in PowerShell and run `pnpm test`. Its README gives the exact path.

## Shared setup files

- `vitest.config.js`: shared Vitest/Vue settings and the combined 3-test configuration.
- `playwright.config.js`: shared Playwright settings and the combined 2-test configuration.
- `e2e-helpers.js`: local-only guard, login helper and absolute fixture-photo path.
- `e2e-server.cjs`: actual local Express app with temporary MongoDB fixtures. Never reads `.env` or uses Atlas. External weather/colour providers use deterministic fixtures; this does not test those providers' availability.

Only Microsoft Edge is used for E2E. Install it if missing. MongoDB's official local binary may be downloaded on the first E2E run. Each test server shuts down and discards its temporary database after the run. Fixture photos are reused; these tests check behaviour, not visual garment recognition.

## Evidence

Each test folder contains `powershell.png`, captured directly from its actual PowerShell window after a successful run. The five-page PDF in this folder has one page per test: name, purpose, run command and that screenshot.

No `test-results` or `playwright-report` folders are generated in the project. Playwright's small temporary runtime files are placed in the OS temporary directory. Other contributors' test file contents are unchanged; the shared root Playwright configuration excludes this individual section because it uses a separate local test app.
