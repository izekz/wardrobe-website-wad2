const NO_OCCASION = 'No specific occasion';
const namedColours = ['White','Black','Beige','Cream','Grey','Brown','Navy','Blue','Pink','Purple','Green','Red','Yellow','Orange'];
function itemColours(item) {
  const values = item?.source === 'store' ? [item.colour] : Array.isArray(item?.colours) && item.colours.length ? item.colours : [item?.colour];
  return [...new Set(values.map(value => namedColours.find(colour => colour.toLowerCase() === String(value || '').trim().toLowerCase())).filter(Boolean))];
}
// Explainable estimates from clothing metadata. No user-supplied occasion/weather labels are trusted.
function normalizeOccasion(value) {
  return ({ Work: "Internship / work", "Casual outing": "Casual outings", "Formal dinner": "Formal events" })[value] || value;
}
function inferSuitability(item) {
  const style = Array.isArray(item.style)
    ? item.style
    : item.style
      ? [item.style]
      : [];
  const has = (...tags) => tags.some((tag) => style.includes(tag));
  const material = (item.material || "").toLowerCase();
  const category = item.category, colours = itemColours(item);
  const neutral = colours.length > 0 && colours.every(colour => [
    "white",
    "black",
    "beige",
    "cream",
    "grey",
    "brown",
    "navy",
  ].includes(colour.toLowerCase()));
  const relaxedFabric = /denim|jersey|fleece|sweat|rubber/.test(material);
  const knownFabric =
    /cotton|linen|silk|wool|polyester|viscose|rayon|leather|nylon/.test(
      material,
    );
  const formal = has("Formal") && !relaxedFabric;
  const polished = has("Smart casual", "Classic", "Preppy") && !relaxedFabric;
  const neatMinimal =
    has("Minimalist") &&
    neutral &&
    !relaxedFabric &&
    knownFabric &&
    (["Tops", "Bottoms", "Jackets", "Dresses", "Accessories"].includes(
      category,
    ) ||
      (category === "Shoes" && /leather/.test(material)));
  const occasions = new Set();
  if (formal || polished || neatMinimal)
    ["Presentation", "Internship / work", "Date"].forEach((o) => occasions.add(o));
  if (formal || (has("Classic") && knownFabric && !relaxedFabric))
    ["Interview", "Formal events"].forEach((o) => occasions.add(o));
  if (has("Romantic")) {
    occasions.add("Date");
    occasions.add("Casual outings");
    if (knownFabric && !relaxedFabric && ["Dresses", "Tops", "Jackets", "Accessories"].includes(category)) occasions.add("Formal events");
  }
  if (
    has(
      "Casual",
      "Streetwear",
      "Vintage",
      "Y2K",
      "Cosplay",
      "Minimalist",
      "Preppy",
    ) ||
    relaxedFabric
  )
    ["Casual outings", "University", "Date"].forEach((o) => occasions.add(o));
  const weather = new Set();
  const heavy = /wool|fleece|heavy|thermal|down/.test(material);
  if (heavy || (/leather/.test(material) && category === "Jackets"))
    weather.add("Cool");
  if (
    !heavy &&
    (/cotton|linen|silk|viscose|rayon|lightweight|nylon|polyester/.test(
      material,
    ) ||
      (category === "Shoes" && /rubber|leather|canvas/.test(material)))
  )
    weather.add("Warm");
  if (
    (category === "Shoes" && /rubber|waterproof/.test(material)) ||
    (category === "Jackets" && /nylon|waterproof/.test(material))
  )
    weather.add("Rainy");
  return { occasions: [...occasions], weather: [...weather] };
}
module.exports = { inferSuitability, normalizeOccasion, itemColours, NO_OCCASION };
