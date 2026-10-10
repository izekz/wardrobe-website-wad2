# Dripped — Week 9 update for version (8)

This update is based on `wardrobe-website-wad2(8).zip`. It implements the complete business-suggestion demo and your community-management requests. The purchase is a **demo purchase: no real payment is collected**.

## Apply it to your current project

Use the updater below to keep your existing Git repository, database connection and installed packages.

1. Stop the frontend and backend terminals with **Control + C**.
2. Extract the downloaded ZIP. You will get a folder named `dripped-week9-v8-update`.
3. Put that folder inside your existing `wardrobe-website-wad2` project, beside `src`, `server` and `package.json`.
4. Open your **existing project** in VS Code. Open a terminal at the project root, not inside `server` or the update folder.
5. Check whether this update matches your current files:

   ```bash
   node dripped-week9-v8-update/apply-update.mjs --check .
   ```

6. If it says **Compatibility check passed**, apply the update:

   ```bash
   node dripped-week9-v8-update/apply-update.mjs .
   ```

The updater checks all affected files before replacing anything. It creates a backup beside your project. If you are on `main` or `master`, it creates a `javier/week9-demo-...` working branch. It does not commit, push, install packages, or change your `.env` files.

If it says **No files changed** and lists conflicts, your local files differ from version (8). Keep those changes and send the output and newer project for a merge. Do not bypass that check or overwrite your teammate’s files manually.

7. After a successful update, move the `dripped-week9-v8-update` folder out of your repository so the update package is not accidentally committed with your project. Keep the backup until your group has checked the update.
8. Start the frontend in one terminal at the existing project root:

   ```bash
   pnpm dev
   ```

9. Open a second terminal at the project root and start the backend:

   ```bash
   cd server
   pnpm dev
   ```

10. Open the website at `http://localhost:5173`. Your existing `server/.env` should still connect to the team’s MongoDB Atlas database. No new packages or manual data migration are needed. The backend creates the new purchase collection and its index when it starts.

`project/` inside this package also contains the complete updated source. The updater copies only the changed files listed in `CHANGED-FILES.txt` into your existing repository. You do not need to move that complete project folder into `src` or replace your whole repository.

## Rehearse the four-step demo

Use **one normal browser window for Business and one incognito window for Customer**, or two different browsers. Two ordinary tabs share the same login. Create the accounts and business profile before the presentation. Have a product photo ready.

### 1. Business creates the item

- Open the business dashboard, then Products → Add a product.
- Photo: a clear jacket photo.
- Name: Structured Beige Jacket.
- Price: $38; stock: 3; style: Minimalist; category: Jackets.
- Occasion: Presentation; sizes: S, M, L.
- Description: A light cotton jacket for presentations.
- Click **Publish to store**.

The first five business listings are free; further listings cost 10 coins. Check the account has enough coins if you have already created many rehearsal products.

### 2. Customer posts a request

- Open Community → Outfit requests.
- Looking for: Smart-casual jacket for my presentation.
- Occasion: Presentation; budget: $40; style: Minimalist.
- Needed by: choose a date after the actual presentation day.
- Additional details: A neutral jacket in size M.
- Click **Post request**.

The request is saved under the logged-in customer. The board marks it **Your request** and displays **0 suggestions**. **My requests** shows only this customer’s requests.

### 3. Business responds

- Switch to the business window and open **Customer Requests**.
- The page refreshes when you return to it. A **Refresh requests** button is also available.
- Select the customer’s request, choose the jacket, review the message and click **Send suggestion**.

The customer’s board and request details refresh on returning to the window and approximately every 15 seconds while visible. You can use **Refresh suggestions** for an immediate update during the demo.

### 4. Customer accepts, purchases and checks their wardrobe

- Open the request. The suggestion shows the business product’s photo, name, current price, style, category and sizes.
- Click the product card or **View suggested item**.
- On the existing product-details page, choose size M and click **Accept suggestion**.
- On checkout, choose Beige. Enter Cotton as the material, or leave it blank if unknown.
- Review the $38 total and click **Confirm demo purchase**.
- A receipt appears. Click **View in my wardrobe** to show the newly added jacket.
- Refresh the page to show that the item remains saved.
- Return to Outfit requests or your profile history to show that the request is **Closed / Fulfilled**.

The database saves the receipt and wardrobe item, reduces stock by one, and closes the request together. Repeated submission returns the same receipt and does not purchase twice. The item’s photo is copied into the wardrobe, so deleting the original business product later does not remove that wardrobe photo.

Colour and material are requested because the current business product form does not store those wardrobe details. The outfit planner can use them after purchase. No card number or real payment is involved.

## Your other requested features

| Feature | Where to find it |
| --- | --- |
| Camera icon and capture | Community → My listings → Create a listing → Take a photo. Preview, capture, cancel and file-upload fallback are included. |
| Clear SALE / RENT labels | Listing cards, the listing preview and listing details use different colours, icons and text. |
| My Listings | Community → My listings. View only your listings; edit, delete, mark unavailable or make available again. |
| Open requests before closed | The complete result is sorted before dividing it into pages. Use the status filter for Open only or Closed only. |
| My requests | On the request board, select My requests. Your own cards are also highlighted and labelled in All requests. |
| Suggestion counts | Each request card shows 0, 1, 2, etc. suggestions before you open it. |
| Clickable business suggestions | Open a request to see the same product-card format used in the store. Each available product links to its actual product page. |
| Request history on profiles | Your profile retains its existing account/preferences area and adds community history. Click an owner’s name to view their public listings and request history. |

Listings created earlier under an old demo identity are not automatically reassigned to the person who logs in. For the presentation, create a fresh listing or request while signed in to the correct account.

## How Open / Closed works

- New requests start Open.
- Only the owner can close or reopen their request.
- Accepting a suggestion selects it for checkout. The request remains Open until the purchase is confirmed.
- Manually closing a request clears that selection, retains all previous suggestions and moves the request below open ones.
- A manually closed request can be reopened before its needed-by date.
- A completed demo purchase closes and fulfils the request. It cannot be reopened for another purchase; create a new request instead.
- Closed requests remain visible in history. A business cannot send a new suggestion to a closed or expired request.
- If a business hides or deletes a product, its previous suggestion remains as history and explains that the item is no longer listed.

## What was checked

- Production build passed.
- 75 automated checks passed, including the business/database suite and checkout against an isolated MongoDB replica set.
- Browser walkthrough passed with separate business and customer login sessions, using the real frontend, backend and test MongoDB.
- Verified product creation, request posting, suggestion cards, acceptance, checkout, receipt reload, wardrobe addition and stock reduction.
- Verified ownership restrictions, changed prices, invalid sizes, rollback on a storage failure, repeated purchase clicks and two customers competing for the last item.
- Verified camera capture with a simulated browser camera; file-upload fallback and denied-permission handling are covered separately.
- Verified listing edit/delete/availability, request filters/counts, profile history and mobile layouts without horizontal overflow.

These checks used a private local test database. Your group’s live database was not changed. Rehearse once on the presentation laptop with your team’s accounts. Camera access needs browser permission and localhost or HTTPS; a phone visiting your laptop’s ordinary HTTP network address may need the upload option.

## Scope and contribution

Your community additions reuse the shared navbar/footer and existing store product card. Kathleen’s profile/preferences, admin pages and report-listing link are retained. The checkout connects your request board with Nelvin’s business products and Issac’s wardrobe; it does not add real payment processing, shipping, general store checkout or C2C rental booking.

Explain the demo as: “The customer describes a need, the business suggests a suitable product, and the customer can complete a simulated purchase that updates their wardrobe and request history.”
