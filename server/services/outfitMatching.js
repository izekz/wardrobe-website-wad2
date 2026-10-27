const { badRequest } = require("./wardrobeValidation");
const neutrals = new Set(["white", "black", "beige", "cream", "grey", "brown", "navy"]);
const pairs = new Set(["blue:pink", "green:pink", "pink:purple", "blue:yellow", "green:yellow", "purple:yellow"]);
const array = (value) => Array.isArray(value) ? value : value ? [value] : [];
const lower = (value) => String(value || "").trim().toLowerCase();
// Each property contributes independently. Preferences never change these occasion rules.
const profiles = {
  Presentation: { styles: [18, 9, 30, 27, 24, 24, 3, 15, 3, 3], polished: true, tip: "smart-casual or classic pieces in white, navy, black or beige" },
  Interview: { styles: [9, 3, 30, 24, 27, 21, 0, 12, 0, 0], polished: true, tip: "formal or classic pieces in neutral colours" },
  Work: { styles: [21, 12, 27, 30, 24, 24, 3, 15, 3, 0], polished: true, tip: "smart-casual pieces in neutral colours" },
  "Formal dinner": { styles: [12, 3, 30, 21, 27, 15, 0, 21, 3, 0], polished: true, tip: "formal or classic pieces in black, navy or cream" },
  Date: { styles: [24, 24, 24, 30, 27, 21, 18, 24, 21, 9], polished: false, tip: "smart-casual or classic pieces with one accent colour" },
  "Casual outing": { styles: [24, 30, 12, 21, 21, 24, 30, 24, 27, 12], polished: false, tip: "casual or streetwear pieces with one neutral colour" },
  University: { styles: [27, 30, 12, 24, 21, 30, 27, 21, 24, 9], polished: false, tip: "casual, preppy or minimalist pieces" },
};
const styleNames = ["minimalist", "casual", "formal", "smart casual", "classic", "preppy", "streetwear", "vintage", "y2k", "cosplay"];
const colourNames = new Set([...neutrals, "blue", "pink", "purple", "green", "red", "yellow", "orange", "multicolour"]);
function materialKind(material) {
  const text = lower(material);
  if (/waterproof|water-resistant|rubber|nylon/.test(text)) return "rain";
  if (/fleece|sweat|heavy/.test(text)) return "heavy";
  if (/denim|jersey/.test(text)) return "relaxed";
  if (/cotton|linen/.test(text)) return "light";
  if (/wool|silk|leather|polyester|viscose|rayon|structured|tailored/.test(text)) return "polished";
  return null;
}
function occasionRating(item, occasion) {
  const profile = profiles[occasion];
  if (!profile) throw badRequest("Choose a valid occasion.");
  const indices = array(item.style).map(s => styleNames.indexOf(lower(s))).filter(i => i >= 0);
  const category = item.category;
  const categoryPoints = profile.polished
    ? { Jackets: 15, Tops: 10, Bottoms: 10, Dresses: 10, Shoes: 8, Accessories: 4 }
    : { Jackets: 10, Tops: 15, Bottoms: 15, Dresses: 15, Shoes: 12, Accessories: 8 };
  const colour = lower(item.colour), knownColour = colourNames.has(colour);
  const kind = materialKind(item.material);
  const components = [
    { label: "Style", weight: 30, available: indices.length > 0, earned: indices.length ? Math.max(...indices.map(i => profile.styles[i])) : 0 },
    { label: "Category", weight: 15, available: category in categoryPoints, earned: categoryPoints[category] || 0 },
    { label: "Colour", weight: 10, available: knownColour, earned: !knownColour ? 0 : neutrals.has(colour) ? 10 : colour === "multicolour" ? 2 : profile.polished ? ["pink", "purple"].includes(colour) ? 7 : 3 : 8 },
    { label: "Material", weight: 5, available: !!kind, earned: !kind ? 0 : profile.polished ? { polished: 5, light: 4, relaxed: 2, heavy: 1, rain: 2 }[kind] : { polished: 4, light: 5, relaxed: 5, heavy: 3, rain: 4 }[kind] },
  ];
  return { name: item.name || "This piece", itemId: item.itemId || item.productId, earned: components.reduce((n, c) => n + c.earned, 0), weight: 60, components, enoughData: components.every(c => c.available) };
}
function recommendationFor(item, { occasion, styles = [] }) {
  const earned = occasionRating(item, occasion).earned;
  const styleMatch = array(item.style).some(s => styles.some(preference => lower(preference) === lower(s)));
  const occasionMatch = earned >= 36;
  return { kind: occasionMatch ? "occasion" : styleMatch ? "style" : null, label: occasionMatch ? `Recommended for ${occasion}` : styleMatch ? "Matches your style" : "", occasionScore: earned, styleMatch, priority: occasionMatch ? styleMatch ? 3 : 2 : styleMatch ? 1 : 0 };
}
function isRecommended(item, context) { return recommendationFor(item, context).kind === "occasion"; }
function rankItem(item, occasion, styles = []) {
  const result = recommendationFor(item, { occasion, styles });
  return result.priority * 100 + result.occasionScore;
}
function colourScore(a, b) {
  a = lower(a); b = lower(b);
  if (!colourNames.has(a) || !colourNames.has(b) || a === "multicolour" || b === "multicolour") return 0;
  if (neutrals.has(a) || neutrals.has(b)) return 3;
  if (a === b || pairs.has([a, b].sort().join(":"))) return 2;
  return 0.6;
}
function weatherRating(item, weather) {
  if (!weather?.available || item.category === "Accessories" || !materialKind(item.material)) return null;
  const material = lower(item.material), tags = array(weather.tags);
  const warm = tags.includes("Warm") || Number.isFinite(weather.temperature) && weather.temperature >= 26;
  const cool = !warm && (tags.includes("Cool") || Number.isFinite(weather.temperature));
  const checks = [];
  if (warm || cool) {
    let ratio;
    if (warm) ratio = /fleece|heavy|wool/.test(material) ? 0 : /cotton|linen|silk|viscose|rayon/.test(material) ? 1 : 0.5;
    else ratio = /wool|fleece|heavy/.test(material) ? 1 : /cotton|linen/.test(material) ? 0.5 : 1;
    if (item.category === "Shoes" && !/heavy|winter|fleece/.test(material)) ratio = 1;
    checks.push({ label: "Temperature", weight: ["Shoes", "Jackets"].includes(item.category) ? 5 : 15, ratio });
  }
  if (["Shoes", "Jackets"].includes(item.category) && (tags.includes("Rainy") || Number.isFinite(weather.rainChance) || weather.condition)) {
    const rainy = tags.includes("Rainy") || Number.isFinite(weather.rainChance) && weather.rainChance >= 50;
    const ratio = !rainy ? 1 : /waterproof|water-resistant|rubber/.test(material) ? 1 : /leather|nylon/.test(material) ? 0.5 : 0;
    checks.push({ label: "Rain", weight: 10, ratio });
  }
  if (!checks.length) return null;
  const weight = checks.reduce((n, c) => n + c.weight, 0);
  return { name: item.name, checks, ratio: checks.reduce((n, c) => n + c.weight * c.ratio, 0) / weight };
}
function compatiblePieces(pieces) {
  const counts = {};
  for (const p of pieces) counts[p.category] = (counts[p.category] || 0) + 1;
  return !Object.values(counts).some(n => n > 1) && !(counts.Dresses && (counts.Tops || counts.Bottoms));
}
function matchRating(pieces, occasion, styles, weather) {
  if (!pieces.length) return { matchScore: null, scoreDetails: { components: [], availableWeight: 0, penalty: 0 } };
  const itemDetails = pieces.map(p => occasionRating(p, occasion));
  let colourTotal = 0, colourPairs = 0;
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const points = colourScore(pieces[i].colour, pieces[j].colour);
    if (points > 0) { colourPairs++; colourTotal += points / 3; }
  }
  const weatherDetails = pieces.map(p => weatherRating(p, weather)).filter(Boolean);
  const components = [
    { label: "Occasion", weight: 60, available: true, earned: itemDetails.reduce((n, i) => n + i.earned, 0) / pieces.length },
    { label: "Colour coordination", weight: 25, available: colourPairs > 0, earned: colourPairs ? 25 * colourTotal / colourPairs : 0 },
    { label: "Weather", weight: 15, available: weatherDetails.length > 0, earned: weatherDetails.length ? 15 * weatherDetails.reduce((n, i) => n + i.ratio, 0) / weatherDetails.length : 0 },
  ];
  const availableWeight = components.filter(c => c.available).reduce((n, c) => n + c.weight, 0);
  const earned = components.reduce((n, c) => n + c.earned, 0);
  const rawScore = Math.round(earned / availableWeight * 100);
  return { matchScore: Math.max(5, Math.min(100, rawScore)), scoreDetails: { components, itemDetails, weatherDetails, availableWeight, earned, penalty: 0, minimumApplied: rawScore < 5, provisional: pieces.length === 1 } };
}
function recommendations(
  items,
  { occasion, styles = [], weather, lockedIds = [], product = null },
) {
  const locks = items.filter((i) => lockedIds.includes(i.itemId));
  if (locks.length !== lockedIds.length)
    throw badRequest(
      "One of your locked pieces is no longer in your wardrobe.",
    );
  const fixed = [...locks, ...(product ? [product] : [])];
  if (!compatiblePieces(fixed))
    throw badRequest(
      "Keep one piece per category. A dress replaces a top and bottom.",
    );
  const candidates = items.filter((i) => !lockedIds.includes(i.itemId)),
    plans = [];
  for (const base of [
    ["Tops", "Bottoms", "Shoes"],
    ["Dresses", "Shoes"],
  ]) {
    if (fixed.some((p) => p.category === "Dresses") && base.includes("Tops"))
      continue;
    if (
      fixed.some((p) => ["Tops", "Bottoms"].includes(p.category)) &&
      base.includes("Dresses")
    )
      continue;
    let groups = [fixed];
    const gaps = [];
    for (const category of base) {
      if (fixed.some((p) => p.category === category)) continue;
      const options = candidates
        .filter((i) => i.category === category)
        .sort(
          (a, b) =>
            rankItem(b, occasion, styles, weather) -
              rankItem(a, occasion, styles, weather) ||
            a.name.localeCompare(b.name),
        )
        .slice(0, 5);
      if (!options.length) {
        gaps.push(category);
        continue;
      }
      groups = groups.flatMap((g) => options.map((i) => [...g, i]));
    }
    // Add optional layers/accessories only when their tags suit the selected context.
    for (const category of ["Jackets", "Accessories"]) {
      if (fixed.some((p) => p.category === category)) continue;
      const options = candidates
        .filter(
          (p) =>
            p.category === category &&
            isRecommended(p, { occasion, styles }),
        )
        .sort(
          (a, b) =>
            rankItem(b, occasion, styles, weather) -
            rankItem(a, occasion, styles, weather),
        )
        .slice(0, 2);
      groups = groups.flatMap((g) => [g, ...options.map((p) => [...g, p])]);
    }
    for (const pieces of groups) {
      if (!pieces.length) continue;
      let score =
          pieces.reduce(
            (sum, p) => sum + rankItem(p, occasion, styles, weather),
            0,
          ) -
          gaps.length * 20,
        colour = 0,
        style = 0;
      for (let i = 0; i < pieces.length; i++)
        for (let j = i + 1; j < pieces.length; j++) {
          colour += colourScore(pieces[i].colour, pieces[j].colour);
          if (
            array(pieces[i].style).some((s) =>
              array(pieces[j].style).includes(s),
            )
          )
            style += 2;
        }
      score += colour + style;
      const reasons = product && !product.colour
        ? ["This store product has no colour tag, so its colour compatibility is not scored."] : [];
      plans.push({
        pieces,
        gaps,
        score,
        reasons,
        complete: gaps.length === 0,
        ...matchRating(pieces, occasion, styles, null),
      });
    }
  }
  const seen = new Set();
  return plans
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        b.score - a.score ||
        b.matchScore - a.matchScore,
    )
    .filter((p) => {
      const key = p.pieces
        .map((i) => i.itemId || "product:" + i.productId)
        .sort()
        .join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}
function assessSelection(pieces, occasion, styles, weather) {
  if (!pieces.length) return null;
  if (!compatiblePieces(pieces)) throw badRequest("Choose one piece per category. A dress replaces a top and bottom.");
  const categories = new Set(pieces.map(p => p.category));
  const required = categories.has("Dresses") ? ["Dresses", "Shoes"] : ["Tops", "Bottoms", "Shoes"];
  const gaps = required.filter(c => !categories.has(c));
  const rating = matchRating(pieces, occasion, styles, weather);
  const comments = [];
  for (const item of rating.scoreDetails.itemDetails) {
    if (item.enoughData && item.earned < 24) {
      comments.push({ kind: "warning", text: `${item.name} is not suitable for ${occasion.toLowerCase()}.` });
      comments.push({ kind: "suggestion", text: `Try ${profiles[occasion].tip}.` });
    } else if (item.components.some(c => !c.available)) {
      const missing = item.components.filter(c => !c.available).map(c => c.label.toLowerCase());
      comments.push({ kind: "suggestion", text: `Try adding ${missing.join(" and ")} details for ${item.name}.` });
    } else if (item.earned < 36) {
      comments.push({ kind: "suggestion", text: `Try ${profiles[occasion].tip}.` });
    }
  }
  const colour = rating.scoreDetails.components.find(c => c.label === "Colour coordination");
  if (colour.available && colour.earned < colour.weight * 0.5)
    comments.push({ kind: "suggestion", text: "Try white, black, beige or navy to balance bright colours." });
  const uniqueComments = comments.filter((c, i) => comments.findIndex(other => other.text === c.text) === i);
  return { pieces, gaps, complete: gaps.length === 0, comments: uniqueComments, reasons: [], suggestions: [], basics: { selected: required.length - gaps.length, total: required.length, percent: Math.round((required.length - gaps.length) / required.length * 100) }, ...rating };
}
function completePieces(pieces) {
  const categories = new Set(pieces.map(p => p.category));
  return categories.has("Shoes") && (categories.has("Dresses") || categories.has("Tops") && categories.has("Bottoms"));
}
module.exports = { recommendations, compatiblePieces, completePieces, colourScore, rankItem, matchRating, assessSelection, isRecommended, occasionRating, recommendationFor, weatherRating };
