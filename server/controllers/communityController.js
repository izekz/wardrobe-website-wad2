const mongoose = require('mongoose');
const validation = require('../communityValidation');
const { listedColours } = require('../services/listedColours');
const defaultModels = {
  Listing: require('../models/CommunityListing'),
  Request: require('../models/OutfitRequest'),
  Response: require('../models/RequestResponse'),
  User: require('../models/User'),
  Product: require('../models/Product'),
  Business: require('../models/Business'),
  Item: require('../models/WardrobeItem'),
  Purchase: require('../models/RequestPurchase'),
  StyleVideo: require('../models/StyleVideo'),
  Contact: require('../models/RequestContact'),
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
    expired: !!doc.expiredAt, closedByCustomer: !!doc.closedByCustomer, fulfilled: !!doc.purchaseId
  };
}

function createCommunityController(models = defaultModels) {
  const { Listing, Request, Response, User, Product } = models;
  const Contact = models.Contact || require('../models/RequestContact');
  const Business = models.Business || require('../models/Business');
  // Outfit Requests are free to post. Business Style Feed boosts remain coin-funded.
  // Expire only unaccepted requests. Accepted ones remain eligible for checkout.
  async function expireRequests() {
    await Request.updateMany({ deletedAt: null, status: 'open', acceptedResponseId: null, deadline: { $lt: validation.singaporeToday() } },
      { $set: { status: 'closed', expiredAt: new Date() } });
  }

  async function requestSummaries(items) {
    const ids = items.map(item => item._id);
    const [replies, contacts] = ids.length ? await Promise.all([
      Response.find({ requestId: { $in: ids } }).select('requestId createdAt'),
      Contact.find({ requestId: { $in: ids } }).select('requestId createdAt'),
    ]) : [[], []];
    const counts = new Map();
    for (const reply of replies) counts.set(String(reply.requestId), (counts.get(String(reply.requestId)) || 0) + 1);
    const messages = new Map();
    for (const contact of contacts) messages.set(String(contact.requestId), (messages.get(String(contact.requestId)) || 0) + 1);
    return items.map(item => ({ ...requestJson(item), suggestionCount: counts.get(String(item._id)) || 0, messageCount: messages.get(String(item._id)) || 0 }));
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
    const item = await Request.findOneAndUpdate(filter, { $set: { status, expiredAt: null, closedByCustomer: status === 'closed', acceptedResponseId: null, acceptedAt: null } }, { returnDocument: 'after', runValidators: true });
    if (!item) return res.status(409).json({ message: 'The request changed. Refresh and try again.' });
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
    const actor = actorFor(req);
    const ownHistory = actor?.id === id && ['consumer', 'customer'].includes(actor.role);
    if (ownHistory || actor?.role === 'business') await expireRequests();
    const canBrowseHistory = ownHistory || actor?.role === 'business';
    const listingPage = pageNumber(req.query.listingsPage), requestPage = pageNumber(req.query.requestsPage), pageSize = 12;
    const [listings, listingTotal, requests, requestTotal] = await Promise.all([
      Listing.find({ ownerId: id }).sort({ createdAt: -1, _id: -1 }).skip((listingPage - 1) * pageSize).limit(pageSize),
      Listing.countDocuments({ ownerId: id }),
      ...(canBrowseHistory ? [
        Request.find({ consumerId: id, deletedAt: null }).sort({ status: -1, createdAt: -1, _id: -1 }).skip((requestPage - 1) * pageSize).limit(pageSize),
        Request.countDocuments({ consumerId: id, deletedAt: null })
      ] : [Promise.resolve([]), Promise.resolve(0)])
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
    const actor = actorFor(req);
    if (!actor) return res.status(401).json({ message: 'Sign in to view requests.' });
    const isCustomer = ['consumer', 'customer'].includes(actor.role);
    if (!isCustomer && actor.role !== 'business') return res.status(403).json({ message: 'This page is not available for this account.' });
    await expireRequests();
    // Businesses can browse non-deleted community request history; customer accounts only see their own.
    const filter = { deletedAt: null, ...(isCustomer ? { consumerId: actor.id } : {}) };
    const search = cleanQuery(req.query.search);
    if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };
    const style = cleanQuery(req.query.style);
    if (style) filter.preferredStyle = style;
    if (req.query.openOnly === 'true') filter.status = 'open';
    const status = cleanQuery(req.query.status);
    if (status && !['open', 'closed'].includes(status)) throw validation.badRequest('Choose open or closed requests.');
    if (status) filter.status = status;
    const pageText = cleanQuery(req.query.page, 8) || '1';
    if (!/^[1-9]\d{0,4}$/.test(pageText)) throw validation.badRequest('Choose a valid page.');
    const page = Number(pageText), pageSize = 12;
    const [items, total] = await Promise.all([
      // Sort the complete result BEFORE pagination: every open request precedes every closed one.
      Request.find(filter).sort({ status: -1, createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      Request.countDocuments(filter)
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ requests: await requestSummaries(items), total, page, pageSize });
  }

  // Browse by customer profile, not by request row. Paginating after grouping
  // prevents one customer's history from being split across profile cards.
  async function getRequestProfiles(req, res) {
    const actor = actorFor(req);
    if (!actor) return res.status(401).json({ message: 'Sign in to view customer profiles.' });
    if (actor.role !== 'business') return res.status(403).json({ message: 'Only business accounts can browse customer profiles.' });
    await expireRequests();
    const status = cleanQuery(req.query.status);
    if (status && !['open', 'closed'].includes(status)) throw validation.badRequest('Choose open or closed requests.');
    const search = cleanQuery(req.query.search);
    const page = pageNumber(req.query.page), pageSize = 8;
    const filter = { deletedAt: null };
    if (status) filter.status = status;
    if (search) {
      const expression = { $regex: escapeRegex(search), $options: 'i' };
      filter.$or = [{ consumerName: expression }, { title: expression }];
    }
    // Only non-deleted requests are grouped. Each card represents a single
    // customer; name sorting is stable even when multiple customers share a name.
    const [result = {}] = await Request.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: {
        _id: '$consumerId', consumerName: { $first: '$consumerName' },
        requestCount: { $sum: 1 },
        openCount: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
        closedCount: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
        latestTitle: { $first: '$title' }, latestRequestAt: { $first: '$createdAt' }
      } },
      { $sort: { consumerName: 1, _id: 1 } },
      { $facet: {
        metadata: [{ $count: 'total' }],
        profiles: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }]
      } }
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({
      profiles: (result.profiles || []).map(profile => ({
        consumerId: profile._id, consumerName: profile.consumerName,
        requestCount: profile.requestCount, openCount: profile.openCount,
        closedCount: profile.closedCount, latestTitle: profile.latestTitle,
        latestRequestAt: profile.latestRequestAt
      })),
      total: result.metadata?.[0]?.total || 0, page, pageSize
    });
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
    await expireRequests();
    const item = await Request.findOne({ _id: req.params.id, deletedAt: null });
    if (!item) return res.status(404).json({ message: 'Request not found.' });
    const actor = actorFor(req);
    if (!actor) return res.status(401).json({ message: 'Please sign in.' });
    const owner = actor.id === item.consumerId && ['consumer', 'customer'].includes(actor.role);
    const isBusiness = actor.role === 'business';
    let ownBusinessReplies = [];
    if (!owner && isBusiness) {
      const business = await Business.findOne({ ownerId: actor.id });
      if (business) ownBusinessReplies = await Response.find({ requestId: item._id, businessId: String(business._id) });
    } else if (!owner) return res.status(404).json({ message: 'Request not found.' });
    const responses = owner ? await Response.find({ requestId: item._id }).sort({ createdAt: -1 }) : ownBusinessReplies;
    const productIds = responses.map(reply => reply.productId).filter(idIsValid);
    const products = Product && productIds.length ? await Product.find({ _id: { $in: productIds }, status: 'active' }) : [];
    const byId = new Map(products.map(product => [String(product._id), product]));
    res.set('Cache-Control', 'no-store');
    res.json({ request: { ...requestJson(item), ...(!owner ? { acceptedResponseId: ownBusinessReplies.some(reply => String(reply._id) === String(item.acceptedResponseId)) ? String(item.acceptedResponseId) : null } : {}) }, responses: responses.map(reply => ({
      responseId: String(reply._id), requestId: String(reply.requestId), businessId: reply.businessId,
      businessName: reply.businessName, productId: reply.productId, productName: reply.productName,
      productPrice: reply.productPrice, message: reply.message, createdAt: reply.createdAt,
      product: (() => {
        const p = byId.get(reply.productId);
        if (!p || p.businessId !== reply.businessId) return null;
        return { productId: String(p._id), businessName: p.businessName, name: p.name, price: p.price,
          category: p.category, style: p.style, sizes: p.sizes, occasions: p.occasions, stock: p.stock,
          colours: listedColours(p), material: p.material || null,
          availableColours: listedColours(p),
          imageURL: `/api/catalog/products/${p._id}/image`, reasons: [p.price <= item.budget ? 'Within your budget' : 'Above your budget'] };
      })()
    })) });
  }

  async function contactContext(req) {
    if (!idIsValid(req.params.id)) throw Object.assign(new Error('Request not found.'), { status: 404 });
    const actor = actorFor(req);
    if (!actor) throw Object.assign(new Error('Please sign in.'), { status: 401 });
    const item = await Request.findOne({ _id: req.params.id, deletedAt: null });
    if (!item) throw Object.assign(new Error('Request not found.'), { status: 404 });
    const owner = ['consumer', 'customer'].includes(actor.role) && actor.id === item.consumerId;
    if (!owner && actor.role !== 'business') throw Object.assign(new Error('Request not found.'), { status: 404 });
    const business = owner ? null : await Business.findOne({ ownerId: actor.id });
    if (!owner && !business) throw Object.assign(new Error('Create a business profile to contact customers.'), { status: 409 });
    return { item, actor, owner, business };
  }

  async function getContacts(req, res) {
    const { item, owner, business } = await contactContext(req);
    const contacts = await Contact.find({ requestId: item._id, ...(owner ? {} : { businessId: String(business._id) }) }).sort({ createdAt: 1, _id: 1 });
    const threads = new Map();
    for (const contact of contacts) {
      const id = contact.businessId;
      if (!threads.has(id)) threads.set(id, { businessId: id, businessName: contact.businessName, messages: [] });
      threads.get(id).messages.push({ id: String(contact._id), senderRole: contact.senderRole, text: contact.text, createdAt: contact.createdAt });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ threads: [...threads.values()] });
  }

  async function sendContact(req, res) {
    const { item, owner, actor, business } = await contactContext(req);
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 600) throw validation.badRequest('Write a message of up to 600 characters.');
    let businessId;
    let businessName;
    if (owner) {
      businessId = typeof req.body?.businessId === 'string' ? req.body.businessId : '';
      if (!idIsValid(businessId)) throw validation.badRequest('Choose a business conversation.');
      // A customer may reply only to an existing conversation—not message arbitrary businesses.
      const earlier = await Contact.findOne({ requestId: item._id, businessId, customerId: actor.id });
      if (!earlier) throw Object.assign(new Error('This conversation does not exist.'), { status: 404 });
      businessName = earlier.businessName;
    } else {
      businessId = String(business._id);
      businessName = business.businessName;
    }
    // Alternating messages prevents repeated unsolicited follow-ups while preserving two-way contact.
    const previous = await Contact.find({ requestId: item._id, businessId }).sort({ createdAt: -1, _id: -1 }).limit(1);
    if (previous[0]?.senderRole === (owner ? 'customer' : 'business')) {
      return res.status(409).json({ message: owner ? 'The business has not replied yet.' : 'You have already sent a message. Wait for the customer to reply.' });
    }
    const saved = await Contact.create({ requestId: item._id, customerId: item.consumerId, businessId, businessName,
      senderRole: owner ? 'customer' : 'business', text });
    res.status(201).json({ message: { id: String(saved._id), senderRole: saved.senderRole, text: saved.text, createdAt: saved.createdAt } });
  }

  return { getSession, getListings, createListing, getListingImage, getListing, getRequests, createRequest, getRequest,
    getMyListings, updateListing, setListingStatus, deleteListing, setRequestStatus, deleteRequest, getMember, getContacts, sendContact, getRequestProfiles };
}

module.exports = { createCommunityController, defaultModels };
