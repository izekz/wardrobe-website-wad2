# WOP-E01: Wardrobe create, search, edit and delete

**Type:** End-to-end. **Number of tests:** 1.

## What it tests

Uses the actual website and backend to add an item, refresh and find it by a colour tag, edit it, delete it, and verify that the changes persist in a temporary local database.

## Run in PowerShell

Install the project dependencies once from the project root (`pnpm install` and `pnpm --dir server install`). Then:

```powershell
cd "tests/wardrobe-outfit-planner/04-wardrobe-crud-e2e"
pnpm test
```

The folder's package.json runs only this test. Application source code is imported from the real project, not copied into the test folder.

## Test boundary

Uses the real built frontend, Express backend and a disposable local MongoDB. Weather/colour API providers use fixed fixtures. It never reads .env or accesses Atlas. Requires Microsoft Edge; the first run may download the official local MongoDB binary.

The genuine PowerShell result screenshot for this test is `powershell.png` in this folder. No HTML test reports are generated.
