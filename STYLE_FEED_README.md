# Dripped — Style Feed update (21 October 2026)

This ZIP updates the latest supplied group project (`wardrobe-website-wad2(10).zip`). It replaces the **customer-facing community sale/rental marketplace** with **Style Feed**, while keeping the **Outfit Request Board**, business catalogue, accounts, wardrobe, and wallet.

## What is new

- `/style-feed` — one-video-at-a-time feed for businesses' MP4/WebM outfit videos, with ↑ / ↓ keys, smooth snap-scrolling with one-video wheel gesture limits, mobile swipe support, autoplay of the active post, mute, likes, product link, and **filtered business storefront** link.
- `/business/style-videos` — business-only studio to upload a video, link it to **one existing active product**, see videos, delete them, and spend **20 coins for a seven-day boost** (or extend it).
- `/api/style-feed/*` — protected Express/Mongoose API; MongoDB stores video bytes (8 MB max per clip). Supports range requests so users can seek in video.
- **Shuffled feed with sponsored insertion** — video order is reshuffled on every refresh. The server shuffles organic and boosted pools separately and mixes one boosted video after every three organic videos. Sponsored posts get a clearly visible Sponsored tag; each boost expires automatically. The browser requests a different opening video on refresh where another eligible opener exists.
- **Demonstrable outcomes** — views (after 2 seconds of active playback), likes, sponsored impressions, unique sponsored reach, product clicks, and store clicks. Business owners can see the numbers in the studio.
- **Existing coin wallet** — boost spends 20 coins from the already-implemented business wallet, with a transaction in wallet history; top-ups remain simulated (no actual payment).
- No comments, payment gateway, or video hosting service.

## Before you run it (configuration restored)

**This corrected ZIP includes `server/.env` restored from your original uploaded `wardrobe-website-wad2(10).zip`.** You no longer need to copy it by hand. The backend uses the same MongoDB Atlas connection as the original project. Treat this ZIP as **private**: do not upload it to a public Git repository or share it publicly because `.env` contains database credentials. The project still excludes `.git` and `node_modules`.

Use **the same terminal commands your group already uses**:

**Terminal A (backend):**
```bash
cd server
pnpm install
pnpm dev
```

**Terminal B (frontend):**
```bash
pnpm install
pnpm dev
```

If your existing local dependencies already work, you can use them instead of reinstalling. Default ports are `http://localhost:3000` (API) and `http://localhost:5173` (frontend). Build locally on your Mac with `pnpm build` (or `pnpm run build`) from the project root.

## Professor demo flow

1. Log into an existing **business** account with a configured business profile.
2. Add at least **four active products** under Business → Manage products, if none exist.
3. In **Style Feed studio**, upload four short MP4/WebM outfit videos; each must link to a product.
4. Spend **20 coins** to boost **one** of the four videos. Wallet decreases immediately, and the video shows an expiry date. The boosted clip is displayed after the three organic clips.
5. Log in with a **customer account**, open **Style Feed**, press ↓ (or scroll down), then watch at least 2 seconds. Like the sponsored video, then use **View product** or **Visit store** on the separate product card.
6. Return to the business account and open **Style Feed studio**. You can show the sponsored impression, unique reach, view, like, and click counters. Have another customer account view it to increase the **unique** reach.
7. Open the **Outfit Request Board** to demonstrate that the previously completed request → suggestion → checkout/wardrobe flow is still available.

## Scope and compatibility

Legacy `/community` and old `/community/listings/...` frontend URLs redirect to `/style-feed`. Sale/rental screens are removed from the frontend. **The old community listing APIs, database model, and existing admin moderation pages were left intact for backwards compatibility with other teammates' work**. They are not part of Style Feed and no old listing data is deleted.

## Validation

- Earlier audit: Vue SFC parser/template compiler validated 42 components. Recheck this edited ZIP locally with `pnpm qa`.
- Earlier audit ran 90 backend tests. This update additionally runs focused interaction tests for feed looping, refresh gestures and role-specific request filtering (see below).
- Full Vite build was **not** possible in the testing environment because the uploaded node_modules contain macOS-native dependencies, while the test environment is Linux. Please run `pnpm install` / `pnpm build` on your own Mac and browser-test the video upload & Atlas integration.

