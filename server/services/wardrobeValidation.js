const { inferSuitability, normalizeOccasion } = require("./clothingSuitability");
const {
  text,
  choice,
  photo,
  badRequest,
  singaporeToday,
} = require("../communityValidation");
const CATEGORIES = [
  "Tops",
  "Bottoms",
  "Jackets",
  "Dresses",
  "Shoes",
  "Accessories",
];
const COLOURS = [
  "White",
  "Black",
  "Beige",
  "Cream",
  "Grey",
  "Brown",
  "Navy",
  "Blue",
  "Pink",
  "Purple",
  "Green",
  "Red",
  "Yellow",
  "Orange",
  "Multicolour",
];
const STYLES = [
  "Minimalist",
  "Streetwear",
  "Vintage",
  "Y2K",
  "Preppy",
  "Classic",
  "Romantic"
];
const OCCASIONS = [
  "University",
  "Presentation",
  "Interview",
  "Date",
  "Internship / work",
  "Casual outings",
  "Formal events"
];
const WEATHER = ["Warm", "Rainy", "Cool"];
function tags(value, options, label) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > options.length ||
    value.some((v) => !options.includes(v))
  )
    throw badRequest(`Choose at least one valid ${label}.`);
  return [...new Set(value)];
}
function occasionInput(value) {
  return choice(normalizeOccasion(value), OCCASIONS, "occasion");
}
function itemInput(body = {}, requirePhoto = true, { allowLegacyStyles = false } = {}) {
  const result = {
    name: text(body.name, "Item name", 80),
    category: choice(body.category, CATEGORIES, "category"),
    colour: choice(body.colour, COLOURS, "colour"),
    material: text(body.material, "Material", 50),
    // Only trusted legacy checkout conversion may carry retired product styles.
    style: tags(body.style, allowLegacyStyles ? [...STYLES, "Casual", "Formal", "Smart casual", "Cosplay"] : STYLES, "style"),
  };
  Object.assign(result, inferSuitability(result));
  if (requirePhoto || body.photo !== undefined)
    result.photo = photo(body.photo);
  return result;
}
function dateInput(value) {
  const date = value || singaporeToday();
  const parsed =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(date + "T00:00:00Z")
      : null;
  if (
    !parsed ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date < singaporeToday()
  )
    throw badRequest("Choose today or a future date.");
  return date;
}
module.exports = {
  CATEGORIES,
  COLOURS,
  STYLES,
  OCCASIONS,
  WEATHER,
  itemInput,
  dateInput,
  occasionInput,
  choice,
  text,
  badRequest,
};
