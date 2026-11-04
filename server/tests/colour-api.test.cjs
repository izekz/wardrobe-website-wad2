const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createColourService } = require("../services/colourService");
const { colourScore, matchRating, assessSelection, recommendationFor } = require("../services/outfitMatching");
const { createWardrobeRouter } = require("../routes/wardrobeRoutes");
const { memoryModel } = require("./helpers/memoryModels");
const apiPalette = (url, hexes = ["2967A8", "895A28"]) => ({ ok: true, json: async () => ({ mode: url.searchParams.get("mode"), colors: hexes.map(clean => ({ hex: { clean } })) }) });
const weather = { available: true, temperature: 31, rainChance: 0, tags: ["Warm"] };
const pieces = [
  { itemId: "top", name: "Blue shirt", category: "Tops", colour: "Blue", material: "Linen", style: ["Minimalist"] },
  { itemId: "bottom", name: "Orange trousers", category: "Bottoms", colour: "Orange", material: "Linen", style: ["Minimalist"] },
];

test("palette lookups are bounded, symmetric, cached and shared across concurrent callers", async () => {
  const urls = []; let clock = 0;
  const service = createColourService({ now: () => clock, cacheMs: 100, fetcher: async url => {
    urls.push(url); await new Promise(resolve => setTimeout(resolve, 5)); return apiPalette(url);
  } });
  assert.deepEqual(await service(["White", "Black", "Multicolour", "Unknown", "Blue"]), {});
  assert.equal(urls.length, 0);
  const [first, second] = await Promise.all([service(["Blue", "Orange", "Blue"]), service(["Orange", " blue "])]);
  assert.deepEqual(first, second);
  assert.equal(first["blue:orange"].matches, true);
  assert.equal(first["blue:orange"].available, true);
  assert.equal(urls.length, 2);
  for (const url of urls) {
    assert.equal(url.origin + url.pathname, "https://www.thecolorapi.com/scheme");
    assert.deepEqual([...url.searchParams.keys()].sort(), ["count", "hex", "mode"]);
    assert.equal(url.searchParams.get("hex"), "2967A8");
    assert.equal(url.searchParams.get("count"), "5");
  }
  await service(["Orange", "Blue"]); assert.equal(urls.length, 2);
  clock = 101; await service(["Blue", "Orange"]); assert.equal(urls.length, 4);
});

test("unavailable and malformed palettes fall back with a retry backoff", async () => {
  for (const failure of ["offline", "http", "json", "missing", "bad-hex", "wrong-mode", "too-many"]) {
    let calls = 0, clock = 0, broken = true;
    const service = createColourService({ now: () => clock, failureMs: 50, fetcher: async url => {
      calls++;
      if (!broken) return apiPalette(url);
      if (failure === "offline") throw new Error("Offline");
      if (failure === "http") return { ok: false };
      if (failure === "json") return { ok: true, json: async () => { throw new Error("Bad JSON"); } };
      if (failure === "missing") return { ok: true, json: async () => ({}) };
      const data = await apiPalette(url).json();
      if (failure === "bad-hex") data.colors[0].hex.clean = "javascript:bad";
      if (failure === "wrong-mode") data.mode = "quad";
      if (failure === "too-many") data.colors = Array(50).fill(data.colors[0]);
      return { ok: true, json: async () => data };
    } });
    const offline = await service(["Blue", "Orange"]);
    assert.equal(offline["blue:orange"].available, false, failure);
    assert.equal(colourScore("Blue", "Orange", offline), 0.6);
    await service(["Blue", "Orange"]); assert.equal(calls, 2);
    clock = 51; broken = false;
    assert.equal((await service(["Blue", "Orange"]))["blue:orange"].matches, true);
    assert.equal(calls, 4);
  }
});

test("timeouts cover stalled fetches and response bodies without blocking the planner", async () => {
  for (const bodyStalls of [false, true]) {
    let aborted = 0;
    const service = createColourService({ timeoutMs: 20, fetcher: (url, { signal }) => {
      signal.addEventListener("abort", () => aborted++);
      return bodyStalls ? Promise.resolve({ ok: true, json: () => new Promise(() => {}) }) : new Promise(() => {});
    } });
    const start = Date.now(), result = await service(["Blue", "Orange"]);
    assert.equal(result["blue:orange"].available, false);
    assert.equal(aborted, 2);
    assert.ok(Date.now() - start < 1000);
  }
});

