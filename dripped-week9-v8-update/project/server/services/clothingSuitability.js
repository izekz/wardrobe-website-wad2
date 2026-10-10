// Explainable estimates from clothing metadata. No user-supplied occasion/weather labels are trusted.
function inferSuitability(item) {
  const style = Array.isArray(item.style)
    ? item.style
    : item.style
      ? [item.style]
      : [];
  const has = (...tags) => tags.some((tag) => style.includes(tag));
  const material = (item.material || "").toLowerCase();
  const category = item.category,
    colour = (item.colour || "").toLowerCase();
  const neutral = [
    "white",
    "black",
    "beige",
    "cream",
    "grey",
    "brown",
    "navy",
  ].includes(colour);
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
    ["Presentation", "Work", "Date"].forEach((o) => occasions.add(o));
  if (formal) ["Interview", "Formal dinner"].forEach((o) => occasions.add(o));
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
    ["Casual outing", "University", "Date"].forEach((o) => occasions.add(o));
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
module.exports = { inferSuitability };
