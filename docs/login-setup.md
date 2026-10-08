# Login setup

Open http://127.0.0.1:5173/login after starting both servers.

The floral login page is a dedicated layout. Registration is available at /register for Customer and Business accounts. It validates the form, stores a password hash and signs in immediately. Password reset remains a future feature.

## Create an account

Open /register and create a Customer or Business account through the website. Registration saves the user in the connected MongoDB database's `users` collection and signs them in. You can view those records in MongoDB Atlas under Browse Collections.

Passwords are stored as salted scrypt hashes. Use /login to sign in with the registered email and password; do not insert plaintext passwords into MongoDB.

## Backend connection

`server/.env` must contain `MONGODB_URI` or the existing `DB` variable and `CLIENT_ORIGIN=http://127.0.0.1:5173` (localhost is also allowed during development). Your current database connection settings can be retained. Atlas must allow your computer IP.

```powershell
pnpm dev
```

In another terminal in the root folder, run `pnpm dev`.

## Login flow

Login.vue -> authService.js -> POST /api/auth/login -> User password verification -> auth_sessions -> HttpOnly cookie -> Community page. The backend restores req.user before Community endpoints. Sessions expire after 12 hours; Remember me extends them to 30 days and uses a persistent cookie. Logout deletes the stored session.

All application APIs now require verified login through server/middleware/authentication.js, even when COMMUNITY_DEMO_MODE is set. Only the authentication endpoints can be called without a session. Use HTTPS in production, where the session cookie is Secure.

## Checks

From the project root:

```powershell
node --test server/tests/auth-login.test.cjs server/tests/community.test.js
pnpm build
```

Backend tests use in-memory records and actual HTTP requests, without modifying Atlas. The generated login photograph is public/images/login-wardrobe.png.

## Clean URLs and access control

Vue uses createWebHistory: /login and /register are public. Every other registered page is private by default. The frontend guard validates the server session before navigation and redirects guests to /login. Server middleware verifies the session and rejects protected API access with HTTP 401. Frontend Community requests also redirect to login if the session expires.

Vite provides the SPA fallback in development. When deploying the frontend, configure your hosting provider to serve index.html for unknown frontend paths such as /community; keep /api requests routed to Express. This lets direct links and refresh work with clean URLs. Old /#/... bookmarks are converted to clean paths automatically.

Tests including registration and access guards:

```powershell
node --test server/tests/auth-login.test.cjs server/tests/registration-access.test.cjs server/tests/community.test.js
```