test("palette harmony uses nearby hues, rejects grey swatches and supports partial API outages", async () => {
  const hues = createColourService({ fetcher: async url => apiPalette(url, url.searchParams.get("mode") === "complement" ? ["2967A8", "956029"] : ["2967A8", "202020"]) });
  const nearby = await hues(["Blue", "Orange"]);
  assert.deepEqual(nearby["blue:orange"].modes, ["complement"]);
  assert.equal(colourScore("Blue", "Orange", nearby), 2);
  const grey = createColourService({ fetcher: async url => apiPalette(url, ["FFFFFF", "777777"]) });
  assert.equal((await grey(["Blue", "Orange"]))["blue:orange"].matches, false);
  const noMatch = createColourService({ fetcher: async url => apiPalette(url, ["2967A8", "2C704F"]) });
  assert.equal(colourScore("Blue", "Orange", await noMatch(["Blue", "Orange"])), 0.6);
  const partial = createColourService({ fetcher: async url => {
    if (url.searchParams.get("mode") === "analogic") throw new Error("Temporarily unavailable");
    return apiPalette(url);
  } });
  assert.equal((await partial(["Blue", "Orange"]))["blue:orange"].matches, true);
});

test("only the 25-point colour coordination check gains API matches", async () => {
  const service = createColourService({ fetcher: async url => apiPalette(url) });
  const matches = await service(["Blue", "Orange"]);
  const local = matchRating(pieces, "Presentation", [], weather);
  const enriched = matchRating(pieces, "Presentation", [], weather, matches);
  assert.equal(local.scoreDetails.components[1].earned, 5);
  assert.ok(Math.abs(enriched.scoreDetails.components[1].earned - 25 * 2 / 3) < 1e-10);
  assert.deepEqual(enriched.scoreDetails.components.map(c => c.weight), [60, 25, 15]);
  assert.deepEqual(enriched.scoreDetails.components[0], local.scoreDetails.components[0]);
  assert.deepEqual(enriched.scoreDetails.components[2], local.scoreDetails.components[2]);
  assert.deepEqual(enriched.scoreDetails.itemDetails, local.scoreDetails.itemDetails);
  assert.deepEqual(enriched.scoreDetails.weatherDetails, local.scoreDetails.weatherDetails);
  assert.equal(enriched.scoreDetails.colourDetails[0].explanation, "Palette harmony (complementary / analogous)");
  assert.equal(colourScore("White", "Orange", matches), 3);
  assert.equal(colourScore("Black", "Blue", matches), 3);
  assert.equal(colourScore("Blue", "Blue", matches), 2);
  assert.equal(colourScore("Blue", "Yellow", matches), 2); // Existing pairs remain compatible.
  assert.equal(colourScore("Unknown", "Blue", matches), 0);
  assert.equal(colourScore("Multicolour", "Blue", matches), 0);
  assert.equal(matchRating([pieces[0]], "Presentation", [], weather, matches).scoreDetails.components[1].available, false);
  assert.deepEqual(matchRating(pieces, "Presentation", [], weather, {}), local);
  const withNeutral = matchRating([...pieces, { ...pieces[0], name: "Black shoes", category: "Shoes", colour: "Black" }], "Presentation", [], weather, matches);
  assert.ok(Math.abs(withNeutral.scoreDetails.components[1].earned - 25 * (2 / 3 + 1 + 1) / 3) < 1e-10);
  assert.equal(assessSelection(pieces, "Presentation", [], weather, matches).complete, false);
  assert.deepEqual(recommendationFor(pieces[0], { occasion: "Presentation", styles: [] }), recommendationFor(pieces[0], { occasion: "Presentation", styles: [], colourMatches: matches }));
});

