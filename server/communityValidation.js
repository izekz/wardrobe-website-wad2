const CATEGORIES = ['Tops', 'Bottoms', 'Jackets', 'Dresses', 'Shoes', 'Accessories'];
const STYLES = ['Minimalist', 'Streetwear', 'Vintage', 'Y2K', 'Formal', 'Casual', 'Preppy'];
const CONDITIONS = ['New', 'Like new', 'Good', 'Fair'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
function text(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw badRequest(`${label} is required and must be at most ${maximum} characters.`);
  }
  return value.trim();
}
function choice(value, options, label) {
  if (!options.includes(value)) throw badRequest(`Choose a valid ${label}.`);
  return value;
}
function money(value, label) {
  // Reject empty strings, null and booleans rather than turning them into zero.
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000) {
    throw badRequest(`${label} must be a number between S$0 and S$100,000.`);
  }
  if (Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
    throw badRequest(`${label} can have at most two decimal places.`);
  }
  return Math.round(value * 100) / 100;
}
function requestKey(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw badRequest('Refresh the form and try posting again.');
  }
  return value;
}
function photo(value) {
  if (typeof value !== 'string') throw badRequest('Please choose a clothing photo.');
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw badRequest('Choose a JPG, PNG or WebP photo.');
  if (match[2].length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4) throw badRequest('Your photo must be 5 MB or smaller.');
  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > MAX_PHOTO_BYTES || data.toString('base64') !== match[2]) {
    throw badRequest('The photo could not be read or is too large.');
  }
  const jpeg = data.length > 4 && data[0] === 255 && data[1] === 216 && data[2] === 255;
  const png = data.length > 8 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = data.length > 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
  if (!((match[1] === 'image/jpeg' && jpeg) || (match[1] === 'image/png' && png) || (match[1] === 'image/webp' && webp))) {
    throw badRequest('The photo does not match its file type.');
  }
  return { data, contentType: match[1] };
}
function singaporeToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function deadline(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest('Choose a valid needed-by date.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < singaporeToday()) {
    throw badRequest('The needed-by date must be today or later.');
  }
  return value;
}
function listingInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('The listing information could not be read.');
  const listingType = choice(body.listingType, ['sell', 'rent'], 'listing type');
  return {
    name: text(body.name, 'Product name', 80), category: choice(body.category, CATEGORIES, 'category'),
    style: choice(body.style, STYLES, 'style'), size: text(body.size, 'Size', 20),
    condition: choice(body.condition, CONDITIONS, 'condition'), description: text(body.description, 'Description', 1000),
    listingType, price: listingType === 'sell' ? money(body.price, 'Price') : undefined,
    rentalPrice: listingType === 'rent' ? money(body.rentalPrice, 'Daily rental price') : undefined,
    clientRequestId: requestKey(body.clientRequestId), photo: photo(body.photo)
  };
}
function outfitRequestInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('The request information could not be read.');
  return {
    title: text(body.title, 'What you are looking for', 100), occasion: text(body.occasion, 'Occasion', 80),
    description: text(body.description, 'Description', 1000), budget: money(body.budget, 'Budget'),
    preferredStyle: choice(body.preferredStyle, STYLES, 'style'), deadline: deadline(body.deadline),
    clientRequestId: requestKey(body.clientRequestId)
  };
}
module.exports = { CATEGORIES, STYLES, CONDITIONS, MAX_PHOTO_BYTES, badRequest, listingInput, outfitRequestInput, singaporeToday, photo, money, text, choice };
