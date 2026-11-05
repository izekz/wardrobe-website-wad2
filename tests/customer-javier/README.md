# Javier Ong — Customer-side Week 10 tests

These are **1 unit**, **2 component**, and **2 E2E** tests for Discover, survey, product cards, Likes, cart and checkout. Login is only a setup step; it is not a graded test.

## Setup (project root)

```powershell
pnpm install
cd server
pnpm install
cd ..
pnpm exec playwright install chromium
```

The E2E runner uses `mongodb-memory-server` (already listed in the root `package.json`). On the first run, the memory MongoDB binary may need to download; internet access may be necessary. Node.js and npm/pnpm are required; Flask is not used.

## Tests 1–3: Vitest (no backend needed)

Run each from the project root and screenshot the filename, test case name, and green `passed` result:

```powershell
pnpm exec vitest run --config tests/customer-javier/vitest.config.js tests/customer-javier/01-discover-filters.spec.js --reporter=verbose
pnpm exec vitest run --config tests/customer-javier/vitest.config.js tests/customer-javier/02-survey.component.spec.js --reporter=verbose
pnpm exec vitest run --config tests/customer-javier/vitest.config.js tests/customer-javier/03-product-card.component.spec.js --reporter=verbose
```

## Tests 4–5: Playwright (automatic isolated environment)

Do **not** start `pnpm dev`, manually configure MongoDB, or provide a real customer password. These tests start their own local Vue/Vite server, real Express API and temporary MongoDB. Fixture customer and two products are seeded automatically. When the test command exits, Playwright stops the harness and deletes the in-memory database.

```powershell
pnpm exec playwright test --config tests/customer-javier/playwright.config.js 04-survey-discover.e2e.spec.js --reporter=list
pnpm exec playwright test --config tests/customer-javier/playwright.config.js 05-likes-cart-checkout.e2e.spec.js --reporter=list
```

To run both E2E tests serially:

```powershell
pnpm exec playwright test --config tests/customer-javier/playwright.config.js --reporter=list
```

A fixture password is hardcoded **only** for a disposable, locally created account, not for your normal account. Payment numbers used by the E2E test are test-only values; no payment is processed.

## Collect your evidence

For each of the five cases, screenshot (A) its test function and key assertions from VS Code and (B) the actual `passed` result in the terminal. For E2E you can also run `pnpm exec playwright show-report playwright-report-customer-javier` to capture the report. Never submit screenshots of a failed run as a passed run.

## Coordination with the group

The root `playwright.config.js` now excludes `tests/customer-javier/**` just as it excludes Business and Wardrobe. This stops Playwright mistakenly importing the three Vitest files, which caused `Cannot read properties of undefined (reading 'config')`. Run Javier E2E using his own `--config` command, similar to Business's own E2E config.

Do not rename `*.spec.js` files or move the config without updating these commands. Existing application feature files are not replaced by this test pack.

## Troubleshooting

- **Playwright error on `describe()` in VS Code:** select the proper individual E2E config and confirm the root config contains `**/customer-javier/**` in `testIgnore`. Vitest tests should never be picked up by Playwright.
- **Cannot locate MongoDB binary:** `mongodb-memory-server` may need an initial download; check internet/proxy access. Existing test projects also rely on local MongoDB tools.
- **Port 5387/3387 already in use:** stop the old test run, then retry. Do not use the normal 5173/3000 ports.
- **Missing dependencies:** install packages in both the root and `server` folders.
- **E2E test fails:** inspect Playwright trace on failure and check that no application code was changed after the tests were written.
