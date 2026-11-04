const { badRequest } = require("./wardrobeValidation");
const neutrals = new Set(["white", "black", "beige", "cream", "grey", "brown", "navy"]);
const pairs = new Set(["blue:pink", "green:pink", "pink:purple", "blue:yellow", "green:yellow", "purple:yellow"]);
const array = (value) => Array.isArray(value) ? value : value ? [value] : [];
const lower = (value) => String(value || "").trim().toLowerCase();
// Each property contributes independently. Preferences never change these occasion rules.
const { normalizeOccasion, itemColours, NO_OCCASION } = require("./clothingSuitability");
// Points correspond to styleNames below. Style lookup values use a 30-point scale, converted to 40 occasion points.
const profiles = {
  University: { styles: [27, 27, 21, 24, 30, 21, 18], polished: false, tip: "preppy, minimalist or streetwear pieces" },
  Presentation: { styles: [18, 3, 15, 3, 24, 24, 12], polished: true, tip: "classic or preppy pieces in white, navy, black or beige" },
  Interview: { styles: [9, 0, 12, 0, 21, 27, 6], polished: true, tip: "classic or preppy pieces in neutral colours" },
  Date: { styles: [24, 18, 24, 21, 21, 27, 30], polished: false, tip: "romantic or classic pieces with one accent colour" },
  "Internship / work": { styles: [21, 3, 15, 3, 24, 24, 12], polished: true, tip: "classic or preppy pieces in neutral colours" },
  "Casual outings": { styles: [24, 30, 24, 27, 24, 21, 24], polished: false, tip: "streetwear or minimalist pieces with one neutral colour" },
  "Formal events": { styles: [12, 0, 21, 3, 15, 27, 27], polished: true, tip: "classic or romantic pieces in black, navy or cream" },
};
const styleNames = ["minimalist", "streetwear", "vintage", "y2k", "preppy", "classic", "romantic"];
// Read-only compatibility for existing wardrobe items and old store listings.
// Retired styles are not offered by the wardrobe form or planner filters.
const legacyStyles = ["casual", "formal", "smart casual", "cosplay"];
const legacyStylePoints = {
  University: [30, 12, 24, 9], Presentation: [9, 30, 27, 3], Interview: [3, 30, 24, 0],
  Date: [24, 24, 30, 9], "Internship / work": [12, 27, 30, 0],
  "Casual outings": [30, 12, 21, 12], "Formal events": [3, 30, 21, 0],
};
const colourNames = new Set([...neutrals, "blue", "pink", "purple", "green", "red", "yellow", "orange", "multicolour"]);
function materialProvided(material) {
  const text = lower(material);
  return !!text && !["unknown", "unknown fabric", "unknown material", "not specified", "unspecified", "n/a", "none", "-"].includes(text);
}
function materialKind(material) {
  const text = lower(material);
  if (/waterproof|water-resistant|rubber|nylon/.test(text)) return "rain";
  if (/fleece|sweat|heavy/.test(text)) return "heavy";
  if (/denim|jersey/.test(text)) return "relaxed";
  if (/cotton|linen/.test(text)) return "light";
  if (/wool|silk|leather|polyester|viscose|rayon|structured|tailored/.test(text)) return "polished";
  if (/\bplastics?\b/.test(text)) return "synthetic";
  return null;
}
function occasionRating(item, occasion) {
  occasion = normalizeOccasion(occasion);
  const profile = profiles[occasion];
  if (!profile) throw badRequest("Choose a valid occasion.");
  const stylePoints = array(item.style).map(style => {
    const key = lower(style), index = styleNames.indexOf(key);
    if (index >= 0) return profile.styles[index];
    const legacyIndex = legacyStyles.indexOf(key);
    return legacyIndex >= 0 ? legacyStylePoints[occasion][legacyIndex] : null;
  }).filter(points => points !== null);
  const colours = itemColours(item), kind = materialKind(item.material);
  const colourPoints = colours.map(colour => {
    const value = lower(colour);
    return neutrals.has(value) ? 10 : profile.polished ? ["pink", "purple"].includes(value) ? 7 : 3 : 8;
  });
  const components = [
    { label: "Style", weight: 40, available: stylePoints.length > 0, earned: stylePoints.length ? Math.max(...stylePoints) * 4 / 3 : 0 },
    { label: "Colour", weight: 10, available: colours.length > 0, earned: colourPoints.length ? colourPoints.reduce((n, p) => n + p, 0) / colourPoints.length : 0 },
    { label: "Material", weight: 10, available: !!kind, provided: materialProvided(item.material), earned: !kind ? 0 : profile.polished ? { polished: 10, light: 8, relaxed: 4, heavy: 2, rain: 4, synthetic: 4 }[kind] : { polished: 8, light: 10, relaxed: 10, heavy: 6, rain: 8, synthetic: 8 }[kind] },
  ];
  return { name: item.name || "This piece", itemId: item.itemId || item.productId, earned: components.reduce((n, c) => n + c.earned, 0), weight: 60, components, enoughData: components.every(c => c.available) };
}
function recommendationFor(item, { occasion, styles = [] }) {
  occasion = normalizeOccasion(occasion);
  const earned = occasion === NO_OCCASION ? 0 : occasionRating(item, occasion).earned;
  const styleMatch = array(item.style).some(s => styles.some(preference => lower(preference) === lower(s)));
  const occasionMatch = occasion !== NO_OCCASION && earned >= 36;
  return { kind: occasionMatch ? "occasion" : styleMatch ? "style" : null, label: occasionMatch ? `Recommended for ${occasion}` : styleMatch ? "Matches your style" : "", occasionScore: earned, styleMatch, priority: occasionMatch ? styleMatch ? 3 : 2 : styleMatch ? 1 : 0 };
}

