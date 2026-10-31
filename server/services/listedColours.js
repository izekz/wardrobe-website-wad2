// Prefer structured business product colours. For older listings, use only
// colour names explicitly present in the product's own details.
// Never turn the wardrobe's complete colour palette into implied stock variants.
const { COLOURS } = require('./wardrobeValidation');
const pattern = new RegExp(`\\b(?:${COLOURS.slice().sort((a, b) => b.length - a.length).join('|')})\\b`, 'gi');

function namesIn(text) {
  if (typeof text !== 'string') return [];
  // Treat "navy blue" as Navy, not two separate product variants.
  const normalized = text.replace(/\bnavy\s+blue\b/gi, 'Navy').replace(/\bgray\b/gi, 'Grey');
  const found = [...normalized.matchAll(pattern)].map(match => COLOURS.find(c => c.toLowerCase() === match[0].toLowerCase()));
  return [...new Set(found.filter(Boolean))];
}

function listedColours(product = {}) {
  // Structured metadata takes precedence over incidental colours in the description.
  const specified = product.colours?.length ? product.colours
    : product.colors?.length ? product.colors : product.colour ?? product.color;
  const explicit = namesIn(Array.isArray(specified) ? specified.join(', ') : specified);
  if (explicit.length) return explicit;

  const description = String(product.description || '');
  // Only explicitly offered variants can form a multi-option checkout selector.
  const offer = description.match(/\b(?:colou?rs?(?:\s+available)?|available\s+(?:colou?rs?)|available\s+in|comes\s+in)\s*[:\-]?\s*([^.!;\n]+)/i);
  if (offer) {
    const available = namesIn(offer[1]);
    if (available.length) return available;
  }

  const title = namesIn(product.name);
  if (title.length === 1) return title;
  // A title containing several colours isn't necessarily a list of variants;
  // it could describe one striped or multicolour garment.
  if (title.length > 1) return ['Multicolour'];
  const descriptive = namesIn(description);
  return descriptive.length === 1 ? descriptive : [];
}

module.exports = { listedColours, namesIn };
