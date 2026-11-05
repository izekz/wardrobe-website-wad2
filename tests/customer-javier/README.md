# Javier Ong — Customer-side Week 10 tests

These tests cover my contributions to the Style Survey, For You / All Items Discover filters, product cards, Favorites, cart and checkout. **Login is setup only, not a tested feature.**

## Required structure

```text
tests/customer-javier/
  01-discover-filters.spec.js
  02-survey.component.spec.js
  03-product-card.component.spec.js
  04-survey-discover.e2e.spec.js
  05-likes-cart-checkout.e2e.spec.js
  vitest.config.js
  playwright.config.js
  README.md
  EVIDENCE_TEMPLATE.md
src/services/discoverFilterOptions.js    (new)
src/view/discover/Store.vue               (updated)
```

Keep this folder separate from other group members' tests. **Do not overwrite** root `vitest.config.js`, root `playwright.config.js`, or other test folders.

## Setup (PowerShell, from project root)

```powershell
pnpm install
pnpm exec playwright install chromium
```

### Unit test (Test 1)

```powershell
pnpm exec vitest run --config tests/customer-javier/vitest.config.js tests/customer-javier/01-discover-filters.spec.js --reporter=verbose
```

Expected: For You uses only survey-selected styles/occasions and allowable prices; All Items restores all choices.

### Component test (Test 2)

```powershell
pnpm exec vitest run --config tests/customer-javier/vitest.config.js tests/customer-javier/02-survey.component.spec.js --reporter=verbose
```

Expected: Cannot submit fewer than 2 styles; valid selection calls mocked `saveSurvey` with chosen styles, occasion and budget. The test does not write to MongoDB.

### Component test (Test 3)

```powershell
pnpm exec vitest run --config tests/customer-javier/vitest.config.js tests/customer-javier/03-product-card.component.spec.js --reporter=verbose
```

Expected: Out-of-stock badge at 0, low-stock label at 1, and Like click calls mocked shop service.

### E2E preparation

**Use a dedicated test database/account rather than your shared demonstration account.** Test 4 modifies survey preferences and tries to restore them; Test 5 creates a real order and decreases stock. Never run Test 5 against the group's presentation inventory.

Run frontend and backend in separate terminals:

```powershell
# Terminal 1: project root
pnpm dev
```

```powershell
# Terminal 2: project root
cd server
pnpm install
pnpm dev
```

The backend must connect to the **test MongoDB database**. Vite should serve the app at `http://127.0.0.1:5173`.

Open Terminal 3 in **project root**. Set environment variables only in this terminal. Never commit passwords or put them in screenshots:

```powershell
$env:CUSTOMER_TEST_EMAIL="your-customer-test-email"
$env:CUSTOMER_TEST_PASSWORD="your-customer-test-password"
```

The account is used to establish an authenticated session, not to assess login. `jack123@gmail.com` may be used if it is your existing customer account, but using a **separate clone/test account** is safer because Test 4 changes profile preferences.

### E2E test (Test 4) Survey → Discover

```powershell
pnpm exec playwright test tests/customer-javier/04-survey-discover.e2e.spec.js --config tests/customer-javier/playwright.config.js --reporter=list
```

Expected: survey updated with Y2K + Vintage, Date, S$65; For You dropdowns restrict to selected values; All Items shows all styles and occasions. Test tries to restore original survey preferences.

### E2E test (Test 5) Likes → Cart → Checkout

**Before running:** ensure test account has an EMPTY cart, and set `CUSTOMER_TEST_PRODUCT_ID` to an available product in the *test database* with stock > 0 and at least one available size. A unique test product avoids accidental purchases of another teammate's listing.

```powershell
$env:CUSTOMER_TEST_PRODUCT_ID="paste-test-product-id"
$env:CUSTOMER_ALLOW_PURCHASE="yes"
pnpm exec playwright test tests/customer-javier/05-likes-cart-checkout.e2e.spec.js --config tests/customer-javier/playwright.config.js --reporter=list
```

Expected: product liked and visible in Favorites; product added to cart; checkout shows ORDER CONFIRMED and a six-digit order number; API reports lower stock. This test has real persistent side effects — only rerun on a fresh test product or reset the test database.

### Show Playwright evidence

```powershell
pnpm exec playwright show-report playwright-report/customer-javier
```

Use Windows+Shift+S to capture actual successful terminal output for Vitest; for Playwright capture the HTML report's test name and green Passed result. Screenshot the code separately in VS Code with `describe()`, `it()`/`test()` and important `expect()` assertions visible. Add only actual passing results in `EVIDENCE_TEMPLATE.md` / your Google Doc.

## Troubleshooting

- **Cannot connect to 127.0.0.1:3000**: backend or MongoDB is not running.
- **No test files found**: run in project root, not `src` or `server`.
- **Playwright browser executable missing**: `pnpm exec playwright install chromium`.
- **E2E login setup fails**: verify the *test account* exists in the active database and credentials are set in Terminal 3.
- **No in-stock product**: create a dedicated product in the test database and use its productId.
- **Cart not empty**: use an empty test account; the E2E script refuses to purchase pre-existing items.
- **Tests fail**: do not label them as passed; save the error output and fix the cause before collecting evidence.

Flask is not needed — this is a Vue / Express project tested with Vitest and Playwright.
