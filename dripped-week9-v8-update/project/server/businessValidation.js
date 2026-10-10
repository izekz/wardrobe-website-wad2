const { CATEGORIES, STYLES, badRequest, photo, money, text, choice } = require('./communityValidation');

// Person 4: checks for the business portal forms. Reuses the Community helpers.
const COIN_COSTS = { boost: 20, 'extra-listing': 10, premium: 30 };
const COIN_PACKAGES = [100, 250, 500];
const FREE_LISTINGS = 5;
const PROMOTION_DAYS = 7;

function objectBody(body, label) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest(`The ${label} information could not be read.`);
  return body;
}
function textList(value, label, maxItems, maxLength) {
  if (!Array.isArray(value)) throw badRequest(`Choose at least one ${label}.`);
  const items = [...new Set(value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean))];
  if (!items.length || items.length > maxItems || items.some(item => item.length > maxLength)) {
    throw badRequest(`Enter between 1 and ${maxItems} ${label} values.`);
  }
  return items;
}
function wholeNumber(value, label, max) {
  if (!Number.isInteger(value) || value < 0 || value > max) throw badRequest(`${label} must be a whole number from 0 to ${max}.`);
  return value;
}

function profileInput(body) {
  objectBody(body, 'business profile');
  const styles = textList(body.styles, 'fashion style', STYLES.length, 20);
  for (const style of styles) choice(style, STYLES, 'fashion style');
  return {
    businessName: text(body.businessName, 'Business name', 80),
    description: text(body.description, 'Description', 1000),
    contact: text(body.contact, 'Contact', 120),
    styles,
    // The logo is optional. Leave it out when editing to keep the current one.
    logo: body.logo ? photo(body.logo) : undefined
  };
}

function productInput(body, { photoRequired }) {
  objectBody(body, 'product');
  if (photoRequired && !body.photo) throw badRequest('Please choose a product photo.');
  return {
    name: text(body.name, 'Product name', 80),
    price: money(body.price, 'Price'),
    style: choice(body.style, STYLES, 'style'),
    category: choice(body.category, CATEGORIES, 'category'),
    occasions: textList(body.occasions, 'occasion', 8, 40),
    sizes: textList(body.sizes, 'size', 12, 20),
    stock: wholeNumber(body.stock, 'Stock', 100000),
    description: text(body.description, 'Description', 1000),
    status: body.status === undefined ? 'active' : choice(body.status, ['active', 'hidden'], 'status'),
    photo: body.photo ? photo(body.photo) : undefined
  };
}

function responseInput(body) {
  objectBody(body, 'reply');
  if (typeof body.productId !== 'string' || !body.productId) throw badRequest('Choose a product to suggest.');
  return { productId: body.productId, message: text(body.message, 'Message', 1000) };
}

module.exports = { COIN_COSTS, COIN_PACKAGES, FREE_LISTINGS, PROMOTION_DAYS, profileInput, productInput, responseInput };
