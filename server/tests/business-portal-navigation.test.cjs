const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const project = path.join(__dirname, '../..');
const read = name => fs.readFileSync(path.join(project, name), 'utf8');

test('business portal has no links into the customer side', () => {
  const layout = read('src/components/BusinessLayout.vue');
  const menu = layout.slice(layout.indexOf('class="biz-account-menu"'));
  assert.ok(menu.indexOf("{ name: 'business-profile' }") >= 0 && menu.indexOf('Log out') > 0);
  assert.doesNotMatch(layout, /View Customer Website/);
  assert.doesNotMatch(layout, /name: 'discover'/);
  const studio = read('src/view/business/StyleVideos.vue');
  assert.doesNotMatch(studio, /name: 'style-feed'/);
  assert.doesNotMatch(studio, /Watch Style Feed/);
  const profile = read('src/view/business/BusinessProfile.vue');
  assert.doesNotMatch(profile, /discover-business/);
});

test('business accounts are sent back to the portal from customer pages', async () => {
  const { createAuthGuard } = await import('../../src/router/routeAccess.mjs');
  const business = createAuthGuard(async () => ({ role: 'business' }));
  const home = { name: 'business-dashboard', replace: true };
  for (const name of ['discover', 'style-feed', 'profile', 'cart', 'wardrobe', 'community-requests']) {
    assert.deepEqual(await business({ name, meta: {} }), home);
  }
  assert.equal(await business({ name: 'business-products', meta: { businessLayout: true } }), true);
  const customer = createAuthGuard(async () => ({ role: 'consumer', surveyCompleted: true }));
  assert.equal(await customer({ name: 'discover', meta: {} }), true);
});

test('customer header no longer offers a misleading site-wide search shortcut', () => {
  const navbar = read('src/components/AppNavbar.vue');
  assert.doesNotMatch(navbar, /aria-label="Search"/);
  assert.doesNotMatch(navbar, /focusSearch/);
  // Actual search inputs remain on the pages where they perform a search.
  const inbox = read('src/view/business/CustomerRequest.vue');
  assert.match(inbox, /id="request-list-search"/);
});

test('customer account menu uses the business-style avatar/dropdown pattern', () => {
  const navbar = read('src/components/AppNavbar.vue');
  assert.match(navbar, /class="community-account-trigger"/);
  assert.match(navbar, /:aria-expanded="accountOpen"/);
  const dropdown = navbar.slice(navbar.indexOf('class="community-account-popover"'));
  assert.ok(dropdown.indexOf('Customer profile') >= 0);
  assert.ok(dropdown.indexOf('Log out') > dropdown.indexOf('Customer profile'));
  assert.match(navbar, /closeAccountOnOutsideClick/);
  assert.match(navbar, /@keydown\.esc/);
  const css = read('src/assets/styles/community.css');
  assert.match(css, /\.community-account-popover\s*\{/);
  assert.match(css, /\.community-account-trigger\s*\{/);
});
