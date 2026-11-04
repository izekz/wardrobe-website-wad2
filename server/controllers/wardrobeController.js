const { inferSuitability, itemColours } = require("../services/clothingSuitability");
const mongoose = require("mongoose");
const UserModel = require("../models/User");
const { stockForSize } = require("../services/sizeStock");
const { listedColours } = require("../services/listedColours");
const Item = require("../models/WardrobeItem"),
  Outfit = require("../models/SavedOutfit"),
  Product = require("../models/Product");
const v = require("../services/wardrobeValidation");
const { getWeather } = require("../services/weatherService");
const { getColourMatches } = require("../services/colourService");
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
    colours: itemColours(doc),
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
  models = { Item, Outfit, Product, User: UserModel },
  weatherProvider = getWeather,
  colourProvider = getColourMatches,
) {
  const { Item, Outfit, Product, User } = models,
    owner = (req) => String(req.user.id);
  const id = (value) => {
    if (!mongoose.isObjectIdOrHexString(value))
      throw Object.assign(new Error("Item not found."), { status: 404 });
    return value;
  };
  const productKey = piece => `${piece.productId}:${piece.colour || ''}:${piece.size || ''}`;
  function productJson(doc, colour = '', size = '') {
    return {
      productId: String(doc._id), name: doc.name, category: doc.category,
      businessId: String(doc.businessId), businessName: doc.businessName, description: doc.description || '',
      style: [doc.style], material: doc.material || '', colour, colours: itemColours({ colour }), size,
      availableColours: listedColours(doc), price: doc.price, source: 'store',
      ...inferSuitability({ category: doc.category, colour, material: doc.material, style: [doc.style] }),
      imageURL: `/api/catalog/products/${doc._id}/image`,
    };
  }
  async function storeProduct(productId, selectedColour, selectedSize, requireVariant = false) {
    if (!productId) return null;
    const doc = await Product.findOne({ _id: id(productId), status: 'active', stock: { $gt: 0 } });
    if (!doc) throw Object.assign(new Error('This store product is unavailable.'), { status: 404 });
    const colours = listedColours(doc), sizes = doc.sizes || [];
    if (selectedColour !== undefined && (typeof selectedColour !== 'string' || selectedColour && !colours.includes(selectedColour)))
      throw v.badRequest('Choose a colour offered by this business.');
    if (requireVariant && colours.length && !colours.includes(selectedColour)) throw v.badRequest('Choose a colour first.');
    if (selectedSize !== undefined && (typeof selectedSize !== 'string' || selectedSize && !sizes.includes(selectedSize)))
      throw v.badRequest('Choose a size offered by this business.');
    if (requireVariant && sizes.length && !sizes.includes(selectedSize)) throw v.badRequest('Choose a size first.');
    if (selectedSize && stockForSize(doc, selectedSize) < 1) throw v.badRequest('This size is no longer available.');
    return productJson(doc, selectedColour || (colours.length === 1 ? colours[0] : ''), selectedSize || '');
  }
  function productRefs(body, limit = 6) {
    if (body.products === undefined) return body.productId ? [{ productId: body.productId, colour: body.productColour, size: body.productSize, legacy: true }] : [];
    if (body.productId || !Array.isArray(body.products) || body.products.length > limit)
      throw v.badRequest('Choose valid store products.');
    const refs = body.products.map(piece => {
      if (!piece || typeof piece !== 'object' || !mongoose.isObjectIdOrHexString(piece.productId) ||
        piece.colour !== undefined && (typeof piece.colour !== 'string' || piece.colour.length > 20) ||
        piece.size !== undefined && (typeof piece.size !== 'string' || piece.size.length > 20)) throw v.badRequest('Choose valid store products.');
      return { productId: String(piece.productId), colour: piece.colour, size: piece.size };
    });
    if (new Set(refs.map(productKey)).size !== refs.length) throw v.badRequest('Choose each product option only once.');
    return refs;
  }
  async function resolveProducts(body, tolerant = false) {
    const refs = productRefs(body, tolerant ? 40 : 6), products = [], unavailableProducts = [];
    for (const ref of refs) {
      try { products.push(await storeProduct(ref.productId, ref.colour, ref.size)); }
      catch (error) {
        if (!tolerant || ref.legacy || ![400, 404].includes(error.status)) throw error;
        unavailableProducts.push({ ...ref, key: productKey(ref), name: 'Unavailable product', missing: true, message: error.message });
      }
    }
    return { products, unavailableProducts };
  }
  function plannerOwner(req) {
    if (req.user.role !== 'consumer') throw Object.assign(new Error('Only customer accounts can plan store products.'), { status: 403 });
    if (req.get('X-Planner-User') && req.get('X-Planner-User') !== owner(req))
      throw Object.assign(new Error('Your signed-in account changed. Refresh and try again.'), { status: 409, code: 'ACCOUNT_CHANGED' });
    return { _id: owner(req), role: 'consumer', suspended: { $ne: true } };
  }
  async function plannerJson(user) {
    const refs = (user.plannerProducts || []).map(piece => ({ productId: String(piece.productId), colour: piece.colour || '', size: piece.size || '' }));
    const docs = refs.length ? await Product.find({ _id: { $in: refs.map(piece => piece.productId) } }) : [];
    return { userId: String(user._id), products: refs.map(ref => {
      const doc = docs.find(doc => String(doc._id) === ref.productId);
      const available = !!doc && doc.status === 'active' && stockForSize(doc, ref.size) > 0 &&
        (!listedColours(doc).length ? !ref.colour : listedColours(doc).includes(ref.colour)) &&
        (!doc.sizes.length ? !ref.size : doc.sizes.includes(ref.size));
      return { ...(doc ? productJson(doc, ref.colour, ref.size) : { ...ref, name: 'Unavailable product', source: 'store', imageURL: null }), key: productKey(ref), available, missing: !available };
    }) };
  }
  async function plannerProducts(req, res) {
    const user = await User.findOne(plannerOwner(req)).select('+plannerProducts');
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    res.json(await plannerJson(user));
  }
  async function addPlannerProduct(req, res) {
    const filter = plannerOwner(req), ref = productRefs({ products: [req.body] })[0];
    const piece = await storeProduct(ref.productId, ref.colour, ref.size, true);
    const entry = { productId: piece.productId, colour: piece.colour, size: piece.size };
    const user = await User.findOne(filter).select('+plannerProducts');
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    if ((user.plannerProducts || []).some(piece => productKey(piece) === productKey(entry))) return res.json(await plannerJson(user));
    const updated = await User.findOneAndUpdate({ ...filter, 'plannerProducts.29': { $exists: false } },
      { $addToSet: { plannerProducts: entry } }, { new: true, runValidators: true, projection: { plannerProducts: 1 } });
    if (!updated) throw v.badRequest('Your planner can hold up to 30 store products. Remove one before adding another.');
    res.json(await plannerJson(updated));
  }
  async function removePlannerProduct(req, res) {
    const filter = plannerOwner(req), user = await User.findOne(filter).select('+plannerProducts');
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    const ref = (user.plannerProducts || []).find(piece => productKey(piece) === req.params.key);
    if (!ref) return res.json(await plannerJson(user));
    const updated = await User.findOneAndUpdate(filter, { $pull: { plannerProducts: { productId: ref.productId, colour: ref.colour, size: ref.size } } },
      { new: true, runValidators: true, projection: { plannerProducts: 1 } });
    if (!updated) return res.status(404).json({ message: 'Account not found.' });
    res.json(await plannerJson(updated));
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
    const [items, forecast, store] = await Promise.all([
      Item.find({ userId: owner(req) }),
      weatherProvider(date),
      resolveProducts(req.body, true),
    ]);
    const wardrobe = items.map(itemJson);
    const product = req.body.products === undefined ? store.products[0] || null : null;
    const plans = recommendations(wardrobe, {
      occasion,
      styles,
      weather: null,
      lockedIds,
      product,
    });
    for (const item of [...wardrobe, ...store.products]) {
      item.recommendation = recommendationFor(item, { occasion, styles });
    }
    const recommendedIds = new Set(
      [...wardrobe, ...store.products]
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
      products: store.products,
      unavailableProducts: store.unavailableProducts,
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
    const selectedProducts = productRefs(req.body);
    if (!ids.length && !selectedProducts.length)
      return res.json({ selection: null });
    const styles = req.body.style
      ? [v.choice(req.body.style, v.STYLES, "style")]
      : req.user.preferredStyles || [];
    const [docs, store, forecast] = await Promise.all([
      Item.find({ userId: owner(req), _id: { $in: ids } }),
      resolveProducts(req.body),
      weatherProvider(date),
    ]);
    if (docs.length !== ids.length)
      throw v.badRequest("A selected piece is no longer in your wardrobe.");
    const pieces = [...docs.map(itemJson), ...store.products];
    if (pieces.length > 6) throw v.badRequest("Choose up to six outfit pieces.");
    let colourMatches = {};
    try { colourMatches = await colourProvider(pieces.flatMap(itemColours)); }
    catch { /* Palette lookup must never prevent selecting or saving an outfit. */ }
    res.json({
      selection: assessSelection(
        pieces,
        occasion,
        styles,
        forecast,
        colourMatches,
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
    const store = await resolveProducts(req.body),
      pieces = [...docs.map(itemJson), ...store.products];
    if (pieces.length > 6) throw v.badRequest("Choose up to six outfit pieces.");
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
        size: piece.size, businessId: piece.businessId, businessName: piece.businessName,
        category: piece.category, colour: piece.colour, colours: itemColours(piece), style: piece.style,
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
      try { await storeProduct(piece.productId, piece.colour || undefined, piece.size || undefined); }
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
    plannerProducts, addPlannerProduct, removePlannerProduct,
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
