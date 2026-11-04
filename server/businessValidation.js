const { CATEGORIES, STYLES, badRequest, photo, money, text, choice } = require('./communityValidation');

const { COLOURS } = require('./services/wardrobeValidation');
const { MAX_COLOUR_PHOTO_BYTES } = require('./services/colourPhotos');

// Person 4: checks for the business portal forms. Reuses the Community helpers.
const COIN_COSTS = { boost: 20, 'extra-listing': 10, premium: 30 };
const COIN_PACKAGES = [100, 250, 500];
// Products a business can list for free. Each one after that costs COIN_COSTS['extra-listing'] coins.
const FREE_LISTINGS = 20;
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

// Person 4: stock per size. Accepts { S: 2, M: 5 } or [{ size: 'S', stock: 2 }].
// Returns the sizes, the per-size rows and the total stock.
function sizeStockInput(value) {
  const rows = Array.isArray(value)
    ? value.map(entry => [entry?.size, entry?.stock])
    : value && typeof value === 'object' ? Object.entries(value) : null;
  if (!rows || !rows.length || rows.length > 12) throw badRequest('Add between 1 and 12 sizes, each with its stock.');
  const seen = new Set();
  const sizeStock = rows.map(([size, stock]) => {
    const name = typeof size === 'string' ? size.trim() : '';
    if (!name || name.length > 20) throw badRequest('Each size needs a name of up to 20 characters.');
    if (seen.has(name.toLowerCase())) throw badRequest(`The size "${name}" is listed twice.`);
    seen.add(name.toLowerCase());
    return { size: name, stock: wholeNumber(stock, `Stock for size ${name}`, 100000) };
  });
  const stock = sizeStock.reduce((sum, entry) => sum + entry.stock, 0);
  if (stock > 100000) throw badRequest('Total stock must be 100000 or less.');
  return { sizes: sizeStock.map(entry => entry.size), sizeStock, stock };
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

// Person 4: shoes only use US number sizes, such as 9 or 9.5.
function checkShoeSizes(sizes) {
  const wrong = sizes.find(size => !/^(?:[1-9]|1\d|20)(?:\.5)?$/.test(size));
  if (wrong) throw badRequest(`Shoes use US number sizes like 9 or 9.5, not "${wrong}".`);
}

function colourPhotoInput(value, colours) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badRequest('Choose a valid photo for each colour.');
  const uploads = {};
  for (const [colour, image] of Object.entries(value)) {
    if (!colours.includes(colour)) continue; // That colour was unticked after choosing its photo.
    uploads[colour] = photo(image);
    if (uploads[colour].data.length > MAX_COLOUR_PHOTO_BYTES) throw badRequest(`The photo for ${colour} must be 1 MB or smaller.`);
  }
  return uploads;
}

function productInput(body, { photoRequired }) {
  objectBody(body, 'product');
  const hasColourPhotos = body.colourPhotos && Object.keys(body.colourPhotos).length;
  if (photoRequired && !body.photo && !hasColourPhotos) throw badRequest('Please choose a product photo.');
  // Accept the old single-colour payload while storing the offered colours consistently.
  const offered = body.colours === undefined ? (body.colour ? [body.colour] : []) : body.colours;
  if (!Array.isArray(offered) || !offered.length || offered.length > COLOURS.length || offered.some(colour => !COLOURS.includes(colour)))
    throw badRequest('Choose at least one valid product colour.');
  const colours = [...new Set(offered)];
  // New forms send stock per size. Older callers that send `sizes` + one `stock`
  // number still work: the product then has one shared stock for all sizes.
  const sizing = body.sizeStock !== undefined
    ? sizeStockInput(body.sizeStock)
    : { sizes: textList(body.sizes, 'size', 12, 20), sizeStock: undefined, stock: wholeNumber(body.stock, 'Stock', 100000) };
  if (body.category === 'Shoes') checkShoeSizes(sizing.sizes);
  return {
    name: text(body.name, 'Product name', 80),
    price: money(body.price, 'Price'),
    style: choice(body.style, STYLES, 'style'),
    category: choice(body.category, CATEGORIES, 'category'),
    colours,
    colour: colours.length === 1 ? colours[0] : undefined,
    material: text(body.material, 'Material', 50),
    occasions: textList(body.occasions, 'occasion', 8, 40),
    sizes: sizing.sizes,
    sizeStock: sizing.sizeStock,
    stock: sizing.stock,
    description: text(body.description, 'Description', 1000),
    status: body.status === undefined ? 'active' : choice(body.status, ['active', 'hidden'], 'status'),
    photo: body.photo ? photo(body.photo) : undefined,
    colourPhotoUploads: colourPhotoInput(body.colourPhotos, colours),
    sizePhoto: body.sizePhoto ? photo(body.sizePhoto) : undefined
  };
}

function responseInput(body) {
  objectBody(body, 'reply');
  if (typeof body.productId !== 'string' || !body.productId) throw badRequest('Choose a product to suggest.');
  return { productId: body.productId, message: text(body.message, 'Message', 1000) };
}

module.exports = { COIN_COSTS, COIN_PACKAGES, FREE_LISTINGS, PROMOTION_DAYS, profileInput, productInput, sizeStockInput, responseInput };
