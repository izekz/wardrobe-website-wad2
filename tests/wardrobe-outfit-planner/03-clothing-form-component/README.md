# WOP-C02: Required style validation

**Type:** Component. **Number of tests:** 1.

## What it tests

Mounts the real ClothingForm with the other required fields filled. Submits without a style and checks the error message and that no backend request is sent.

## Run in PowerShell

Install the project dependencies once from the project root (`pnpm install` and `pnpm --dir server install`). Then:

```powershell
cd "tests/wardrobe-outfit-planner/03-clothing-form-component"
pnpm test
```

The folder's package.json runs only this test. Application source code is imported from the real project, not copied into the test folder.

## Test boundary

Vue Test Utils mounts the real component in jsdom. Router, file-reading and API boundaries are mocked only where needed; no real database is used.

The genuine PowerShell result screenshot for this test is `powershell.png` in this folder. No HTML test reports are generated.