## Main changed / added files

Backend: `server/models/StyleVideo.js`, `server/routes/styleFeed.js`, `server/server.js`, `server/controllers/businessController.js`, `server/tests/style-feed.test.js`.

Frontend: `src/view/styleFeed/StyleFeed.vue`, `src/view/business/StyleVideos.vue`, `src/services/styleFeedApi.js`, `src/assets/styles/styleFeed.css`, routers/navbars, Promotions, Discover/Store and Profile.

## Login page / backend startup fix

This version restores `server/.env` from the exact original ZIP and changes the server startup log to print the underlying exception rather than `Backend startup failed: Error`. The Vite `/api/auth/session` proxy message is a consequence of the backend not running; once the backend has connected and is listening on port 3000, refresh the page. If startup still fails, the terminal will now show the actual reason (for example, an Atlas network restriction or password change).

## 20 October QA corrections

The member-profile link on Outfit Requests has been restored, business accounts now open the correct profile screen, videos with out-of-stock products cannot be boosted, and Shop/Store taps don't wait for analytics. See `QA_REPORT.md` for details and limitations. Run `pnpm qa` in the project root for source/tests integrity checks.

## 21 October: randomized, one-video-at-a-time feed

- **Refresh = new order:** `/api/style-feed` uses a fresh random shuffle of both regular and boosted videos for every request. A tab remembers the previous first video and asks the server to avoid showing it first again when enough videos exist. With only one available regular video, repeating it is unavoidable while keeping the sponsored placement rule.
- **Sponsored placement is unchanged:** one sponsored video after three regular videos (then after the next three, etc., when there are sufficient posts). The boost costs 20 demo coins per 7 days; randomization does not negate promotion.
- **Natural snap scrolling (updated):** all posts are in a real vertical scroll container with wheel/trackpad gestures animated between posts and native mobile-touch momentum. You can see the adjacent post during the motion. `scroll-snap-type: y mandatory` and `scroll-snap-stop: always` settle on individual videos rather than jumping instantly. Arrow keys also work. The player counter/buttons were deliberately removed.
- **Analytics remain:** autoplay on the current post, 2-second view tracking, paid-impression counting on active posts, likes, product/store links, and mute.

## 21 October: navigation wrap/refresh + personal request view

- From the **last** video, another downward wheel gesture, ↑/↓ navigation or an upward mobile swipe loops back to the **first** video in the current shuffled feed. A wheel gesture advances one post; a separate gesture at the final post loops, so momentum cannot unexpectedly skip multiple videos. From the **first** video, moving up stops. Only refreshing the actual browser page produces a newly shuffled feed; an available alternative opener is preferred.
- A signed-in **customer** sees **only their own outfit requests** at `/community/requests`. The list contains only their requests, with open ones first and closed ones grouped at the end as History. A customer can still post a request and open its suggestions.
- **Business** users retain the full board and their separate business request workflow, since they need to find customers to respond to.
- The customer request UI removes the redundant All requests / My requests switch, the public-board search and style filter, and the unnecessary profile link on each of their own cards. Navigation labels say **My outfit requests** for customers.
- The redundant navbar search icon is hidden on customer request pages; business users on the request board can still focus its search field.
- Focused test command: `node --test server/tests/style-feed-ui.test.js server/tests/request-board-ui.test.js` (runs without a live database).

The full production build and a real browser/MongoDB session still need local verification. The private `server/.env` file remains included.

## 21 October: short-video behavior, mobile breakpoints, and simpler My Outfit Requests

