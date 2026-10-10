const { inferSuitability } = require("./clothingSuitability");
const { badRequest } = require("./wardrobeValidation");
const neutrals = new Set([
  "white",
  "black",
  "beige",
  "cream",
  "grey",
  "brown",
  "navy",
]);
const pairs = new Set([
  "blue:pink",
  "green:pink",
  "pink:purple",
  "blue:yellow",
  "green:yellow",
  "purple:yellow",
]);
const array = (value) => (Array.isArray(value) ? value : value ? [value] : []);
function colourScore(a, b) {
  if (!a || !b || a === "Multicolour" || b === "Multicolour") return 0;
  a = a.toLowerCase();
  b = b.toLowerCase();
  return neutrals.has(a) || neutrals.has(b)
    ? 3
    : a === b
      ? 2
      : pairs.has([a, b].sort().join(":"))
        ? 2
        : -1;
}
function rankItem(item, occasion, styles, weather) {
  let score = array(item.occasions).includes(occasion) ? 6 : 0;
  if (array(item.style).some((s) => styles.includes(s))) score += 3;
  if (weather?.available) {
    for (const tag of weather.tags)
      score += array(item.weather).includes(tag) ? 3 : -2;
    if (
      weather.tags.includes("Warm") &&
      /wool|fleece|heavy/i.test(item.material || "")
    )
      score -= 5;
  }
  return score;
}
function compatiblePieces(pieces) {
  const counts = {};
  for (const p of pieces) counts[p.category] = (counts[p.category] || 0) + 1;
  return (
    !Object.values(counts).some((n) => n > 1) &&
    !(counts.Dresses && (counts.Tops || counts.Bottoms))
  );
}
function matchRating(pieces, occasion, styles, weather, gaps = []) {
  const count = pieces.length || 1;
  let colourTotal = 0,
    colourPairs = 0,
    sharedStyles = 0,
    pairCount = 0;
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      pairCount++;
      if (
        array(pieces[i].style).some((tag) =>
          array(pieces[j].style).includes(tag),
        )
      )
        sharedStyles++;
      if (
        pieces[i].colour &&
        pieces[j].colour &&
        pieces[i].colour !== "Multicolour" &&
        pieces[j].colour !== "Multicolour"
      ) {
        colourPairs++;
        colourTotal +=
          Math.max(0, colourScore(pieces[i].colour, pieces[j].colour)) / 3;
      }
    }
  const components = [
    {
      label: "Occasion",
      weight: 40,
      available: true,
      ratio:
        pieces.filter((p) => array(p.occasions).includes(occasion)).length /
        count,
    },
    {
      label: "Style",
      weight: 25,
      available: styles.length > 0 || pairCount > 0,
      ratio: styles.length
        ? pieces.filter((p) =>
            array(p.style).some((tag) => styles.includes(tag)),
          ).length / count
        : pairCount
          ? sharedStyles / pairCount
          : 0,
    },
    {
      label: "Colour",
      weight: 20,
      available: colourPairs > 0,
      ratio: colourPairs ? colourTotal / colourPairs : 0,
    },
    {
      label: "Weather",
      weight: 15,
      available: !!weather?.available && weather.tags.length > 0,
      ratio:
        weather?.available && weather.tags.length
          ? pieces.reduce((sum, p) => {
              const tagged =
                weather.tags.filter((tag) => array(p.weather).includes(tag))
                  .length / weather.tags.length;
              const heavy =
                weather.tags.includes("Warm") &&
                /wool|fleece|heavy/i.test(p.material || "");
              return sum + Math.max(0, tagged - (heavy ? 0.5 : 0));
            }, 0) / count
          : 0,
    },
  ].map((c) => ({
    label: c.label,
    weight: c.weight,
    available: c.available,
    earned: c.available ? c.weight * c.ratio : 0,
  }));
  const availableWeight = components
    .filter((c) => c.available)
    .reduce((sum, c) => sum + c.weight, 0);
  const points = components.reduce((sum, c) => sum + c.earned, 0),
    penalty = gaps.length * 20;
  return {
    matchScore: Math.round(
      Math.max(
        0,
        Math.min(
          100,
          availableWeight ? (points / availableWeight) * 100 - penalty : 0,
        ),
      ),
    ),
    scoreDetails: { components, availableWeight, penalty },
  };
}

