const mongoose = require('mongoose');
const { singaporeToday } = require('../communityValidation');
const wardrobeValidation = require('../services/wardrobeValidation');
const { listedColours } = require('../services/listedColours');
const { syncProductBoosts } = require('../services/styleBoostAvailability');
const fail = (status, message) => Object.assign(new Error(message), { status });
function receipt(doc) {
  return {
    purchaseId: String(doc._id), requestId: String(doc.requestId), responseId: String(doc.responseId),
    productId: doc.productId, productName: doc.productName, businessName: doc.businessName,
    price: doc.price, size: doc.size, colour: doc.colour, material: doc.material,
    wardrobeItemId: doc.wardrobeItemId, mode: doc.mode, createdAt: doc.createdAt,
  };
}
function createRequestCommerceController(models, transact = work => mongoose.connection.transaction(work)) {
  const { Request, Response, Product, Item, Purchase, StyleVideo } = models;
  function ids(req) {
    if (!mongoose.isObjectIdOrHexString(req.params.id) ||
      (req.params.responseId && !mongoose.isObjectIdOrHexString(req.params.responseId))) {
      throw fail(404, 'Request or suggestion not found.');
    }
    return { _id: req.params.id, consumerId: req.communityActor.id };
  }
  async function ownRequest(req, session = null) {
    const request = await Request.findOne({ ...ids(req), deletedAt: null }).session(session);
    if (!request) throw fail(404, 'This request does not belong to you.');
    return request;
  }
  function assertOpen(request) {
    if (request.status !== 'open' || request.deadline < singaporeToday()) {
      throw fail(409, 'This request is closed or past its needed-by date.');
    }
  }
  async function suggestedProduct(req, session = null) {
    const response = await Response.findOne({ _id: req.params.responseId, requestId: req.params.id }).session(session);
    if (!response) throw fail(404, 'This suggestion does not belong to this request.');
    const product = await Product.findOne({ _id: response.productId, businessId: response.businessId, status: 'active' })
      .select('+photo.data').session(session);
    if (!product || product.stock < 1) throw fail(409, 'This suggested item is no longer available. Please choose another suggestion.');
    return { response, product };
  }
  async function accept(req, res) {
    const request = await ownRequest(req);
    if (request.purchaseId) throw fail(409, 'This request already has a completed demo purchase.');
    const switching = request.status === 'closed' && !!request.acceptedResponseId;
    // The needed-by date ends NEW business replies, not previously offered items.
    // Otherwise cancelling acceptance after the deadline traps customers: their
    // request is closed, yet they cannot select any of their existing replies.
    // A customer may close a request to stop new business replies but still
    // accept a suggestion already made. The same holds after its deadline.
    const choosingEarlierOffer = request.status === 'closed' && !request.acceptedResponseId;
    if (!switching && !choosingEarlierOffer) assertOpen(request);
    await suggestedProduct(req);
    const selector = switching
      ? { status: 'closed', acceptedResponseId: request.acceptedResponseId }
      : choosingEarlierOffer
        ? { status: 'closed', acceptedResponseId: null, expiredAt: request.expiredAt || null }
        : { status: 'open', deadline: { $gte: singaporeToday() } };
    const updated = await Request.findOneAndUpdate({ ...ids(req), ...selector, deletedAt: null, purchaseId: null }, {
      $set: { status: 'closed', expiredAt: null, acceptedResponseId: req.params.responseId, acceptedAt: new Date() },
    }, { returnDocument: 'after', runValidators: true });
    if (!updated) throw fail(409, 'The request changed. Refresh and try again.');
    res.json({ acceptedResponseId: String(updated.acceptedResponseId), message: 'Suggestion accepted. Your request is now closed. You can still complete the optional demo purchase.' });
  }
  async function cancelAcceptance(req, res) {
    const request = await ownRequest(req);
    if (request.purchaseId) throw fail(409, 'The demo purchase is already complete.');
    if (!request.acceptedResponseId) throw fail(409, 'No accepted suggestion to cancel.');
    const expired = request.deadline < singaporeToday();
    const updated = await Request.findOneAndUpdate({ ...ids(req), status: 'closed', deletedAt: null,
      purchaseId: null, acceptedResponseId: request.acceptedResponseId }, {
      $set: { status: (expired || request.closedByCustomer) ? 'closed' : 'open', acceptedResponseId: null, acceptedAt: null,
        expiredAt: expired ? new Date() : null },
    }, { returnDocument: 'after', runValidators: true });
    if (!updated) throw fail(409, 'Your request changed. Refresh and try again.');
    res.json({ request: { requestId: String(updated._id), status: updated.status, expired: expired, acceptedResponseId: null } });
  }
  async function getPurchase(req, res) {
    await ownRequest(req);
    const purchase = await Purchase.findOne({ requestId: req.params.id, consumerId: req.communityActor.id });
    res.json({ purchase: purchase ? receipt(purchase) : null });
  }
  async function purchase(req, res) {
    ids(req);
    // Commit stock, receipt, wardrobe item and closure together. Retries return the same receipt.
    const result = await transact(async session => {
      const request = await ownRequest(req, session);
      const previous = await Purchase.findOne({ requestId: request._id, consumerId: req.communityActor.id }).session(session);
      if (previous) {
        if (String(previous.responseId) !== req.params.responseId) throw fail(409, 'A different suggestion was already purchased for this request.');
        return { purchase: receipt(previous), alreadyPurchased: true };
      }
      if (request.status !== 'closed' || !request.acceptedAt || String(request.acceptedResponseId) !== req.params.responseId) {
        throw fail(409, 'Accept this suggestion before completing your demo purchase.');
      }
      const { product, response } = await suggestedProduct(req, session);
      const size = wardrobeValidation.text(req.body?.size, 'Size', 20);
      if (!product.sizes.includes(size)) throw fail(400, 'Choose a size offered by this business.');
      const offeredColours = listedColours(product);
      if (offeredColours.length ? !offeredColours.includes(req.body?.colour) : req.body?.colour !== 'Not specified') {
        throw fail(400, 'The chosen colour is not listed for this product. Review the listing and try again.');
      }
      if (typeof req.body?.expectedPrice !== 'number' || !Number.isFinite(req.body.expectedPrice)) throw fail(400, 'Review the current price before confirming.');
      if (req.body.expectedPrice !== product.price) throw fail(409, 'The price has changed. Refresh this page and review the new total before confirming.');
      const clothing = wardrobeValidation.itemInput({
        name: product.name, category: product.category, style: [product.style],
        colour: req.body?.colour, material: product.material || 'Not specified', // Use the seller's metadata; older listings remain unknown.
      }, false, { allowLegacyStyles: true, allowUnknownColour: true });
      if (!product.photo?.data) throw fail(409, 'This product is missing its photo. Ask the business to update it.');
      const purchaseId = new mongoose.Types.ObjectId();
      const claimed = await Request.findOneAndUpdate({ ...ids(req), status: 'closed', deletedAt: null, purchaseId: null,
        acceptedResponseId: response._id }, { $set: { status: 'closed', purchaseId, fulfilledAt: new Date() } },
      { returnDocument: 'after', runValidators: true, session });
      if (!claimed) throw fail(409, 'The request changed. Refresh and try again.');
      const stocked = await Product.findOneAndUpdate({ _id: product._id, status: 'active', price: product.price, stock: { $gte: 1 } },
        { $inc: { stock: -1 } }, { returnDocument: 'after', runValidators: true, session });
      if (!stocked) throw fail(409, 'The stock or price changed. Refresh and choose an available item.');
      // The last-unit purchase pauses prepaid Style Feed promotion in the same
      // MongoDB transaction as the stock decrement, receipt, and wardrobe item.
      if (StyleVideo && stocked.stock === 0) {
        await syncProductBoosts(StyleVideo, product._id, false, { session });
      }
      const [item] = await Item.create([{ ...clothing, userId: req.communityActor.id, size,
        sourceProductId: String(product._id), purchaseId: String(purchaseId),
        photo: { data: product.photo.data, contentType: product.photo.contentType },
      }], { session });
      const [saved] = await Purchase.create([{ _id: purchaseId, requestId: request._id, responseId: response._id,
        consumerId: req.communityActor.id, businessId: product.businessId, businessName: product.businessName,
        productId: String(product._id), productName: product.name, price: product.price, size,
        colour: clothing.colour, material: clothing.material, wardrobeItemId: String(item._id), mode: 'demo',
      }], { session });
      return { purchase: receipt(saved), alreadyPurchased: false };
    });
    res.status(result.alreadyPurchased ? 200 : 201).json(result);
  }
  return { accept, cancelAcceptance, getPurchase, purchase };
}
module.exports = { createRequestCommerceController };
