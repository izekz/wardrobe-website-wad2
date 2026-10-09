const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createWardrobeRouter } = require("./../routes/wardrobeRoutes");
const { requireAuth } = require("./../middleware/authentication");
const {
  recommendations,
  colourScore,
  rankItem,
} = require("./../services/outfitMatching");
const { getWeather } = require("./../services/weatherService");
const { singaporeToday } = require("./../communityValidation");
const Item = require("./../models/WardrobeItem"),
  Outfit = require("./../models/SavedOutfit"),
  Product = require("./../models/Product");
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const input = (changes = {}) => ({
  name: "Linen shirt",
  category: "Tops",
  colour: "White",
  material: "Linen",
  style: ["Minimalist"],
  occasions: ["Presentation"],
  weather: ["Warm", "Rainy"],
  photo: png,
  ...changes,
});
function memory(Model) {
  const rows = [];
  const matches = (doc, filter) =>
    Object.entries(filter).every(([key, value]) =>
      value && typeof value === "object" && !value._bsontype
        ? "$in" in value
          ? value.$in.includes(String(doc[key]))
          : "$gt" in value
            ? doc[key] > value.$gt
            : false
        : String(doc[key]) === String(value),
    );
  const query = (filter, single = false) => ({
    sort() {
      return this;
    },
    select() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve()
        .then(() => {
          const result = rows.filter((d) => matches(d, filter));
          return single ? result[0] || null : result;
        })
        .then(resolve, reject);
    },
  });
  return {
    rows,
    find: (f) => query(f),
    findOne: (f) => query(f, true),
    async create(data) {
      const doc = new Model({ ...data, createdAt: new Date() });
      await doc.validate();
      rows.push(doc);
      return doc;
    },
    async findOneAndUpdate(filter, update) {
      const doc = rows.find((d) => matches(d, filter));
      if (!doc) return null;
      doc.set(update.$set);
      await doc.validate();
      return doc;
    },
    async findOneAndDelete(filter) {
      const i = rows.findIndex((d) => matches(d, filter));
      if (i < 0) return null;
      return rows.splice(i, 1)[0];
    },
  };
}
const weather = {
  available: true,
  date: singaporeToday(),
  tags: ["Warm", "Rainy"],
  temperature: 31,
  condition: "Rain / showers",
  rainChance: 70,
  advice: [],
};
test("Private wardrobe HTTP workflows", async (t) => {
  const models = {
    Item: memory(Item),
    Outfit: memory(Outfit),
    Product: memory(Product),
  };
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use((req, res, next) => {
    if (req.get("x-test-user"))
      req.user = {
        id: req.get("x-test-user"),
        preferredStyles: ["Minimalist"],
      };
    next();
  });
  app.use(
    "/api/wardrobe",
    requireAuth,
    createWardrobeRouter(models, async () => weather),
  );
  app.use((error, req, res, next) =>
    res.status(error.status || 500).json({ message: error.message }),
  );
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/wardrobe`;
  async function api(path, method = "GET", body, user = "alice") {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(user ? { "x-test-user": user } : {}),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  let top, bottom, shoes, saved;
  await t.test("guests cannot use wardrobe or image endpoints", async () => {
    assert.equal((await api("/items", "GET", null, null)).status, 401);
    assert.equal(
      (await api("/items/507f1f77bcf86cd799439011/image", "GET", null, null))
        .status,
      401,
    );
  });
  await t.test(
    "create validates metadata/photos and ignores forged user ownership",
    async () => {
      assert.equal(
        (await api("/items", "POST", input({ style: [] }))).status,
        400,
      );
      assert.equal(
        (
          await api(
            "/items",
            "POST",
            input({ photo: "data:image/png;base64,AAAA" }),
          )
        ).status,
        400,
      );
      const result = await api("/items", "POST", input({ userId: "bob" }));
      assert.equal(result.status, 201);
      top = result.body.item;
      assert.equal(models.Item.rows[0].userId, "alice");
      assert.equal(top.photo, undefined);
      bottom = (
        await api(
          "/items",
          "POST",
          input({
            name: "Black trousers",
            category: "Bottoms",
            colour: "Black",
          }),
        )
      ).body.item;
      shoes = (
        await api(
          "/items",
          "POST",
          input({
            name: "Beige loafers",
            material: "Leather",
            category: "Shoes",
            colour: "Beige",
          }),
        )
      ).body.item;
    },
  );
  await t.test(
    "existing wardrobe records ignore legacy manual suitability labels",
    async () => {
      models.Item.rows[0].occasions = ["Interview"];
      models.Item.rows[0].weather = ["Cool"];
      const record = (await api("/items/" + top.itemId)).body.item;
      assert.ok(record.occasions.includes("Presentation"));
      assert.equal(record.occasions.includes("Interview"), false);
      assert.ok(record.weather.includes("Warm"));
      assert.equal(record.weather.includes("Cool"), false);
    },
  );
  await t.test(
    "other accounts cannot list, read, edit, delete or see photos",
    async () => {
      assert.deepEqual(
        (await api("/items", "GET", null, "bob")).body.items,
        [],
      );
      for (const method of ["GET", "PUT", "DELETE"])
        assert.equal(
          (
            await api(
              "/items/" + top.itemId,
              method,
              method === "PUT" ? input() : null,
              "bob",
            )
          ).status,
          404,
        );
      assert.equal(
        (await api("/items/" + top.itemId + "/image", "GET", null, "bob"))
          .status,
        404,
      );
      const image = await fetch(base + "/items/" + top.itemId + "/image", {
        headers: { "x-test-user": "alice" },
      });
      assert.equal(image.status, 200);
      assert.equal(image.headers.get("content-type"), "image/png");
    },
  );
  await t.test(
    "editing retains the old photo without uploading another",
    async () => {
      const details = input({ name: "Updated linen shirt" });
      delete details.photo;
      assert.equal(
        (await api("/items/" + top.itemId, "PUT", details)).body.item.name,
        "Updated linen shirt",
      );
      assert.ok(models.Item.rows[0].photo.data.length);
      assert.equal((await api("/items/not-an-id")).status, 404);
    },
  );
  await t.test(
    "recommendations preserve locks and flag missing wardrobe categories",
    async () => {
      const result = await api("/recommendations", "POST", {
        occasion: "Presentation",
        date: singaporeToday(),
        lockedIds: [top.itemId],
      });
      assert.equal(result.status, 200);
      assert.ok(result.body.plans[0].complete);
      assert.ok(
        result.body.plans.every((p) =>
          p.pieces.some((i) => i.itemId === top.itemId),
        ),
      );
      assert.equal(
        (
          await api(
            "/recommendations",
            "POST",
            { occasion: "Presentation", lockedIds: [top.itemId] },
            "bob",
          )
        ).status,
        400,
      );
      const other = await api(
        "/recommendations",
        "POST",
        { occasion: "Presentation" },
        "bob",
      );
      assert.deepEqual(other.body.plans, []);
      assert.equal(
        (
          await api("/recommendations", "POST", {
            occasion: "Presentation",
            date: "2026-02-30",
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "recommendation badges change with occasion and style instead of tagging fallback outfits",
    async () => {
      const matching = await api("/recommendations", "POST", {
        occasion: "Presentation",
        style: "Minimalist",
      });
      assert.deepEqual(
        [...matching.body.recommendedIds].sort(),
        [top.itemId, bottom.itemId, shoes.itemId].sort(),
      );
      const otherOccasion = await api("/recommendations", "POST", {
        occasion: "Interview",
        style: "Minimalist",
      });
      assert.deepEqual(
        [...otherOccasion.body.recommendedIds].sort(),
        [top.itemId, bottom.itemId, shoes.itemId].sort(),
      );
      assert.equal(otherOccasion.body.items.length, 3);
      const otherStyle = await api("/recommendations", "POST", {
        occasion: "Presentation",
        style: "Formal",
      });
      assert.deepEqual(
        [...otherStyle.body.recommendedIds].sort(),
        [top.itemId, bottom.itemId, shoes.itemId].sort(),
      );
      const neither = await api("/recommendations", "POST", {
        occasion: "Interview",
        style: "Formal",
      });
      assert.deepEqual(neither.body.recommendedIds, []);
    },
  );
  await t.test(
    "recommendations never become selections without an explicit choice",
    async () => {
      const suggested = await api("/recommendations", "POST", {
        occasion: "Presentation",
      });
      assert.equal(suggested.status, 200);
      assert.equal(suggested.body.items.length, 3);
      assert.ok(suggested.body.plans[0].complete);
      const empty = await api("/selection", "POST", {
        occasion: "Presentation",
        itemIds: [],
        pieces: suggested.body.plans[0].pieces,
      });
      assert.equal(empty.status, 200);
      assert.equal(empty.body.selection, null);
      const partial = await api("/selection", "POST", {
        occasion: "Presentation",
        itemIds: [top.itemId],
      });
      assert.equal(partial.status, 200);
      assert.deepEqual(
        partial.body.selection.pieces.map((p) => p.itemId),
        [top.itemId],
      );
      assert.equal(partial.body.selection.complete, false);
      assert.equal(partial.body.selection.matchScore, 91);
      assert.equal(partial.body.selection.scoreDetails.penalty, 0);
      assert.deepEqual(partial.body.selection.basics, {
        selected: 1,
        total: 3,
        percent: 33,
      });
      const full = await api("/selection", "POST", {
        occasion: "Presentation",
        itemIds: [top.itemId, bottom.itemId, shoes.itemId],
      });
      assert.equal(full.body.selection.complete, true);
      assert.equal(full.body.selection.matchScore, 93);
      assert.deepEqual(full.body.selection.basics, {
        selected: 3,
        total: 3,
        percent: 100,
      });
      assert.deepEqual(full.body.selection.gaps, []);
      assert.equal(
        (
          await api(
            "/selection",
            "POST",
            { occasion: "Presentation", itemIds: [top.itemId] },
            "bob",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await api(
            "/selection",
            "POST",
            { occasion: "Presentation", itemIds: [top.itemId] },
            null,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await api("/selection", "POST", {
            occasion: "Presentation",
            itemIds: [],
          })
        ).body.selection,
        null,
      );
      const emptySave = await api("/outfits", "POST", {
        name: "No choices",
        occasion: "Presentation",
        itemIds: [],
      });
      assert.equal(emptySave.status, 400);
      assert.match(emptySave.body.message, /Use at least one piece/);
    },
  );
  await t.test(
    "store products come from the database, not browser metadata",
    async () => {
      const product = await models.Product.create({
        businessId: "shop",
        businessName: "Shop",
        name: "Minimalist blazer",
        category: "Jackets",
        style: "Minimalist",
        occasions: ["Presentation"],
        price: 38,
        stock: 2,
        description: "Light layer",
        photo: {
          data: Buffer.from(png.split(",")[1], "base64"),
          contentType: "image/png",
        },
      });
      const result = await api("/recommendations", "POST", {
        occasion: "Presentation",
        productId: String(product._id),
        product: { name: "Spoofed", price: 0 },
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.product.price, 38);
      assert.ok(result.body.plans[0].pieces.some((p) => p.source === "store"));
      assert.ok(
        result.body.plans[0].reasons.some((r) => r.includes("no colour tag")),
      );
      product.stock = 0;
      assert.equal(
        (
          await api("/recommendations", "POST", {
            occasion: "Presentation",
            productId: String(product._id),
          })
        ).status,
        404,
      );
    },
  );
  await t.test(
    "save checks ownership, lists privately and marks deleted pieces",
    async () => {
      assert.equal(
        (
          await api(
            "/outfits",
            "POST",
            { name: "Forged", occasion: "Presentation", itemIds: [top.itemId] },
            "bob",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await api("/outfits", "POST", {
            name: "Incomplete",
            occasion: "Presentation",
            itemIds: [top.itemId],
          })
        ).status,
        400,
      );
      const result = await api("/outfits", "POST", {
        name: "Presentation ready",
        occasion: "Presentation",
        itemIds: [top.itemId, bottom.itemId, shoes.itemId],
      });
      assert.equal(result.status, 201);
      saved = result.body.outfitId;
      assert.deepEqual(
        models.Outfit.rows
          .at(-1)
          .pieces.map((p) => p.itemId)
          .sort(),
        [top.itemId, bottom.itemId, shoes.itemId].sort(),
      );
      assert.equal(
        (await api("/outfits", "GET", null, "bob")).body.outfits.length,
        0,
      );
      assert.equal(
        (await api("/outfits/" + saved, "DELETE", null, "bob")).status,
        404,
      );
      assert.equal((await api("/items/" + top.itemId, "DELETE")).status, 200);
      const outfit = (await api("/outfits")).body.outfits[0];
      assert.equal(
        outfit.pieces.find((p) => p.itemId === top.itemId).missing,
        true,
      );
      assert.equal((await api("/outfits/" + saved, "DELETE")).status, 200);
      assert.equal((await api("/outfits")).body.outfits.length, 0);
    },
  );
});
test("matching rules keep a coherent silhouette and favour suitable clothes", () => {
  const piece = (id, category, changes = {}) => ({
    itemId: id,
    name: id,
    category,
    colour: "White",
    style: ["Minimalist"],
    occasions: ["Presentation"],
    material: "Linen",
    weather: ["Warm", "Rainy"],
    ...changes,
  });
  const items = [
    piece("top", "Tops"),
    piece("heavy", "Tops", { material: "Heavy wool", weather: ["Cool"] }),
    piece("bottom", "Bottoms"),
    piece("shoe", "Shoes"),
    piece("dress", "Dresses"),
  ];
  assert.ok(
    rankItem(items[0], "Presentation", ["Minimalist"], weather) >
      rankItem(items[1], "Presentation", ["Minimalist"], weather),
  );
  const plans = recommendations(items, { occasion: "Presentation", weather });
  assert.ok(plans.length);
  assert.ok(
    plans.every(
      (p) =>
        !(
          p.pieces.some((i) => i.category === "Dresses") &&
          p.pieces.some((i) => i.category === "Tops")
        ),
    ),
  );
  assert.throws(
    () =>
      recommendations(items, {
        occasion: "Presentation",
        lockedIds: ["top", "dress"],
      }),
    /dress replaces/,
  );
  const partial = recommendations([items[0]], { occasion: "Presentation" });
  assert.equal(partial[0].complete, false);
  assert.ok(partial[0].gaps.includes("Shoes"));
  assert.equal(colourScore("White", "Black"), 3);
  assert.equal(colourScore(undefined, "Blue"), 0);
});
test("weather handles Singapore dates, API failure and out-of-range forecasts honestly", async () => {
  const today = singaporeToday();
  let requested;
  const forecast = await getWeather(today, async (url) => {
    requested = url;
    return {
      ok: true,
      json: async () => ({
        daily: {
          time: [today],
          temperature_2m_max: [31],
          weather_code: [95],
          precipitation_probability_max: [80],
        },
      }),
    };
  });
  assert.deepEqual(forecast.tags, ["Warm", "Rainy"]);
  assert.equal(requested.searchParams.get("timezone"), "Asia/Singapore");
  assert.equal(forecast.condition, "Thunderstorms");
  assert.equal(
    (
      await getWeather(today, async () => {
        throw new Error("Offline");
      })
    ).available,
    false,
  );
  assert.equal(
    (
      await getWeather("2099-12-31", async () => {
        throw new Error("Should not fetch");
      })
    ).available,
    false,
  );
});

test("normalised match ratings explain strong, weak, partial and unavailable-data outfits", () => {
  const { matchRating } = require("../services/outfitMatching");
  const pieces = ["Tops", "Bottoms", "Shoes"].map((category, i) => ({
    category,
    colour: ["White", "Black", "Beige"][i],
    style: ["Minimalist"],
    occasions: ["Presentation"],
    weather: ["Warm", "Rainy"],
    material: "Cotton",
  }));
  const strong = matchRating(pieces, "Presentation", ["Minimalist"], weather);
  assert.equal(strong.matchScore, 100);
  assert.equal(strong.scoreDetails.availableWeight, 100);
  assert.equal(
    strong.scoreDetails.components.reduce((sum, c) => sum + c.earned, 0),
    100,
  );
  const weak = matchRating(
    pieces.map((p) => ({
      ...p,
      occasions: ["Casual outing"],
      style: ["Streetwear"],
      weather: ["Cool"],
    })),
    "Presentation",
    ["Formal"],
    weather,
  );
  assert.equal(weak.matchScore, 20);
  const unavailable = matchRating(pieces, "Presentation", ["Minimalist"], {
    available: false,
  });
  assert.equal(unavailable.matchScore, 100);
  assert.equal(unavailable.scoreDetails.availableWeight, 85);
  assert.equal(
    unavailable.scoreDetails.components.find((c) => c.label === "Weather")
      .available,
    false,
  );
  const partial = matchRating(
    [pieces[0]],
    "Presentation",
    ["Minimalist"],
    weather,
    ["Bottoms", "Shoes"],
  );
  assert.equal(partial.matchScore, 60);
  assert.equal(partial.scoreDetails.penalty, 40);
  for (const result of [strong, weak, unavailable, partial])
    assert.ok(result.matchScore >= 0 && result.matchScore <= 100);
});

test("recommendation badges match occasion OR style regardless of weather", () => {
  const { isRecommended } = require("../services/outfitMatching");
  const item = {
    category: "Tops",
    colour: "White",
    occasions: ["Presentation"],
    style: ["Minimalist"],
    weather: ["Warm", "Rainy"],
    material: "Linen",
  };
  const context = { occasion: "Presentation", styles: ["Minimalist"], weather };
  assert.equal(isRecommended(item, context), true);
  assert.equal(isRecommended(item, { ...context, occasion: "Date" }), true);
  assert.equal(isRecommended(item, { ...context, styles: ["Formal"] }), true);
  assert.equal(
    isRecommended(item, {
      ...context,
      occasion: "Interview",
      styles: ["Formal"],
    }),
    false,
  );
  assert.equal(
    isRecommended(item, { ...context, occasion: "Interview", styles: [] }),
    false,
  );
  assert.equal(isRecommended({ ...item, weather: ["Warm"] }, context), true);
  assert.equal(
    isRecommended({ ...item, material: "Heavy wool" }, context),
    true,
  );
  assert.equal(isRecommended({ ...item, weather: undefined }, context), true);
  assert.equal(
    isRecommended(item, { ...context, weather: { available: false } }),
    true,
  );
  assert.equal(isRecommended(item, { ...context, styles: [] }), true);
});

test("suitability is inferred from metadata and client labels are ignored", () => {
  const { inferSuitability } = require("../services/clothingSuitability");
  const { itemInput } = require("../services/wardrobeValidation");
  const neutral = {
    category: "Tops",
    colour: "White",
    style: ["Minimalist"],
    material: "Linen",
  };
  const inferred = inferSuitability(neutral);
  assert.ok(inferred.occasions.includes("Presentation"));
  assert.ok(inferred.weather.includes("Warm"));
  assert.equal(inferred.weather.includes("Rainy"), false);
  assert.equal(
    inferSuitability({ ...neutral, colour: "Multicolour" }).occasions.includes(
      "Presentation",
    ),
    false,
  );
  assert.equal(
    inferSuitability({ ...neutral, style: ["Streetwear"] }).occasions.includes(
      "Interview",
    ),
    false,
  );
  const formal = inferSuitability({
    ...neutral,
    style: ["Formal"],
    material: "Wool",
  });
  assert.ok(formal.occasions.includes("Interview"));
  assert.ok(formal.weather.includes("Cool"));
  assert.equal(
    inferSuitability({
      ...neutral,
      style: ["Formal"],
      material: "Denim",
    }).occasions.includes("Interview"),
    false,
  );
  assert.ok(
    inferSuitability({
      category: "Shoes",
      colour: "Black",
      material: "Rubber",
      style: ["Casual"],
    }).weather.includes("Rainy"),
  );
  assert.deepEqual(
    inferSuitability({ ...neutral, material: "Unknown fabric" }).weather,
    [],
  );
  const submitted = input({ occasions: ["Interview"], weather: ["Cool"] });
  const parsed = itemInput(submitted);
  assert.deepEqual(parsed.occasions, inferred.occasions);
  assert.deepEqual(parsed.weather, inferred.weather);
  delete submitted.occasions;
  delete submitted.weather;
  assert.doesNotThrow(() => itemInput(submitted));
});

test("basic-piece completion is independent of match quality and accessories are optional", () => {
  const { assessSelection } = require("../services/outfitMatching");
  const piece = (category) => ({
    category,
    colour: "Black",
    material: "Cotton",
    style: ["Casual"],
  });
  const empty = assessSelection([], "Presentation", [], weather);
  assert.equal(empty, null);
  const top = assessSelection([piece("Tops")], "Presentation", [], weather);
  assert.equal(top.basics.selected, 1);
  assert.equal(top.basics.total, 3);
  assert.deepEqual(top.gaps, ["Bottoms", "Shoes"]);
  const complete = assessSelection(
    ["Tops", "Bottoms", "Shoes"].map(piece),
    "Presentation",
    [],
    weather,
  );
  assert.equal(complete.basics.percent, 100);
  assert.deepEqual(complete.gaps, []);
  assert.equal(complete.complete, true);
  assert.equal(
    complete.reasons[0],
    "0 of 3 selected pieces are tagged for presentation.",
  );
  assert.ok(complete.reasons.some((r) => r.startsWith("Some selected pieces")));
  assert.equal(
    complete.reasons.some(
      (r) => r.startsWith("Neutral") || r.startsWith("Weather suitability"),
    ),
    false,
  );
  const accessory = assessSelection(
    [...["Tops", "Bottoms", "Shoes"].map(piece), piece("Accessories")],
    "Presentation",
    [],
    weather,
  );
  assert.equal(accessory.basics.total, 3);
  assert.equal(accessory.basics.percent, 100);
  const dress = assessSelection(
    [piece("Dresses"), piece("Shoes")],
    "Date",
    [],
    weather,
  );
  assert.deepEqual(dress.basics, { selected: 2, total: 2, percent: 100 });
  assert.equal(dress.complete, true);
});
