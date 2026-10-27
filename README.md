# Dripped — IS216 Group Project (configured Style Feed fix)

**Backend startup fix:** this ZIP includes the `server/.env` restored from your original uploaded project. It also displays full backend startup errors if MongoDB is unreachable.

**Keep this ZIP private:** `server/.env` contains your group's existing database connection credentials. Do not push it to a public repository or share it publicly. `.gitignore` already ignores `.env`.

## Run on your Mac

Open two terminal tabs in this project folder.

Backend (first tab):
```bash
cd server
pnpm install
pnpm dev
```

Frontend (second tab, project root):
```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173. Verify the backend prints `MongoDB connected` and `Backend running at http://localhost:3000` before opening the login page.

See `STYLE_FEED_README.md` for features and your class demonstration flow.
