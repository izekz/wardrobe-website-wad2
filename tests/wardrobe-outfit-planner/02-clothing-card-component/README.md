# WOP-C01: Clothing card and colour tags

**Type:** Component. **Number of tests:** 1.

## What it tests

Mounts the real ClothingCard component. Checks its name, photo and multiple colour tags, then changes its props and checks that the displayed name, photo and tags update.

## Run in PowerShell

Install the project dependencies once from the project root (`pnpm install` and `pnpm --dir server install`). Then:

```powershell
cd "tests/wardrobe-outfit-planner/02-clothing-card-component"
pnpm test
```

The folder's package.json runs only this test. Application source code is imported from the real project, not copied into the test folder.

## Test boundary

Vue Test Utils mounts the real component in jsdom. Router, file-reading and API boundaries are mocked only where needed; no real database is used.

The genuine PowerShell result screenshot for this test is `powershell.png` in this folder. No HTML test reports are generated.
