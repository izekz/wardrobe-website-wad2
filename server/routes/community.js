const express = require('express');
const mongoose = require('mongoose');
const validation = require('../communityValidation');
const defaultModels = {
  Listing: require('../models/CommunityListing'),
  Request: require('../models/OutfitRequest'),
  Response: require('../models/RequestResponse')
};

function actorFor(req) {
  // Person 5: verified login middleware sets req.user before this router runs.
  // An ownerId sent by the browser is NEVER used to establish identity.
  const user = req.user;
  if (user && (user.id || user._id || user.userId)) {
    return { id: String(user.id || user._id || user.userId), name: String(user.name || 'Community member').slice(0, 100), role: user.role, mode: 'account' };
  }
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (process.env.COMMUNITY_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production' && local) {
    return { id: process.env.COMMUNITY_DEMO_USER_ID || 'week9-demo-customer', name: 'Demo customer', role: 'consumer', mode: 'local-demo' };
  }
  return null;
}
function requireCustomer(req, res, next) {
  const actor = actorFor(req);
  if (!actor) return res.status(401).json({ message: 'Please sign in before posting.' });
  if (!['consumer', 'customer'].includes(actor.role)) return res.status(403).json({ message: 'A customer account is required to post here.' });
  req.communityActor = actor;
  next();
}
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

function createCommunityRouter(models = defaultModels) {
  const { Listing, Request, Response } = models;
  const router = express.Router();
  router.get('/session', (req, res) => {
    const actor = actorFor(req);
    res.set('Cache-Control', 'no-store');
    res.json({ mode: actor?.mode || 'signed-out', name: actor?.name || null });
  });
  router.get('/listings', async (req, res) => {
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
  });
  router.post('/listings', requireCustomer, async (req, res) => {
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
  });
  router.get('/listings/:id/image', async (req, res) => {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Photo not found.' });
    const item = await Listing.findById(req.params.id).select('+photo.data');
    if (!item?.photo?.data) return res.status(404).json({ message: 'Photo not found.' });
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, max-age=300');
    res.type(item.photo.contentType).send(item.photo.data);
  });
  router.get('/listings/:id', async (req, res) => {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Listing not found.' });
    const item = await Listing.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Listing not found.' });
    res.json({ listing: listingJson(item) });
  });
  router.get('/requests', async (req, res) => {
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
  });
  router.post('/requests', requireCustomer, async (req, res) => {
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
  });
  router.get('/requests/:id', async (req, res) => {
    if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Request not found.' });
    const item = await Request.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Request not found.' });
    const responses = await Response.find({ requestId: item._id }).sort({ createdAt: -1 });
    res.json({ request: requestJson(item), responses: responses.map(reply => ({
      responseId: String(reply._id), requestId: String(reply.requestId), businessId: reply.businessId,
      businessName: reply.businessName, productId: reply.productId, productName: reply.productName,
      productPrice: reply.productPrice, message: reply.message, createdAt: reply.createdAt
    })) });
  });
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.status === 400) return res.status(400).json({ message: error.message });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Check the required fields and try again.' });
    console.error('Community request failed:', error.name);
    res.status(500).json({ message: 'We could not complete that request. Please try again.' });
  });
  return router;
}
module.exports = { createCommunityRouter, actorFor, defaultModels };