function isRecommended(item, { occasion, styles = [] }) {
  const occasionMatch = inferSuitability(item).occasions.includes(occasion);
  const styleMatch =
    styles.length > 0 && array(item.style).some((tag) => styles.includes(tag));
  return occasionMatch || styleMatch;
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
            rankItem(p, occasion, styles, weather) > 0 &&
            !(
              category === "Jackets" &&
              weather?.tags.includes("Warm") &&
              /wool|fleece|heavy/i.test(p.material || "")
            ),
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
      const reasons = [];
      if (colour > 0)
        reasons.push(
          "Neutral or complementary colours help these pieces work together.",
        );
      if (style > 0) reasons.push("The pieces share style tags.");
      const occasionCount = pieces.filter((p) =>
        array(p.occasions).includes(occasion),
      ).length;
      reasons.push(
        `${occasionCount} of ${pieces.length} pieces are tagged for ${occasion.toLowerCase()}.`,
      );
      if (occasionCount < pieces.length)
        reasons.push(
          "Some pieces are not tagged for this occasion. Check suitability before wearing.",
        );
      if (weather?.available) {
        const suitable = pieces.filter((p) =>
          weather.tags.every((tag) => array(p.weather).includes(tag)),
        ).length;
        reasons.push(
          `${suitable} of ${pieces.length} pieces have all the forecast weather tags.`,
        );
        if (suitable < pieces.length)
          reasons.push("Weather suitability is not confirmed for every piece.");
      }
      if (product && !product.colour)
        reasons.push(
          "This store product has no colour tag, so its colour compatibility is not scored.",
        );
      plans.push({
        pieces,
        gaps,
        score,
        reasons,
        complete: gaps.length === 0,
        ...matchRating(pieces, occasion, styles, weather, gaps),
      });
    }
  }
  const seen = new Set();
  return plans
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        b.matchScore - a.matchScore ||
        b.score - a.score,
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
  if (!compatiblePieces(pieces))
    throw badRequest(
      "Choose one piece per category. A dress replaces a top and bottom.",
    );
  pieces = pieces.map((piece) => ({ ...piece, ...inferSuitability(piece) }));
  const categories = new Set(pieces.map((p) => p.category));
  const required = categories.has("Dresses")
    ? ["Dresses", "Shoes"]
    : ["Tops", "Bottoms", "Shoes"];
  const gaps = required.filter((category) => !categories.has(category));
  const tagged = pieces.filter((p) => p.occasions.includes(occasion)).length;
  const reasons = [
    `${tagged} of ${pieces.length} selected pieces are tagged for ${occasion.toLowerCase()}.`,
  ];
  if (tagged < pieces.length)
    reasons.push(
      "Some selected pieces are not tagged for this occasion. Check suitability before wearing.",
    );
  const occasionTips = {
    Presentation:
      "Try smart-casual or classic pieces in white, navy, black or beige.",
    Interview:
      "Choose formal pieces in neutral colours; avoid denim and fleece.",
    Date: "Try casual or classic styles with one soft or accent colour.",
    "Casual outing": "Try casual or streetwear pieces with one neutral colour.",
    "Formal dinner":
      "Choose formal styles with black, navy or another coordinated colour.",
    Work: "Try smart-casual styles with neutral colours.",
    University: "Try casual, preppy or minimalist pieces for an everyday look.",
  };
  const suggestions = [occasionTips[occasion]].filter(Boolean);
  if (
    styles.length &&
    pieces.some((p) => !array(p.style).some((tag) => styles.includes(tag)))
  )
    suggestions.push(
      `Look for ${styles.slice(0, 2).join(" or ").toLowerCase()} pieces to match your style filter.`,
    );
  else {
    const colour = matchRating(
      pieces,
      occasion,
      styles,
      weather,
    ).scoreDetails.components.find((c) => c.label === "Colour");
    if (colour.available && colour.earned < colour.weight * 0.5)
      suggestions.push("Pair a bright piece with white, black, beige or navy.");
  }
  return {
    pieces,
    gaps,
    complete: gaps.length === 0,
    reasons,
    suggestions,
    basics: {
      selected: required.length - gaps.length,
      total: required.length,
      percent: Math.round(
        ((required.length - gaps.length) / required.length) * 100,
      ),
    },
    ...matchRating(pieces, occasion, styles, weather),
  };
}

function completePieces(pieces) {
  const categories = new Set(pieces.map((p) => p.category));
  return (
    categories.has("Shoes") &&
    (categories.has("Dresses") ||
      (categories.has("Tops") && categories.has("Bottoms")))
  );
}
module.exports = {
  recommendations,
  compatiblePieces,
  completePieces,
  colourScore,
  rankItem,
  matchRating,
  assessSelection,
  isRecommended,
};
