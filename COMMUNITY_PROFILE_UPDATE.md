# Dripped — Community Requests grouped by customer profile

Based on the uploaded `wardrobe-website-wad2(20261103-104748).zip`.

## Customer-facing website (business login)
- **Community requests** lists **customer profile cards**, sorted by customer name, instead of a flat list of request cards. Each customer appears once per profile page.
- Businesses can filter by **All**, **Open**, or **Closed / Expired** and search by customer name or request title. Profile pagination is by customer, not by individual request.
- Select **View customer requests** to see all non-deleted requests for that customer (including expired ones). Open a request to read it or send a private in-app follow-up.
- Businesses can message customers about old requests without reopening those requests or creating a product suggestion; no email/phone details are exposed. A business must await a reply before sending a second message. Deleted requests remain hidden.
- Customer accounts continue to see only their own requests and can delete them.

## Business Portal
The **Business Portal → Customer Requests** page, its Open/Replied tabs, and its dashboard links were **not modified**. That inbox remains the location for sending product suggestions to active requests. The customer-facing Community Requests page is for browsing profiles and in-app follow-ups.

## Files / testing
Only community-specific Vue/router/navbar, API/model, CSS and scoped tests were modified. Your teammates' business product management, cart, checkout, wardrobe, dashboard, and Style Feed code was not changed.

`pnpm qa` (with dependencies installed) passed 174 tests, with 1 skipped; 46 Vue components and 32 routes checked. A live database/mobile browser test and full production build on your Mac are still recommended before merging.

This source archive excludes `.env` credentials and dependencies; use the patch installer to update an existing local Git repository without replacing your teammates' files.
