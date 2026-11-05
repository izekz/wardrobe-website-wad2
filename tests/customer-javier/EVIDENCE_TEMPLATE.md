# Javier Ong — Individual Tests (Customer Side)

Format: test title, one concise explanation, screenshot of YOUR test code, screenshot of YOUR terminal/reporter showing PASS. **Do not paste illustrative or fabricated results.**

## 1. Personalised Discover Filters (Unit Test)
Checks that For You offers only styles, occasions and budget values selected in the Style Survey, while All Items restores the full range of filter choices without survey restrictions.

**Code evidence:** screenshot `01-discover-filters.spec.js` showing `surveyFilterOptions()` and `expect()` assertions.

**Result evidence:** screenshot of `vitest ... 01-discover-filters.spec.js --reporter=verbose` with green passing result.

## 2. Personalised Style Survey Validation (Component Test)
Checks that submitting the Style Survey with fewer than two selected styles displays a validation message and sends no save request. After valid style, occasion and budget selections, it verifies that `saveSurvey()` receives the correct values.

**Code evidence:** screenshot `02-survey.component.spec.js` showing `mount()`, selections and assertions.

**Result evidence:** Vitest result for Test 2.

## 3. Product Card Availability and Likes (Component Test)
Checks that ProductCard displays OUT OF STOCK at zero stock, shows a low-stock label when one item remains, and calls the Like service when the customer clicks the heart button.

**Code evidence:** screenshot `03-product-card.component.spec.js` showing stock props and heart click assertions.

**Result evidence:** Vitest result for Test 3.

## 4. Personalised Survey and Product Discovery (E2E Test)
Uses an existing customer account to complete the Style Survey, save Y2K/Vintage, Date and an S$65 budget, then checks the personalised For You dropdowns and unrestricted All Items dropdowns in the running website.

**Code evidence:** screenshot `test('E2E 1 ...')` from `04-survey-discover.e2e.spec.js` showing user actions and `expect()` checks.

**Result evidence:** screenshot of Playwright report showing **E2E 1** as Passed.

## 5. Product Likes, Cart and Checkout (E2E Test)
Uses an in-stock test listing to verify the customer can Like an item, find it in Favorites, add it to cart, complete checkout and receive an order number. Verifies that the backend product stock decreases after the purchase.

**Code evidence:** screenshot `test('E2E 2 ...')` from `05-likes-cart-checkout.e2e.spec.js` showing cart, checkout, order and stock assertions.

**Result evidence:** screenshot of Playwright report showing **E2E 2** as Passed.

## Presentation checklist

- For each test include code screenshot and genuine PASS screenshot.
- Test names visible in all result screenshots.
- No email, password, test database URI or card data in screenshots.
- Mention that the component tests mock the backend, while E2E runs with a live test MongoDB database.
