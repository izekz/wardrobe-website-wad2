const { inferSuitability } = require("../services/clothingSuitability");
const mongoose = require("mongoose");
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
  async function storeProduct(productId) {
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
    return {
      productId: String(doc._id),
      name: doc.name,
      category: doc.category,
      style: [doc.style],
      material: doc.material || "",
      ...inferSuitability({
        category: doc.category,
        colour: doc.colour,
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
      occasion = v.choice(req.body?.occasion, v.OCCASIONS, "occasion"),
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
      storeProduct(req.body.productId),
    ]);
    const wardrobe = items.map(itemJson);
    const plans = recommendations(wardrobe, {
      occasion,
      styles,
      weather: null,
      lockedIds,
      product,
    });
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
      occasion = v.choice(req.body?.occasion, v.OCCASIONS, "occasion");
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
      storeProduct(req.body.productId),
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

  async function save(req, res) {
    const name = v.text(req.body?.name, "Outfit name", 80),
      occasion = v.choice(req.body?.occasion, v.OCCASIONS, "occasion"),
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
    const product = await storeProduct(req.body.productId),
      pieces = [...docs.map(itemJson), ...(product ? [product] : [])];
    if (!pieces.length)
      throw v.badRequest("Use at least one piece before saving an outfit.");
    if (!compatiblePieces(pieces) || !completePieces(pieces))
      throw v.badRequest(
        "An outfit needs shoes and either a dress or a top and bottom.",
      );
    const outfit = await Outfit.create({
      userId: owner(req),
      name,
      occasion,
      eventDate,
      pieces,
    });
    res.status(201).json({ outfitId: String(outfit._id) });
  }
  async function saved(req, res) {
    const [outfits, items] = await Promise.all([
      Outfit.find({ userId: owner(req) }).sort({ createdAt: -1 }),
      Item.find({ userId: owner(req) }),
    ]);
    const available = new Set(items.map((i) => String(i._id)));
    res.json({
      outfits: outfits.map((o) => ({
        outfitId: String(o._id),
        name: o.name,
        occasion: o.occasion,
        eventDate: o.eventDate,
        createdAt: o.createdAt,
        pieces: o.pieces.map((p) => ({
          itemId: p.itemId,
          productId: p.productId,
          name: p.name,
          category: p.category,
          colour: p.colour,
          style: p.style,
          occasions: p.occasions,
          source: p.source,
          price: p.price,
          missing: p.source === "wardrobe" && !available.has(p.itemId),
          imageURL:
            p.source === "wardrobe"
              ? available.has(p.itemId)
                ? `/api/wardrobe/items/${p.itemId}/image`
                : null
              : `/api/catalog/products/${p.productId}/image`,
        })),
      })),
    });
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
    deleteSaved,
  };
}
module.exports = { createWardrobeController };