- **First clip / last clip:** Upward gestures at the first clip do nothing; downward gestures at the final clip loop to the first. Browser refresh changes the feed's randomized order. Boosted clips keep their sponsored-placement positions (one after each three organic clips when inventory permits).
- **Mobile layout:** responsive sizing at 1024px, 767px, 480px, and 360px, plus a short-viewport adjustment. The player fits narrower viewports; vertical swipes navigate clips; mute, like, product and store actions remain usable.
- **Watched clips:** no permanent removal is enabled. A strict unseen-only filter can quickly empty a small demo catalogue or suppress paid sponsored content. The feed reshuffles on browser reload and avoids repeating the prior opening video when possible.
- **Customer requests:** All status and manual-refresh controls are removed from the customer request list; open items appear before History. New requests start Open. Suggestions refresh automatically every 15 seconds while visible.
- **Accepting a suggestion:** changes the associated request's status to Closed immediately. Optional demo checkout remains possible afterward and still adds the item to wardrobe without real payment.
- **Deleting:** owners can use Delete on a request card or detail page; the request is hidden from all public and private lists. The server keeps internal linked records so completed demo-purchase receipts and wardrobe data are not orphaned. Deleting is account-authorized, not based on the client-provided user ID.
- **Validation:** `node --test server/tests/*.test.js server/tests/*.test.cjs` and `node qa/check-project.mjs` (no live Atlas access needed). Build using `pnpm install && pnpm build` on your Mac.

## 21 October: smooth TikTok/Shorts-style movement

- Replaced wheel-driven instant post changes with native vertically scrollable cards and CSS `scroll-snap` with `scroll-snap-stop: always`. Scrolling now reveals the next/previous post during the motion instead of teleporting directly between posts. Wheel gestures are limited to one smoothly animated video transition to prevent accidental skipping; native mobile drag is retained.
- Only the active clip plays. Adjacent clips use lightweight metadata preloading; distant clips are not preloaded.
- A separate downward gesture at the bottom wraps to the first clip. Upward scrolling at the top remains blocked. Keyboard arrows work with a smooth animated transition.
- No changes to shuffled sponsored placement, outfit requests, coins, or existing database configuration.
- Focused validation: `node --test server/tests/style-feed-ui.test.js`. Full project checks require installing dependencies locally.

## 22 October: standard short-video portrait sizing

- The Style Feed video stage is now a true **9:16 portrait frame** (like TikTok and YouTube Shorts), calculated from available viewport height and width. The previous wide 545px player in a shallow viewport made videos look more square than intended.
- The product card remains below the frame; its height is not included in the video frame ratio. The scroll-snap viewport is still exactly one full post tall, so existing gesture, keyboard, autoplay, looping and sponsored placement behavior is unchanged.
- Responsive rules apply to desktop, tablet, mobile, compact phones and shorter landscape displays. Business video upload previews also use 9:16.
- **Recommended clip source:** portrait **1080 × 1920** (9:16). In Style Feed, videos are displayed with `object-fit: cover` to fill the full-height portrait player; square or landscape source videos are center-cropped. Upload 9:16 clips to avoid cropping important outfit details.

## 22 October: TikTok-style immersive player

- Customer Style Feed now uses the full screen area below the existing site navigation. The page title is available to screen readers but no longer takes visible space above the videos.
- A video takes almost all usable viewport height while maintaining a **9:16** frame. On a 1366 × 768 desktop viewport, this is approximately **383 × 681 px**; at 393 × 852, it is **393 × 699 px**. Actual measurements depend on viewport and header height.
- Product CTA, likes, sponsored indicator, caption, and Shop/Store controls overlay the portrait video rather than reserving a separate product card below it.
- The existing smooth scroll-snap navigation, random ordering, boosted slots, and request pages are unchanged.


## 22 October: playback timeline and detached product card

- The full-height 9:16 portrait video includes a **thin red playback timeline** along the bottom edge. It uses real HTMLVideoElement `currentTime` / `duration` and can be dragged or clicked to seek. When the video loops, the progress returns to the beginning.
- The product promotion banner has been removed **from inside the video**. On desktop, a small shopping card sits alongside the video, showing the product image, name, price, View product, and Visit store. On mobile, the same actions are in a narrow, separate strip **below the video**.
- On phones, the portrait player gives up the few pixels required to fit the product strip within the viewport; on desktop, its full-height 9:16 sizing remains unchanged. Sponsored placements, likes, mute, refresh shuffle, scrolling/snap/loop, and request features were not modified.
- Focused playback/markup tests: `node --test qa/style-feed-playback.test.cjs`. Browser layout checks were performed at 1366×768, 1440×900, 820×1180, 768×1024, 767×1024, 393×852, 360×640, and 320×568. Live database/video-streaming still needs testing on the user's Mac.
