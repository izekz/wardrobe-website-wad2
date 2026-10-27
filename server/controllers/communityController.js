const mongoose = require('mongoose');
const validation = require('../communityValidation');
const { listedColours } = require('../services/listedColours');
const defaultModels = {
  Listing: require('../models/CommunityListing'),
  Request: require('../models/OutfitRequest'),
  Response: require('../models/RequestResponse'),
  User: require('../models/User'),
  Product: require('../models/Product'),
  Item: require('../models/WardrobeItem'),
  Purchase: require('../models/RequestPurchase'),
};

const { actorFor } = require('../middleware/community');

function idIsValid(id) { return mongoose.isObjectIdOrHexString(id); }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function cleanQuery(value, max = 80) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > max) throw validation.badRequest('One of the filters is invalid.');
  return value.trim();
}
function listingJson(doc) {
  return {
    listingId: String(doc._id), ownerId: doc.ownerId, ownerName: doc.ownerName,
    name: doc.name, category: doc.category, style: doc.style, size: doc.size,
    condition: doc.condition, description: doc.description, listingType: doc.listingType,
    price: doc.price, rentalPrice: doc.rentalPrice, status: doc.status,
    imageURL: `/api/community/listings/${doc._id}/image?v=${new Date(doc.updatedAt || doc.createdAt).getTime()}`, createdAt: doc.createdAt
  };
}
function requestJson(doc) {
  return {
    requestId: String(doc._id), consumerId: doc.consumerId, consumerName: doc.consumerName,
    title: doc.title, occasion: doc.occasion, description: doc.description, budget: doc.budget,
    preferredStyle: doc.preferredStyle, deadline: doc.deadline, status: doc.status, createdAt: doc.createdAt,
    acceptedResponseId: doc.acceptedResponseId ? String(doc.acceptedResponseId) : null,
    fulfilled: !!doc.purchaseId
  };
}

