# Wardrobe & Outfit Planner - individual tests

This section contains **exactly five tests: 1 unit, 2 component and 2 E2E**. Each test has its own folder, `package.json` and runner configuration. All instructions are collected in this README.

The layout follows the course examples: Ex1 for function tests, Ex2 for component tests in `__tests__`, and Ex3 for Playwright tests in `tests/`. Tests import the actual application code rather than copying it.

## Install dependencies once

Run these commands in PowerShell from the project root:

```powershell
pnpm install
pnpm --dir server install
```

Microsoft Edge is required for the E2E tests (`channel: 'msedge'`). The first E2E run may download an official MongoDB binary into the local cache. Its install-time download is disabled in `pnpm-workspace.yaml`; the binary starts when the E2E tests run.

You do not need to start the development frontend or backend separately. The E2E commands build the frontend and start their own local test environment.

## Run all five tests

From the project root:

```powershell
pnpm test:wardrobe
```

To run only the three unit/component tests:

```powershell
pnpm test:wardrobe:unit-components
```

To run only the two E2E tests:

```powershell
pnpm test:wardrobe:e2e
```

## Run an individual test

Each command below starts from the project root and runs only the named test. Alternatively, open that test's folder in PowerShell and run `pnpm test` there. Run the two individual E2E commands one at a time because they use the same local test port.

### WOP-U01 - No-occasion matching score

**Type:** Unit test using Vitest. **Folder:** `01-match-score-unit`.

Calls the real matching function with a White Minimalist linen top and Black Minimalist cotton trousers. Checks a score of 100/100: 50 colour-coordination points and 50 style-harmony points. The input garments are defined in `fixtures.js`; the assertions are in `matchScore.spec.js`.

```powershell
pnpm --dir tests/wardrobe-outfit-planner/01-match-score-unit test
```

No browser, backend, database or external API is required.

### WOP-C01 - Clothing card and colour tags

**Type:** Component test using Vitest and Vue Test Utils. **Folder:** `02-clothing-card-component`.

Mounts the real `ClothingCard` component. Checks its name, photo, category and multiple colour tags, then changes its props and checks that the displayed name, photo and tags update. The test is in `__tests__/ClothingCard.spec.js`.

```powershell
pnpm --dir tests/wardrobe-outfit-planner/02-clothing-card-component test
```

Runs in jsdom without a real backend or database. The component is unmounted after the test.

### WOP-C02 - Required style validation

**Type:** Component test using Vitest and Vue Test Utils. **Folder:** `03-clothing-form-component`.

Mounts the real `ClothingForm` with the other required fields filled. Submits without a style and checks that the error says "Choose at least one style." and no backend request is sent. The test is in `__tests__/ClothingForm.spec.js`.

```powershell
pnpm --dir tests/wardrobe-outfit-planner/03-clothing-form-component test
```

Runs in jsdom. Router, photo-reading and API boundaries are mocked or stubbed; no real backend or database is used. The component is unmounted and mocks are cleared after the test.

### WOP-E01 - Wardrobe create, search, edit and delete

**Type:** E2E test using Playwright. **Folder:** `04-wardrobe-crud-e2e`.

Uses the actual website and backend to add a clothing item, refresh and find it by a colour tag, edit its name and material, delete it, and verify persisted results through the real API. The test is in `tests/wardrobe.spec.js`.

```powershell
pnpm --dir tests/wardrobe-outfit-planner/04-wardrobe-crud-e2e test
```

The command builds the frontend and starts the isolated local Express/MongoDB test environment described below.

### WOP-E02 - Save and update the same outfit

**Type:** E2E test using Playwright. **Folder:** `05-outfit-save-edit-e2e`.

Selects a top, bottom and shoes, checks 100/100 match and 3/3 required basics, requires an outfit name, saves, reopens for editing and replaces the top. Checks that the final outfit survives refresh and keeps the original outfit ID without creating a duplicate. The test is in `tests/outfit.spec.js`.

```powershell
pnpm --dir tests/wardrobe-outfit-planner/05-outfit-save-edit-e2e test
```

The command builds the frontend and starts the isolated local Express/MongoDB test environment described below.

## Shared setup and test isolation

- `vitest.config.js`: shared Vitest/Vue settings and the combined three-test configuration. Individual Vitest configurations select one test file and its Node or jsdom environment.
- `playwright.config.js`: shared Playwright settings and the combined two-test configuration. Individual Playwright configurations select one E2E test folder.
- `e2e-helpers.js`: local-only guard, fixture login helper and absolute fixture-photo path.
- `e2e-server.cjs`: starts the real local Express routes, authentication and a disposable MongoDB with local fixture users and clothing items. It never reads `.env`, imports the production server or connects to Atlas.

The E2E app runs at `http://127.0.0.1:4186`. Its database is `dripped_wardrobe_outfit_tests` on a temporary local MongoDB port. The test server checks that the database URI is local and the database name is correct. The local database is discarded when the test server stops; shared project data is untouched.

Weather and Colour API providers return fixed local fixtures. These tests check application behaviour, not external-provider availability. Fixture photos are reused, so the tests do not check visual garment recognition.

The shared root Playwright configuration excludes this section because it needs its own isolated local app. Use the commands in this README to run it.

## Evidence and generated files

Each test folder contains its successful native PowerShell screenshot, `powershell.png`.

The default commands print results to the console and do not create `test-results` or `playwright-report` folders in the project. Playwright's temporary runtime files go to the OS temporary directory. Any manually generated HTML report can be saved outside the project.

The five-page test-evidence PDF has one page per test: its name, purpose, run command and successful PowerShell screenshot. Append this individual section to the group's combined submission PDF.
