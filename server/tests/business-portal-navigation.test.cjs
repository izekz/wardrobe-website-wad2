const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const project = path.join(__dirname, '../..');
const read = name => fs.readFileSync(path.join(project, name), 'utf8');

test('customer website link is between Business profile and Log out in the account menu, not separately in the header', () => {
  const layout = read('src/components/BusinessLayout.vue');
  const menu = layout.slice(layout.indexOf('class="biz-account-menu"'));
  const profile = menu.indexOf("{ name: 'business-profile' }");
  const customer = menu.indexOf('View Customer Website');
  const logout = menu.indexOf('Log out');
  assert.ok(profile >= 0 && customer > profile && logout > customer);
  assert.ok(menu.includes("{ name: 'discover' }"));
  assert.equal((layout.match(/View Customer Website/g) || []).length, 1);
  const css = read('src/assets/styles/business.css');
  assert.doesNotMatch(css, /\.biz-customer-menu-link\s*\{\s*display:\s*none/);
});

test('business request search shortcut opens its actual inbox and focuses the correct input', () => {
  const navbar = read('src/components/AppNavbar.vue');
  assert.match(navbar, /businessRequests\?'business-requests':'style-feed'/);
  assert.match(navbar, /businessRequests\?'request-list-search':'sf-page-title'/);
  const inbox = read('src/view/business/CustomerRequest.vue');
  assert.match(inbox, /id="request-list-search"/);
});
