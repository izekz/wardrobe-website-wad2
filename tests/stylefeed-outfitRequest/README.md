# Style Feed and Outfit Request Tests

This guide covers **one unit test, two component tests and two end-to-end (E2E) tests** for Style Feed and Outfit Requests. These are the tests for the `tests/stylefeed-outfitRequest` folder.

Run the following commands from the main **`wardrobe-website-wad2`** folder unless stated otherwise. These tests are independent of your teammate's `tests/business` tests.

## Test coverage

| No. | Type | File | Behaviour tested |
| --- | --- | --- | --- |
| 1 | Unit | `tests/stylefeed-outfitRequest/unit/readVideo.spec.js` | A video upload with an unsupported file type or size over 8 MB is rejected, while a small MP4 is accepted. |
| 2 | Component | `tests/stylefeed-outfitRequest/component/RequestCard.spec.js` | Alex's closed Outfit Request displays the request title, status and two suggestions; its Delete button emits the correct event. |
| 3 | Component | `tests/stylefeed-outfitRequest/component/RequestSuggestionAction.spec.js` | Alex accepts the matching suggested product without selecting size or colour at the acceptance step; the correct API call and redirect occur. |
| 4 | E2E | `tests/stylefeed-outfitRequest/e2e/outfit-request.spec.js` | Alex registers, logs in, posts a jacket request, sees it after revisiting the request page and deletes it. |
| 5 | E2E | `tests/stylefeed-outfitRequest/e2e/style-feed-boost.spec.js` | A business registers, creates a product fixture, uploads a video, spends demo coins boosting it, and a customer sees a Sponsored post. |

The component tests mock child components and/or network calls. The E2E tests use a real Chromium browser, the Express backend and a **temporary local MongoDB replica set**; they do not call your team's live MongoDB Atlas database.

## 1. Install dependencies

Prerequisites: Node.js and pnpm; internet access on the first E2E run to download the temporary MongoDB binary if not already cached.

Install frontend and test dependencies:

```sh
pnpm install
```

Install backend dependencies:

```sh
cd server
pnpm install
cd ..
```

Install Playwright Chromium:

```sh
pnpm exec playwright install chromium
```

**You do not need to install `mongod` with Homebrew for these tests.** The E2E setup starts its own isolated replica set using the project's `mongodb-memory-server` dependency. The first startup may take longer because it downloads the MongoDB executable.

## 2. Run the unit test

The unit test does not require the application server, browser or database.

```sh
pnpm exec vitest run --config tests/stylefeed-outfitRequest/vitest.config.js tests/stylefeed-outfitRequest/unit/readVideo.spec.js
```

Expected if successful: **1 passed**.

## 3. Run the two component tests

These tests mount Vue components in jsdom; they do not need a running backend.

Outfit Request card:

```sh
pnpm exec vitest run --config tests/stylefeed-outfitRequest/vitest.config.js tests/stylefeed-outfitRequest/component/RequestCard.spec.js
```

Accept suggestion:

```sh
pnpm exec vitest run --config tests/stylefeed-outfitRequest/vitest.config.js tests/stylefeed-outfitRequest/component/RequestSuggestionAction.spec.js
```

Expected if successful: **1 passed** for each file.

To run all three unit/component tests together:

```sh
pnpm test:stylefeed-outfitRequest
```

Expected if successful: **3 test files passed, 3 tests passed**.

## 4. Run the E2E tests

Playwright automatically starts three services on separate ports, so **do not run `pnpm dev` or `server/pnpm dev` for these tests**:

| Service | Test-only address |
| --- | --- |
| Temporary replica-set MongoDB | `127.0.0.1:27129` (readiness check: `27128`) |
| Express backend | `http://127.0.0.1:3299` |
| Vite frontend | `http://127.0.0.1:5299` |

The test database is disposable and isolated from `server/.env` and your team's Atlas database. Boosting uses a MongoDB transaction, which is why the temporary database runs as a single-node replica set.

Run the Outfit Request E2E test:

```sh
pnpm exec playwright test --config tests/stylefeed-outfitRequest/e2e/playwright.config.js outfit-request.spec.js
```

Run the Style Feed E2E test:

```sh
pnpm exec playwright test --config tests/stylefeed-outfitRequest/e2e/playwright.config.js style-feed-boost.spec.js
```

Run both together:

```sh
pnpm test:stylefeed-outfitRequest:e2e
```

Expected if successful: **2 passed** in Chromium. Unlike your teammate's 3-browser Playwright setup, these tests are configured for **Chromium only**, so two cases should yield two executions.

**If the first run downloads the MongoDB executable, allow it to finish; do not interrupt it.** Later runs can reuse the cached executable.

## 5. View E2E results

After running both E2E cases, open the HTML report:

```sh
pnpm exec playwright show-report playwright-report-stylefeed-outfitRequest
```

This opens a report showing the individual cases and their actual Pass/Fail outcomes. The report only reflects your most recent execution.

## 6. Screenshots for the submission

Following the same format as Kathleen's testing guide, provide evidence for **each of the five cases**:

1. The test name, a one-sentence input/action and the expected behaviour.
2. A screenshot of the test code (show the `test`/`it` name and important assertions).
3. A screenshot of the **actual passing** Terminal summary (Vitest) or Playwright report (E2E).

For clear evidence, capture a **Vitest Terminal screenshot** with all three case names and `Tests 3 passed`, then a **Playwright report screenshot** showing the two passing E2E cases. You may reuse those two results screenshots alongside the five code screenshots in your submission PDF.

On macOS, press **Command + Shift + 4**, then drag over the Terminal or report. Do not crop away the test names or final result. Never include `.env` credentials or passwords in screenshots.

## Troubleshooting

- **`RequestCard.spec.js` expected a title but got only `Classic...`:** The old test replaced Vue `RouterLink` with an empty stub, hiding link text. This update provides a link stub that renders its slot, preserving the request title and suggestion count.
- **`spawn mongod ENOENT`:** This was caused by the previous E2E launcher expecting a system-wide MongoDB installation. This version uses `mongodb-memory-server`; run `pnpm install` and retry.
- **MongoDB binary download fails:** Check internet access and re-run. A proxy/firewall may block the first download; inspect the specific error rather than directing the test at the live team database.
- **Port already in use (`27128`, `27129`, `3299`, or `5299`):** Stop an earlier test run occupying the port, then retry.
- **Playwright Chromium missing:** Run `pnpm exec playwright install chromium`.
- **No tests found:** Run commands from the project root and preserve the exact folder name `stylefeed-outfitRequest` (capital `R`).
- **Browser test fails after startup:** Open the generated Playwright report and trace. The database/startup fix does not guarantee UI selectors are correct after subsequent team changes.
- **A test fails:** Include actual results only after it really passes; don't invent a screenshot or mark it passed without running it.

The E2E tests are intended for test accounts created in the temporary database; the test-only product fixture is required to publish a video, but does **not** test your teammate's business listing UI.