function isRecommended(item, context) { return recommendationFor(item, context).kind === "occasion"; }
function rankItem(item, occasion, styles = []) {
  const result = recommendationFor(item, { occasion, styles });
  return result.priority * 100 + result.occasionScore;
}
function colourPair(a, b, colourMatches) {
  a = lower(a); b = lower(b);
  if (!colourNames.has(a) || !colourNames.has(b) || a === "multicolour" || b === "multicolour")
    return { points: 0, explanation: "Colour not assessed" };
  if (neutrals.has(a) || neutrals.has(b)) return { points: 3, explanation: "Neutral-colour rule" };
  if (a === b) return { points: 2, explanation: "Same colour" };
  const key = [a, b].sort().join(":"), palette = colourMatches?.[key];
  if (pairs.has(key)) return { points: 2, explanation: "Existing compatible-colour rule" };
  if (palette?.available && palette.matches) return {
    points: 2,
    explanation: `Palette harmony (${palette.modes.map(mode => mode === "complement" ? "complementary" : "analogous").join(" / ")})`,
  };
  return { points: 0.6, explanation: palette?.available ? "No palette harmony found" : "Local colour rules (palette unavailable)" };
}
function colourScore(a, b, colourMatches) { return colourPair(a, b, colourMatches).points; }
// A pair of garments has equal weight, regardless of how many colours either contains.
// All cross-garment colour combinations contribute, so a neutral cannot hide an accent.
function garmentColourPair(a, b, colourMatches) {
  const coloursA = itemColours(a), coloursB = itemColours(b), comparisons = [];
  for (const first of coloursA) for (const second of coloursB)
    comparisons.push({ colours: [first, second], ...colourPair(first, second, colourMatches) });
  const known = comparisons.filter(pair => pair.points > 0);
  return {
    colours: [coloursA.join(" / ") || "Unknown", coloursB.join(" / ") || "Unknown"],
    names: [a.name, b.name], comparisons,
    points: known.length ? known.reduce((n, pair) => n + pair.points, 0) / known.length : 0,
    explanation: known.length === 1 ? known[0].explanation : known.length ? `Average of ${known.length} colour combinations` : "Colour not assessed",
  };
}
const relatedStyles = new Set([
  "classic:minimalist", "minimalist:preppy", "classic:preppy", "classic:vintage",
  "classic:romantic", "preppy:vintage", "romantic:vintage", "streetwear:vintage",
  "streetwear:y2k", "vintage:y2k", "romantic:y2k",
]);
function stylingTags(item) {
  const aliases = { formal: "classic", "smart casual": "preppy", casual: "streetwear" };
  return [...new Set(array(item.style).map(lower).map(style => aliases[style] || style).filter(style => styleNames.includes(style)))];
}
function stylePair(a, b) {
  const first = stylingTags(a), second = stylingTags(b);
  if (!first.length || !second.length) return null;
  let ratio = 0.3, explanation = "Contrasting styles";
  for (const x of first) for (const y of second) {
    if (x === y) { ratio = 1; explanation = "Shared style"; }
    else if (ratio < 0.7 && relatedStyles.has([x, y].sort().join(":"))) { ratio = 0.7; explanation = "Related styles"; }
  }
  return { names: [a.name, b.name], styles: [first, second], ratio, explanation };
}
function weatherRating(item, weather) {
  const kind = materialKind(item.material);
  if (!weather?.available || !kind || kind === "synthetic") return null;
  const material = lower(item.material), tags = array(weather.tags);
  const warm = tags.includes("Warm") || Number.isFinite(weather.temperature) && weather.temperature >= 26;
  const cool = !warm && (tags.includes("Cool") || Number.isFinite(weather.temperature));
  const checks = [];
  if (warm || cool) {
    const ratio = warm ? /fleece|heavy|wool/.test(material) ? 0 : /cotton|linen|silk|viscose|rayon/.test(material) ? 1 : 0.5
      : /wool|fleece|heavy/.test(material) ? 1 : /cotton|linen/.test(material) ? 0.5 : 1;
    checks.push({ label: "Temperature", weight: 10, ratio });
  }
  if (tags.includes("Rainy") || Number.isFinite(weather.rainChance)) {
    const rainy = tags.includes("Rainy") || weather.rainChance >= 50;
    const ratio = !rainy ? 1 : /waterproof|water-resistant|rubber/.test(material) ? 1 : /leather|nylon/.test(material) ? 0.5 : 0;
    checks.push({ label: "Rain", weight: 5, ratio });
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
function matchRating(pieces, occasion, styles, weather, colourMatches) {
  const freeStyling = normalizeOccasion(occasion) === NO_OCCASION;
  const mode = freeStyling ? "styling" : "occasion";
  if (!pieces.length) return { matchScore: null, scoreDetails: { mode, components: [], availableWeight: 0, penalty: 0 } };
  const itemDetails = freeStyling ? [] : pieces.map(p => occasionRating(p, occasion));
  const colourDetails = [], styleDetails = [];
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const pair = garmentColourPair(pieces[i], pieces[j], colourMatches);
    if (pair.points > 0) colourDetails.push(pair);
    const cohesion = freeStyling && stylePair(pieces[i], pieces[j]);
    if (cohesion) styleDetails.push(cohesion);
  }
  const colourWeight = freeStyling ? 50 : 25;
  const colour = { label: "Colour coordination", weight: colourWeight, available: colourDetails.length > 0, earned: colourDetails.length ? colourWeight * colourDetails.reduce((n, pair) => n + pair.points / 3, 0) / colourDetails.length : 0 };
  const weatherDetails = freeStyling ? [] : pieces.map(p => weatherRating(p, weather)).filter(Boolean);
  const components = freeStyling ? [
    colour,
    { label: "Style harmony", weight: 50, available: styleDetails.length > 0, earned: styleDetails.length ? 50 * styleDetails.reduce((n, pair) => n + pair.ratio, 0) / styleDetails.length : 0 },
  ] : [
    { label: "Occasion", weight: 60, available: true, earned: itemDetails.reduce((n, i) => n + i.earned, 0) / pieces.length },
    colour,
    { label: "Weather", weight: 15, available: weatherDetails.length > 0, earned: weatherDetails.length ? 15 * weatherDetails.reduce((n, i) => n + i.ratio, 0) / weatherDetails.length : 0 },
  ];
  const availableWeight = components.filter(c => c.available).reduce((n, c) => n + c.weight, 0);
  const earned = components.reduce((n, c) => n + c.earned, 0);
  const rawScore = availableWeight ? Math.round(earned / availableWeight * 100) : 0;
  return { matchScore: Math.max(5, Math.min(100, rawScore)), scoreDetails: { mode, components, itemDetails, colourDetails, styleDetails, weatherDetails, availableWeight, earned, penalty: 0, minimumApplied: rawScore < 5, provisional: pieces.length === 1 || !availableWeight || freeStyling && (colourDetails.length < pieces.length * (pieces.length - 1) / 2 || styleDetails.length < pieces.length * (pieces.length - 1) / 2) } };
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
          colour += garmentColourPair(pieces[i], pieces[j]).points;
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
function assessSelection(pieces, occasion, styles, weather, colourMatches) {
  occasion = normalizeOccasion(occasion);
  if (!pieces.length) return null;
  if (!compatiblePieces(pieces)) throw badRequest("Choose one piece per category. A dress replaces a top and bottom.");
  const categories = new Set(pieces.map(p => p.category));
  const required = categories.has("Dresses") ? ["Dresses", "Shoes"] : ["Tops", "Bottoms", "Shoes"];
  const gaps = required.filter(c => !categories.has(c));
  const rating = matchRating(pieces, occasion, styles, weather, colourMatches);
  const comments = [];
  if (occasion === NO_OCCASION) {
    if (pieces.length < 2) comments.push({ kind: 'suggestion', text: 'Choose another piece to compare colour and style. This score is provisional.' });
    if (pieces.length > 1 && rating.scoreDetails.styleDetails.some(pair => pair.ratio < 0.7)) comments.push({ kind: 'suggestion', text: 'Try pieces with a shared or related style for a more cohesive look.' });
    for (const piece of pieces) {
      if (!itemColours(piece).length) comments.push({ kind: 'suggestion', text: `Choose specific colours for ${piece.name} to assess colour coordination.` });
      if (!stylingTags(piece).length) comments.push({ kind: 'suggestion', text: `Choose a current style tag for ${piece.name} to assess style harmony.` });
    }
  }
  for (const item of rating.scoreDetails.itemDetails) {
    if (item.enoughData && item.earned < 24) {
      comments.push({ kind: "warning", text: `${item.name} is not suitable for ${occasion.toLowerCase()}.` });
      comments.push({ kind: "suggestion", text: `Try ${profiles[occasion].tip}.` });
    } else if (item.components.some(c => !c.available)) {
      const missing = item.components.filter(c => !c.available && !c.provided).map(c => c.label.toLowerCase());
      if (missing.length) comments.push({ kind: "suggestion", text: `Try adding ${missing.join(" and ")} details for ${item.name}.` });
      if (item.components.some(c => c.label === "Material" && !c.available && c.provided))
        comments.push({ kind: "suggestion", text: `The material for ${item.name} is saved, but its suitability is not assessed yet.` });
    } else if (item.earned < 36) {
      comments.push({ kind: "suggestion", text: `Try ${profiles[occasion].tip}.` });
    }
  }
  const colour = rating.scoreDetails.components.find(c => c.label === "Colour coordination");
  if (colour?.available && colour.earned < colour.weight * 0.5)
    comments.push({ kind: "suggestion", text: "Try white, black, beige or navy to balance bright colours." });
  const uniqueComments = comments.filter((c, i) => comments.findIndex(other => other.text === c.text) === i);
  return { pieces, gaps, complete: gaps.length === 0, comments: uniqueComments, reasons: [], suggestions: [], basics: { selected: required.length - gaps.length, total: required.length, percent: Math.round((required.length - gaps.length) / required.length * 100) }, ...rating };
}
function completePieces(pieces) {
  const categories = new Set(pieces.map(p => p.category));
  return categories.has("Shoes") && (categories.has("Dresses") || categories.has("Tops") && categories.has("Bottoms"));
}
module.exports = { recommendations, compatiblePieces, completePieces, colourScore, rankItem, matchRating, assessSelection, isRecommended, occasionRating, recommendationFor, weatherRating, stylePair, garmentColourPair, NO_OCCASION };
