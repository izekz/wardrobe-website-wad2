# Style Feed & Outfit Request tests (IS216)

Located beside `tests/business`. These test only Style Feed and Outfit Request workflows; they do not modify or test the teammates’ business listing, general Store checkout, or wardrobe functionality.

## Test inventory: exactly five

| Type | File | Verifies |
| --- | --- | --- |
| Unit (1) | `unit/readVideo.spec.js` | Accepted video type/size and rejected invalid files |
| Component (1) | `component/RequestCard.spec.js` | The customer's request history card and Delete event |
| Component (2) | `component/RequestSuggestionAction.spec.js` | Accepting a suggestion without duplicate variant selections |
| E2E (1) | `e2e/outfit-request.spec.js` | Customer posts, views and deletes a request |
| E2E (2) | `e2e/style-feed-boost.spec.js` | Business uploads/boosts video; customer sees Sponsored video |

## Screenshot 1 — Unit + component tests

From the project root (where `package.json` is located):

```bash
pnpm install
(cd server && pnpm install)
pnpm test:stylefeed-outfitRequest
```

After **3 tests pass**, take a screenshot of the Terminal including the test filenames and the `Tests 3 passed` summary. On a Mac, press **Command + Shift + 4** and select the Terminal area. Only screenshot a successful run, not this README.

## Screenshot 2 — End-to-end tests

The E2E suite uses a dedicated local MongoDB instance (single-node replica set, because video boosts use transactions) and Playwright Chromium, not your team’s Atlas database. You must have `mongod` installed and on your PATH; do not point these tests at your team’s database.

```bash
pnpm exec playwright install chromium
pnpm test:stylefeed-outfitRequest:e2e
```

After **2 tests pass**, screenshot the Terminal with the two passing E2E test names. For an HTML report, use:

```bash
pnpm exec playwright show-report playwright-report-stylefeed-outfitRequest
```

Use the report as extra evidence if required. The separate E2E processes use ports `27128`/`27129` for the test MongoDB, `3299` for the backend and `5299` for Vite, so they will not use your regular 3000/5173 development ports.

## Troubleshooting

- Run the commands from the **project root**, not from `tests/stylefeed-outfitRequest`.
- If `pnpm` is not installed, install/enable it first, then run `pnpm install`.
- If the E2E runner says `mongod` cannot be found, install MongoDB Community Server and make the executable available on PATH.
- If Chromium is missing, rerun `pnpm exec playwright install chromium`.
- If a port is already in use, stop the previous E2E process before retrying.
- If a test fails, inspect the error and HTML report; do not screenshot a passing summary unless the tests actually pass.
- This folder’s **case-sensitive name** is `stylefeed-outfitRequest` (capital `R`). Do not rename it without updating the two scripts in the root `package.json` and the E2E paths.
- These tests are separate from your groupmate’s `pnpm test:business` and `pnpm test:business:e2e` commands.