function createCommunityController(models = defaultModels) {
  const { Listing, Request, Response, User, Product } = models;
  const { FREE_REQUESTS, EXTRA_REQUEST_CREDITS, CREDIT_PACKAGES } = validation;

  // ---------- Credits: the first few open requests are free, each one after that costs credits ----------
  // Requests past their needed-by date no longer use up a free slot.
  function openRequestCount(consumerId) {
    return Request.countDocuments({ consumerId, deletedAt: null, status: 'open', deadline: { $gte: validation.singaporeToday() } });
  }
  async function creditBalance(consumerId) {
    const user = idIsValid(consumerId) ? await User.findById(consumerId) : null;
    return user?.credits ?? 0;
  }
  async function walletJson(consumerId) {
    const [credits, openCount] = await Promise.all([creditBalance(consumerId), openRequestCount(consumerId)]);
    return { credits, openCount, freeRequests: FREE_REQUESTS, extraRequestCost: EXTRA_REQUEST_CREDITS, packages: CREDIT_PACKAGES };
  }
  // Returns how many credits were taken (0 while the customer is inside the free allowance).
  async function chargeForExtraRequest(consumerId) {
    if (await openRequestCount(consumerId) < FREE_REQUESTS) return 0;
    const updated = idIsValid(consumerId) && await User.findOneAndUpdate({ _id: consumerId, credits: { $gte: EXTRA_REQUEST_CREDITS } },
      { $inc: { credits: -EXTRA_REQUEST_CREDITS } }, { returnDocument: 'after' });
    if (!updated) {
      const error = new Error(`You've used your ${FREE_REQUESTS} free open requests. Another one costs ${EXTRA_REQUEST_CREDITS} credits. Buy credits, or close a request first.`);
      error.status = 409;
      throw error;
    }
    return EXTRA_REQUEST_CREDITS;
  }
  async function refundCredits(consumerId, amount) {
    if (amount) await User.updateOne({ _id: consumerId }, { $inc: { credits: amount } });
  }

  async function getCredits(req, res) {
    res.set('Cache-Control', 'no-store');
    res.json(await walletJson(req.communityActor.id));
  }

  // Simulated payment for the demo, like the business coins: no card details, the balance is simply topped up.
  async function purchaseCredits(req, res) {
    const amount = req.body?.credits;
    if (!CREDIT_PACKAGES.includes(amount)) throw validation.badRequest('Choose one of the credit packages.');
    const id = req.communityActor.id;
    const updated = idIsValid(id) && await User.findOneAndUpdate({ _id: id }, { $inc: { credits: amount } }, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ message: 'Sign in with a customer account to buy credits.' });
    res.json(await walletJson(id));
  }

  async function requestSummaries(items) {
    const replies = items.length ? await Response.find({ requestId: { $in: items.map(item => item._id) } }).select('requestId createdAt') : [];
    const counts = new Map();
    for (const reply of replies) counts.set(String(reply.requestId), (counts.get(String(reply.requestId)) || 0) + 1);
    return items.map(item => ({ ...requestJson(item), suggestionCount: counts.get(String(item._id)) || 0 }));
  }

  function pageNumber(value) {
    const page = cleanQuery(value, 8) || '1';
    if (!/^[1-9]\d{0,4}$/.test(page)) throw validation.badRequest('Choose a valid page.');
    return Number(page);
  }

  async function getMyListings(req, res) {
    const filter = { ownerId: req.communityActor.id };
    const status = cleanQuery(req.query.status);
    if (status && !['available', 'unavailable'].includes(status)) throw validation.badRequest('Choose a valid listing status.');
    if (status) filter.status = status;
    const page = pageNumber(req.query.page), pageSize = 12;
    const [items, total] = await Promise.all([
      Listing.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      Listing.countDocuments(filter)
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ listings: items.map(listingJson), total, page, pageSize });
  }

  async function updateListing(req, res) {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Listing not found.' });
    const { price, rentalPrice, ...input } = validation.listingInput(req.body, { editing: true });
    const sale = input.listingType === 'sell';
    const item = await Listing.findOneAndUpdate({ _id: req.params.id, ownerId: req.communityActor.id }, {
      $set: { ...input, ...(sale ? { price } : { rentalPrice }) },
      $unset: { [sale ? 'rentalPrice' : 'price']: '' }
    }, { returnDocument: 'after', runValidators: true });
    if (!item) return res.status(404).json({ message: 'Listing not found or it does not belong to you.' });
    res.json({ listing: listingJson(item) });
  }

  async function setListingStatus(req, res) {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Listing not found.' });
    if (!['available', 'unavailable'].includes(req.body?.status)) throw validation.badRequest('Choose available or unavailable.');
    const item = await Listing.findOneAndUpdate({ _id: req.params.id, ownerId: req.communityActor.id },
      { $set: { status: req.body.status } }, { returnDocument: 'after', runValidators: true });
    if (!item) return res.status(404).json({ message: 'Listing not found or it does not belong to you.' });
    res.json({ listing: listingJson(item) });
  }

  async function deleteListing(req, res) {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Listing not found.' });
    const result = await Listing.deleteOne({ _id: req.params.id, ownerId: req.communityActor.id });
    if (!result.deletedCount) return res.status(404).json({ message: 'Listing not found or it does not belong to you.' });
    res.json({ message: 'Listing deleted.' });
  }

  async function setRequestStatus(req, res) {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Request not found.' });
    const status = req.body?.status;
    if (!['open', 'closed'].includes(status)) throw validation.badRequest('Choose open or closed.');
    const filter = { _id: req.params.id, consumerId: req.communityActor.id, deletedAt: null };
    const existing = await Request.findOne(filter);
    if (!existing) return res.status(404).json({ message: 'Request not found or it does not belong to you.' });
    if (existing.purchaseId || existing.acceptedResponseId) return res.status(409).json({ message: 'This request has an accepted suggestion or completed purchase. Delete it instead if you no longer need it.' });
    filter.purchaseId = null;
    if (status === 'open') {
      if (existing.deadline < validation.singaporeToday()) throw validation.badRequest('This request is past its needed-by date. Post a new request instead.');
      filter.deadline = { $gte: validation.singaporeToday() };
    }
    // Reopening a closed request takes a slot again, so it is charged like a new one.
    const charged = status === 'open' && existing.status !== 'open' ? await chargeForExtraRequest(req.communityActor.id) : 0;
    const item = await Request.findOneAndUpdate(filter, { $set: { status, acceptedResponseId: null, acceptedAt: null } }, { returnDocument: 'after', runValidators: true });
    if (!item) {
      await refundCredits(req.communityActor.id, charged);
      return res.status(409).json({ message: 'The request changed. Refresh and try again.' });
    }
    res.json({ request: requestJson(item) });
  }

  async function deleteRequest(req, res) {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Request not found.' });
    // Hide the request instead of orphaning suggestions, receipts, and wardrobe items.
    // Requests owned by other customers or already deleted cannot be removed.
    const item = await Request.findOneAndUpdate({ _id: req.params.id, consumerId: req.communityActor.id, deletedAt: null },
      { $set: { deletedAt: new Date(), status: 'closed' } }, { returnDocument: 'after', runValidators: true });
    if (!item) return res.status(404).json({ message: 'Request not found or it does not belong to you.' });
    res.json({ message: 'Request deleted.' });
  }

  async function getMember(req, res) {
    const id = cleanQuery(req.params.id, 100);
    let user = idIsValid(id) ? await User.findById(id).select('name role suspended') : null;
    if (user?.suspended) return res.status(404).json({ message: 'Member not found.' });
    // Older demo posts keep their original owner. Never assign them to whoever logs in.
    if (!user) {
      const [listing, request] = await Promise.all([Listing.findOne({ ownerId: id }), Request.findOne({ consumerId: id, deletedAt: null })]);
      if (!listing && !request) return res.status(404).json({ message: 'Member not found.' });
      user = { name: listing?.ownerName || request.consumerName, role: 'consumer' };
    }
    const listingPage = pageNumber(req.query.listingsPage), requestPage = pageNumber(req.query.requestsPage), pageSize = 12;
    const [listings, listingTotal, requests, requestTotal] = await Promise.all([
      Listing.find({ ownerId: id }).sort({ createdAt: -1, _id: -1 }).skip((listingPage - 1) * pageSize).limit(pageSize),
      Listing.countDocuments({ ownerId: id }),
      Request.find({ consumerId: id, deletedAt: null }).sort({ status: -1, createdAt: -1, _id: -1 }).skip((requestPage - 1) * pageSize).limit(pageSize),
      Request.countDocuments({ consumerId: id, deletedAt: null })
    ]);
    // Public profile data only: no email, password, session, or preferences.
    res.json({ member: { id, name: user.name, role: user.role },
      listings: listings.map(listingJson), listingTotal, listingPage,
      requests: await requestSummaries(requests), requestTotal, requestPage, pageSize });
  }

  function getSession(req, res) {
    const actor = actorFor(req);
    res.set('Cache-Control', 'no-store');
    res.json({ mode: actor?.mode || 'signed-out', name: actor?.name || null });
  }

  async function getListings(req, res) {
    const filter = { status: 'available' };
    for (const field of ['category', 'style', 'size', 'listingType']) {
      const value = cleanQuery(req.query[field]);
      if (value) filter[field] = value;
    }
    const search = cleanQuery(req.query.search);
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
    const maximum = cleanQuery(req.query.maxPrice, 12);
    if (maximum) {
      const amount = Number(maximum);
      if (!Number.isFinite(amount) || amount < 0) throw validation.badRequest('Maximum price must be zero or above.');
      filter.$or = [{ listingType: 'sell', price: { $lte: amount } }, { listingType: 'rent', rentalPrice: { $lte: amount } }];
    }
    const pageText = cleanQuery(req.query.page, 8) || '1';
    if (!/^[1-9]\d{0,4}$/.test(pageText)) throw validation.badRequest('Choose a valid page.');
    const page = Number(pageText), pageSize = 12;
    const [items, total] = await Promise.all([
      Listing.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      Listing.countDocuments(filter)
    ]);
    res.json({ listings: items.map(listingJson), total, page, pageSize });
  }

  async function createListing(req, res) {
    const input = validation.listingInput(req.body), actor = req.communityActor;
    const key = { ownerId: actor.id, clientRequestId: input.clientRequestId };
    const existing = await Listing.findOne(key);
    if (existing) return res.json({ listing: listingJson(existing) });
    try {
      const item = await Listing.create({ ...input, ownerId: actor.id, ownerName: actor.name });
      res.status(201).json({ listing: listingJson(item) });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const saved = await Listing.findOne(key);
      if (!saved) throw error;
      res.json({ listing: listingJson(saved) });
    }
  }

  async function getListingImage(req, res) {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Photo not found.' });
    const item = await Listing.findById(req.params.id).select('+photo.data');
    if (!item?.photo?.data) return res.status(404).json({ message: 'Photo not found.' });
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, max-age=300');
    res.type(item.photo.contentType).send(item.photo.data);
  }

  async function getListing(req, res) {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Listing not found.' });
    const item = await Listing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Listing not found.' });
    res.json({ listing: listingJson(item) });
  }

  async function getRequests(req, res) {
    const filter = { deletedAt: null };
    const search = cleanQuery(req.query.search);
    if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };
    const style = cleanQuery(req.query.style);
    if (style) filter.preferredStyle = style;
    if (req.query.openOnly === 'true') filter.status = 'open';
    const status = cleanQuery(req.query.status);
    if (status && !['open', 'closed'].includes(status)) throw validation.badRequest('Choose open or closed requests.');
    if (status) filter.status = status;
    let mine = null;
    if (req.query.mine === 'true') {
      const actor = actorFor(req);
      if (!actor) return res.status(401).json({ message: 'Sign in to see your requests.' });
      filter.consumerId = actor.id;
      mine = actor.id;
    }
    const pageText = cleanQuery(req.query.page, 8) || '1';
    if (!/^[1-9]\d{0,4}$/.test(pageText)) throw validation.badRequest('Choose a valid page.');
    const page = Number(pageText), pageSize = 12;
    const [items, total] = await Promise.all([
      // Sort the complete result BEFORE pagination: every open request precedes every closed one.
      Request.find(filter).sort({ status: -1, createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      Request.countDocuments(filter)
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ requests: await requestSummaries(items), total, page, pageSize, ...(mine ? { wallet: await walletJson(mine) } : {}) });
  }

  async function createRequest(req, res) {
    const input = validation.outfitRequestInput(req.body), actor = req.communityActor;
    const key = { consumerId: actor.id, clientRequestId: input.clientRequestId };
    const existing = await Request.findOne(key);
    if (existing) return res.json({ request: requestJson(existing) });
    const charged = await chargeForExtraRequest(actor.id);
    try {
      const item = await Request.create({ ...input, consumerId: actor.id, consumerName: actor.name });
      res.status(201).json({ request: requestJson(item), creditsSpent: charged });
    } catch (error) {
      await refundCredits(actor.id, charged);
      if (error.code !== 11000) throw error;
      const saved = await Request.findOne(key);
      if (!saved) throw error;
      res.json({ request: requestJson(saved) });
    }
  }

  async function getRequest(req, res) {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Request not found.' });
    const item = await Request.findOne({ _id: req.params.id, deletedAt: null });
    if (!item) return res.status(404).json({ message: 'Request not found.' });
    const responses = await Response.find({ requestId: item._id }).sort({ createdAt: -1 });
    const productIds = responses.map(reply => reply.productId).filter(idIsValid);
    const products = Product && productIds.length ? await Product.find({ _id: { $in: productIds }, status: 'active' }) : [];
    const byId = new Map(products.map(product => [String(product._id), product]));
    res.set('Cache-Control', 'no-store');
    res.json({ request: requestJson(item), responses: responses.map(reply => ({
      responseId: String(reply._id), requestId: String(reply.requestId), businessId: reply.businessId,
      businessName: reply.businessName, productId: reply.productId, productName: reply.productName,
      productPrice: reply.productPrice, message: reply.message, createdAt: reply.createdAt,
      product: (() => {
        const p = byId.get(reply.productId);
        if (!p || p.businessId !== reply.businessId) return null;
        return { productId: String(p._id), businessName: p.businessName, name: p.name, price: p.price,
          category: p.category, style: p.style, sizes: p.sizes, occasions: p.occasions, stock: p.stock,
          availableColours: listedColours(p),
          imageURL: `/api/catalog/products/${p._id}/image`, reasons: [p.price <= item.budget ? 'Within your budget' : 'Above your budget'] };
      })()
    })) });
  }

  return { getSession, getCredits, purchaseCredits, getListings, createListing, getListingImage, getListing, getRequests, createRequest, getRequest,
    getMyListings, updateListing, setListingStatus, deleteListing, setRequestStatus, deleteRequest, getMember };
}

module.exports = { createCommunityController, defaultModels };
