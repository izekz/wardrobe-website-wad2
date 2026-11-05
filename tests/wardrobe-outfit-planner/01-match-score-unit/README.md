# WOP-U01: No-occasion matching score

**Type:** Unit. **Number of tests:** 1.

## What it tests

Calls the real matching function with a White Minimalist linen top and Black Minimalist cotton trousers. Checks a score of 100/100, made up of 50 colour points and 50 style points.

## Run in PowerShell

Install the project dependencies once from the project root (`pnpm install` and `pnpm --dir server install`). Then:

```powershell
cd "tests/wardrobe-outfit-planner/01-match-score-unit"
pnpm test
```

The folder's package.json runs only this test. Application source code is imported from the real project, not copied into the test folder.

## Test boundary

No browser or database is required.

The genuine PowerShell result screenshot for this test is `powershell.png` in this folder. No HTML test reports are generated.
