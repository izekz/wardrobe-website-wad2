const { inferSuitability } = require("../services/clothingSuitability");
const mongoose = require("mongoose");
const { listedColours } = require("../services/listedColours");
const Item = require("../models/WardrobeItem"),
  Outfit = require("../models/SavedOutfit"),
  Product = require("../models/Product");
const v = require("../services/wardrobeValidation");
const { getWeather } = require("../services/weatherService");
const {
  recommendations,
  compatiblePieces,
  completePieces,
  assessSelection,
  rankItem,
  isRecommended,
  recommendationFor,
} = require("../services/outfitMatching");
function itemJson(doc) {
  return {
    itemId: String(doc._id),
    name: doc.name,
    category: doc.category,
    colour: doc.colour,
    style: doc.style,
    material: doc.material,
    ...inferSuitability(doc),
    source: "wardrobe",
    size: doc.size || null,
    purchaseId: doc.purchaseId || null,
    imageURL: `/api/wardrobe/items/${doc._id}/image`,
    createdAt: doc.createdAt,
  };
}
function createWardrobeController(
  models = { Item, Outfit, Product },
  weatherProvider = getWeather,
) {
  const { Item, Outfit, Product } = models,
    owner = (req) => String(req.user.id);
  const id = (value) => {
    if (!mongoose.isObjectIdOrHexString(value))
      throw Object.assign(new Error("Item not found."), { status: 404 });
    return value;
  };
  async function storeProduct(productId, selectedColour) {
    if (!productId) return null;
    const doc = await Product.findOne({
      _id: id(productId),
      status: "active",
      stock: { $gt: 0 },
    });
    if (!doc)
      throw Object.assign(new Error("This store product is unavailable."), {
        status: 404,
      });
    const colours = listedColours(doc);
    if (selectedColour !== undefined && (typeof selectedColour !== "string" || !colours.includes(selectedColour)))
      throw v.badRequest("Choose a colour offered by this business.");
    // Score a chosen variant only after verifying it against the seller's listing.
    const colour = selectedColour || (colours.length === 1 ? colours[0] : "");
    return {
      productId: String(doc._id),
      name: doc.name,
      category: doc.category,
      style: [doc.style],
      material: doc.material || "",
      colour,
      availableColours: colours,
      ...inferSuitability({
        category: doc.category,
        colour,
        material: doc.material,
        style: [doc.style],
      }),
      price: doc.price,
      source: "store",
      imageURL: `/api/catalog/products/${doc._id}/image`,
    };
  }
  async function list(req, res) {
    res.json({
      items: (
        await Item.find({ userId: owner(req) }).sort({ createdAt: -1 })
      ).map(itemJson),
    });
  }
  async function get(req, res) {
    const doc = await Item.findOne({
      _id: id(req.params.id),
      userId: owner(req),
    });
    if (!doc) return res.status(404).json({ message: "Item not found." });
    res.json({ item: itemJson(doc) });
  }
  async function create(req, res) {
    const input = v.itemInput(req.body),
      doc = await Item.create({ ...input, userId: owner(req) });
    res.status(201).json({ item: itemJson(doc) });
  }
  async function update(req, res) {
    const input = v.itemInput(req.body, false);
    const doc = await Item.findOneAndUpdate(
      { _id: id(req.params.id), userId: owner(req) },
      { $set: input },
      { new: true, runValidators: true },
    );
    if (!doc) return res.status(404).json({ message: "Item not found." });
    res.json({ item: itemJson(doc) });
  }
  async function remove(req, res) {
    const doc = await Item.findOneAndDelete({
      _id: id(req.params.id),
      userId: owner(req),
    });
    if (!doc) return res.status(404).json({ message: "Item not found." });
    res.json({ message: "Clothing item deleted." });
  }
  async function image(req, res) {
    const doc = await Item.findOne({
      _id: id(req.params.id),
      userId: owner(req),
    }).select("+photo.data");
    if (!doc?.photo?.data)
      return res.status(404).json({ message: "Photo not found." });
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.type(doc.photo.contentType).send(doc.photo.data);
  }
  async function weather(req, res) {
    res.json({ weather: await weatherProvider(v.dateInput(req.query.date)) });
  }
  async function plan(req, res) {
    const date = v.dateInput(req.body?.date),
      occasion = v.occasionInput(req.body?.occasion),
      lockedIds = req.body?.lockedIds || [];
    if (
      !Array.isArray(lockedIds) ||
      lockedIds.length > 6 ||
      new Set(lockedIds).size !== lockedIds.length ||
      lockedIds.some((i) => !mongoose.isObjectIdOrHexString(i))
    )
      throw v.badRequest("Choose valid wardrobe pieces to keep.");
    const styles = req.body.style
      ? [v.choice(req.body.style, v.STYLES, "style")]
      : req.user.preferredStyles || [];
    const [items, forecast, product] = await Promise.all([
      Item.find({ userId: owner(req) }),
      weatherProvider(date),
      storeProduct(req.body.productId, req.body.productColour),
    ]);
    const wardrobe = items.map(itemJson);
    const plans = recommendations(wardrobe, {
      occasion,
      styles,
      weather: null,
      lockedIds,
      product,
    });
    for (const item of [...wardrobe, ...(product ? [product] : [])]) {
      item.recommendation = recommendationFor(item, { occasion, styles });
    }
    const recommendedIds = new Set(
      [...wardrobe, ...(product ? [product] : [])]
        .filter((item) =>
          isRecommended(item, { occasion, styles, weather: forecast }),
        )
        .map((item) => item.itemId || item.productId),
    );
    wardrobe.sort(
      (a, b) =>
        Number(recommendedIds.has(b.itemId)) -
          Number(recommendedIds.has(a.itemId)) ||
        rankItem(b, occasion, styles, null) -
          rankItem(a, occasion, styles, null) ||
        a.name.localeCompare(b.name),
    );
    res.json({
      weather: forecast,
      product,
      items: wardrobe,
      plans,
      recommendedIds: [...recommendedIds],
    });
  }
  async function selection(req, res) {
    const date = v.dateInput(req.body?.date),
      occasion = v.occasionInput(req.body?.occasion);
    const ids = req.body?.itemIds;
    if (
      !Array.isArray(ids) ||
      ids.length > 6 ||
      new Set(ids).size !== ids.length ||
      ids.some((i) => !mongoose.isObjectIdOrHexString(i))
    )
      throw v.badRequest("Choose valid outfit pieces.");
    if (!ids.length && !req.body.productId)
      return res.json({ selection: null });
    const styles = req.body.style
      ? [v.choice(req.body.style, v.STYLES, "style")]
      : req.user.preferredStyles || [];
    const [docs, product, forecast] = await Promise.all([
      Item.find({ userId: owner(req), _id: { $in: ids } }),
      storeProduct(req.body.productId, req.body.productColour),
      weatherProvider(date),
    ]);
    if (docs.length !== ids.length)
      throw v.badRequest("A selected piece is no longer in your wardrobe.");
    res.json({
      selection: assessSelection(
        [...docs.map(itemJson), ...(product ? [product] : [])],
        occasion,
        styles,
        forecast,
      ),
    });
  }

  async function outfitInput(req) {
    const name = v.text(req.body?.name, "Outfit name", 80),
      occasion = v.occasionInput(req.body?.occasion),
      eventDate = v.dateInput(req.body?.date),
      ids = req.body.itemIds;
    if (
      !Array.isArray(ids) ||
      ids.length > 6 ||
      new Set(ids).size !== ids.length ||
      ids.some((i) => !mongoose.isObjectIdOrHexString(i))
    )
      throw v.badRequest("Choose valid outfit pieces.");
    const docs = await Item.find({ userId: owner(req), _id: { $in: ids } });
    if (docs.length !== ids.length)
      throw v.badRequest(
        "A piece was removed from your wardrobe. Generate a new outfit.",
      );
    const product = await storeProduct(req.body.productId, req.body.productColour),
      pieces = [...docs.map(itemJson), ...(product ? [product] : [])];
    if (!pieces.length)
      throw v.badRequest("Use at least one piece before saving an outfit.");
    if (!compatiblePieces(pieces) || !completePieces(pieces))
      throw v.badRequest(
        "An outfit needs shoes and either a dress or a top and bottom.",
      );
    return { name, occasion, eventDate, pieces };
  }
  function savedJson(outfit, available) {
    return {
      outfitId: String(outfit._id), name: outfit.name, occasion: outfit.occasion,
      eventDate: outfit.eventDate, createdAt: outfit.createdAt,
      pieces: outfit.pieces.map(piece => ({
        itemId: piece.itemId, productId: piece.productId, name: piece.name,
        category: piece.category, colour: piece.colour, style: piece.style,
        occasions: piece.occasions, source: piece.source, price: piece.price,
        missing: piece.source === "wardrobe" && !available.has(piece.itemId),
        imageURL: piece.source === "wardrobe"
          ? available.has(piece.itemId) ? `/api/wardrobe/items/${piece.itemId}/image` : null
          : `/api/catalog/products/${piece.productId}/image`,
      })),
    };
  }
  async function save(req, res) {
    const data = await outfitInput(req);
    const outfit = await Outfit.create({ ...data, userId: owner(req) });
    res.status(201).json({ outfitId: String(outfit._id) });
  }
  async function updateSaved(req, res) {
    const filter = { _id: id(req.params.id), userId: owner(req) };
    if (!await Outfit.findOne(filter)) return res.status(404).json({ message: "Outfit not found." });
    const data = await outfitInput(req);
    const outfit = await Outfit.findOneAndUpdate(filter, { $set: data }, { new: true, runValidators: true });
    if (!outfit) return res.status(404).json({ message: "Outfit not found." });
    res.json({ outfitId: String(outfit._id) });
  }
  async function getSaved(req, res) {
    const outfit = await Outfit.findOne({ _id: id(req.params.id), userId: owner(req) });
    if (!outfit) return res.status(404).json({ message: "Outfit not found." });
    const items = await Item.find({ userId: owner(req) });
    const result = savedJson(outfit, new Set(items.map(item => String(item._id))));
    // Keep snapshots for display, but do not preselect an unavailable store variant.
    for (const piece of result.pieces.filter(piece => piece.source === "store")) {
      try { await storeProduct(piece.productId, piece.colour || undefined); }
      catch (error) {
        if (![400, 404].includes(error.status)) throw error;
        piece.missing = true;
        piece.imageURL = null;
      }
    }
    res.json({ outfit: result });
  }
  async function saved(req, res) {
    const [outfits, items] = await Promise.all([
      Outfit.find({ userId: owner(req) }).sort({ createdAt: -1 }),
      Item.find({ userId: owner(req) }),
    ]);
    const available = new Set(items.map(item => String(item._id)));
    res.json({ outfits: outfits.map(outfit => savedJson(outfit, available)) });
  }
  async function deleteSaved(req, res) {
    const doc = await Outfit.findOneAndDelete({
      _id: id(req.params.id),
      userId: owner(req),
    });
    if (!doc) return res.status(404).json({ message: "Outfit not found." });
    res.json({ message: "Outfit removed." });
  }
  return {
    list,
    get,
    create,
    update,
    remove,
    image,
    weather,
    plan,
    selection,
    save,
    saved,
    getSaved,
    updateSaved,
    deleteSaved,
  };
}
module.exports = { createWardrobeController };