test("selection API applies palettes only to trusted, owned pieces and the chosen store colour", async t => {
  const models = Object.fromEntries(["Item", "Outfit", "Product"].map((name, index) => [name, memoryModel(require(`../models/${["WardrobeItem", "SavedOutfit", "Product"][index]}`))]));
  const photo = { data: Buffer.from("test"), contentType: "image/png" };
  const top = await models.Item.create({ userId: "alice", ...pieces[0], photo });
  const bottom = await models.Item.create({ userId: "alice", ...pieces[1], photo });
  const shoes = await models.Item.create({ userId: "alice", name: "Black shoes", category: "Shoes", colour: "Black", material: "Leather", style: ["Classic"], photo });
  const store = await models.Product.create({ businessId: "shop", businessName: "Shop", name: "Store trousers", category: "Bottoms", colours: ["Orange", "White"], style: "Minimalist", material: "Linen", price: 30, stock: 3, sizes: ["M"], occasions: [], description: "Test", photo });
  let lookups = 0;
  const paletteService = createColourService({ fetcher: async url => apiPalette(url) });
  const provider = async colours => { lookups++; return paletteService(colours); };
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { if (req.get("x-test-user")) req.user = { id: req.get("x-test-user"), role: "consumer", preferredStyles: ["Minimalist"] }; next(); });
  app.use("/api/wardrobe", createWardrobeRouter(models, async () => weather, provider));
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function api(path, body, user = "alice") {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/wardrobe${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": user } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  const body = { occasion: "Presentation", itemIds: [String(top._id), String(bottom._id)] };
  assert.equal((await api("/selection", body, null)).status, 401);
  assert.equal((await api("/selection", body, "bob")).status, 400);
  assert.equal(lookups, 0);
  const result = await api("/selection", { ...body, colourMatches: { "blue:orange": { points: 3 } } });
  assert.equal(result.status, 200);
  assert.equal(result.body.selection.scoreDetails.colourDetails[0].points, 2);
  assert.equal(result.body.selection.scoreDetails.components[1].weight, 25);
  const variant = await api("/selection", { occasion: "Presentation", itemIds: [String(top._id)], productId: String(store._id), productColour: "Orange", product: { colour: "White" } });
  assert.equal(variant.status, 200);
  assert.deepEqual(variant.body.selection.scoreDetails.colourDetails[0].colours, ["Blue", "Orange"]);
  assert.equal(variant.body.selection.scoreDetails.colourDetails[0].points, 2);
  const neutral = await api("/selection", { occasion: "Presentation", itemIds: [String(top._id)], productId: String(store._id), productColour: "White" });
  assert.equal(neutral.body.selection.scoreDetails.colourDetails[0].points, 3);
  const before = lookups;
  assert.equal((await api("/selection", { occasion: "Presentation", itemIds: [String(top._id)], productId: String(store._id), productColour: "Red" })).status, 400);
  assert.equal(lookups, before);
  const planned = await api("/recommendations", { occasion: "Presentation" });
  assert.equal(planned.status, 200); assert.equal(lookups, before); // Badges/order do not depend on palettes.
  const saved = await api("/outfits", { occasion: "Presentation", name: "My outfit", itemIds: [String(top._id), String(bottom._id), String(shoes._id)] });
  assert.equal(saved.status, 201); assert.equal(models.Outfit.rows.length, 1); assert.equal(lookups, before);
});

test("a failing colour provider still returns a usable selection", async t => {
  const models = Object.fromEntries(["Item", "Outfit", "Product"].map((name, index) => [name, memoryModel(require(`../models/${["WardrobeItem", "SavedOutfit", "Product"][index]}`))]));
  const top = await models.Item.create({ userId: "alice", ...pieces[0], photo: { data: Buffer.from("test"), contentType: "image/png" } });
  const bottom = await models.Item.create({ userId: "alice", ...pieces[1], photo: { data: Buffer.from("test"), contentType: "image/png" } });
  const app = express(); app.use(express.json()); app.use((req, res, next) => { req.user = { id: "alice", preferredStyles: [] }; next(); });
  app.use("/wardrobe", createWardrobeRouter(models, async () => weather, async () => { throw new Error("Offline"); }));
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/wardrobe/selection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occasion: "Presentation", itemIds: [String(top._id), String(bottom._id)] }) });
  assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.selection.scoreDetails.components[1].earned, 5);
});
