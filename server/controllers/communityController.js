const mongoose = require('mongoose');
const validation = require('../communityValidation');
const defaultModels = {
  Listing: require('../models/CommunityListing'),
  Request: require('../models/OutfitRequest'),
  Response: require('../models/RequestResponse')
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
    imageURL: `/api/community/listings/${doc._id}/image`, createdAt: doc.createdAt
  };
}
function requestJson(doc) {
  return {
    requestId: String(doc._id), consumerId: doc.consumerId, consumerName: doc.consumerName,
    title: doc.title, occasion: doc.occasion, description: doc.description, budget: doc.budget,
    preferredStyle: doc.preferredStyle, deadline: doc.deadline, status: doc.status, createdAt: doc.createdAt
  };
}

function createCommunityController(models = defaultModels) {
  const { Listing, Request, Response } = models;

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
    const filter = {};
    const search = cleanQuery(req.query.search);
    if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };
    const style = cleanQuery(req.query.style);
    if (style) filter.preferredStyle = style;
    if (req.query.openOnly === 'true') { filter.status = 'open'; filter.deadline = { $gte: validation.singaporeToday() }; }
    const pageText = cleanQuery(req.query.page, 8) || '1';
    if (!/^[1-9]\d{0,4}$/.test(pageText)) throw validation.badRequest('Choose a valid page.');
    const page = Number(pageText), pageSize = 12;
    const [items, total] = await Promise.all([
      Request.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      Request.countDocuments(filter)
    ]);
    res.json({ requests: items.map(requestJson), total, page, pageSize });
  }

  async function createRequest(req, res) {
    const input = validation.outfitRequestInput(req.body), actor = req.communityActor;
    const key = { consumerId: actor.id, clientRequestId: input.clientRequestId };
    const existing = await Request.findOne(key);
    if (existing) return res.json({ request: requestJson(existing) });
    try {
      const item = await Request.create({ ...input, consumerId: actor.id, consumerName: actor.name });
      res.status(201).json({ request: requestJson(item) });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const saved = await Request.findOne(key);
      if (!saved) throw error;
      res.json({ request: requestJson(saved) });
    }
  }

  async function getRequest(req, res) {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Request not found.' });
    const item = await Request.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Request not found.' });
    const responses = await Response.find({ requestId: item._id }).sort({ createdAt: -1 });
    res.json({ request: requestJson(item), responses: responses.map(reply => ({
      responseId: String(reply._id), requestId: String(reply.requestId), businessId: reply.businessId,
      businessName: reply.businessName, productId: reply.productId, productName: reply.productName,
      productPrice: reply.productPrice, message: reply.message, createdAt: reply.createdAt
    })) });
  }

  return { getSession, getListings, createListing, getListingImage, getListing, getRequests, createRequest, getRequest };
}

module.exports = { createCommunityController, defaultModels };
