const express = require('express');
const mongoose = require('mongoose');
const { randomInt } = require('node:crypto');
const StyleVideo = require('../models/StyleVideo');
const Business = require('../models/Business');
const Product = require('../models/Product');
const CoinTransaction = require('../models/CoinTransaction');
const { requireBusiness } = require('../middleware/business');
const { trustedBrowser } = require('../middleware/authentication');

const router = express.Router();
const MAX_VIDEO_BYTES = 8 * 1024 * 1024; // MongoDB document cap is 16 MB.
const BOOST_COINS = 20;
const BOOST_DAYS = 7;
const objectId = value => mongoose.isObjectIdOrHexString(value);
const error = (status, message) => Object.assign(new Error(message), { status });
const sponsored = item => Boolean(item.boostedUntil && new Date(item.boostedUntil) > new Date());
const publicVideo = (item, product, business, userId) => ({
  videoId: String(item._id), businessId: item.businessId, productId: item.productId,
  businessName: business?.businessName || product?.businessName || 'Business',
  productName: product?.name || 'Product', productPrice: product?.price ?? null,
  productAvailable: Boolean(product && product.status === 'active' && product.stock > 0),
  productImageURL: product ? `/api/catalog/products/${product._id}/image` : null,
  caption: item.caption, videoURL: `/api/style-feed/${item._id}/video`,
  boosted: sponsored(item), boostedUntil: item.boostedUntil,
  liked: Boolean(userId && item.likesBy?.includes(userId)), likes: item.likes,
  views: item.views, sponsoredImpressions: item.sponsoredImpressions,
  uniqueReach: item.uniqueReach, productClicks: item.productClicks,
  storeClicks: item.storeClicks, createdAt: item.createdAt
});

async function ownedVideo(req) {
  const business = await Business.findOne({ ownerId: req.user.id });
  if (!business) throw error(409, 'Set up your business profile first.');
  if (!objectId(req.params.id)) throw error(404, 'Video not found.');
  const video = await StyleVideo.findOne({ _id: req.params.id, businessId: String(business._id) });
  if (!video) throw error(404, 'This video was not found in your account.');
  return { video, business };
}

// Server-owned interleaving: one sponsored post after each three organic posts.
// Each promoted post appears at most once per page load; sponsorship expires automatically.
function interleave(organic, sponsoredVideos) {
  const result = [], promos = [...sponsoredVideos];
  let i = 0, j = 0;
  while (i < organic.length || j < promos.length) {
    for (let n = 0; n < 3 && i < organic.length; n++) result.push(organic[i++]);
    if (j < promos.length) result.push(promos[j++]);
  }
  return result;
}

// The order changes on every feed request; neither the source array nor the database
// sort order is modified. The RNG can be substituted in isolated tests.
function shuffleCopy(items, pick = randomInt) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Avoid showing the same opening video immediately after a browser refresh when
// there's another eligible video in the same slot category.
function avoidFirstRepeat(items, previousFirst) {
  if (items.length < 2 || !previousFirst || String(items[0]._id) !== previousFirst) return items;
  const alternative = items.findIndex((item, i) => i > 0 && String(item._id) !== previousFirst);
  if (alternative !== -1) [items[0], items[alternative]] = [items[alternative], items[0]];
  return items;
}

function randomizedFeed(candidates, previousFirst = '', pick = randomInt) {
  const organic = shuffleCopy(candidates.filter(item => !sponsored(item)), pick);
  const promos = shuffleCopy(candidates.filter(sponsored), pick);
  if (organic.length) avoidFirstRepeat(organic, previousFirst);
  else avoidFirstRepeat(promos, previousFirst);
  return interleave(organic, promos);
}

router.get('/', async (req, res) => {
  const all = await StyleVideo.find({}).sort({ createdAt: -1 }).limit(120).select('+likesBy');
  const ids = [...new Set(all.map(v => v.productId))].filter(objectId);
  const products = await Product.find({ _id: { $in: ids }, status: 'active', stock: { $gt: 0 } });
  const byProduct = new Map(products.map(p => [String(p._id), p]));
  const candidates = all.filter(v => byProduct.has(v.productId));
  const bizIds = [...new Set(candidates.map(v => v.businessId))].filter(objectId);
  const businesses = await Business.find({ _id: { $in: bizIds } });
  const byBusiness = new Map(businesses.map(b => [String(b._id), b]));
  // Shuffle organic and boosted posts independently so paid placements still land
  // after every three organic posts, even though the content changes on refresh.
  const previousFirst = typeof req.query.avoidFirst === 'string' && objectId(req.query.avoidFirst)
    ? req.query.avoidFirst : '';
  const display = randomizedFeed(candidates, previousFirst);
  res.set('Cache-Control', 'no-store');
  res.json({ videos: display.map(v => publicVideo(v, byProduct.get(v.productId), byBusiness.get(v.businessId), req.user.id)),
    boostCoins: BOOST_COINS, boostDays: BOOST_DAYS });
});

router.get('/mine', requireBusiness, async (req, res) => {
  const business = await Business.findOne({ ownerId: req.user.id });
  if (!business) return res.status(409).json({ message: 'Set up your business profile first.' });
  const videos = await StyleVideo.find({ businessId: String(business._id) }).sort({ createdAt: -1 });
  const products = await Product.find({ businessId: String(business._id) });
  const byProduct = new Map(products.map(p => [String(p._id), p]));
  res.set('Cache-Control', 'no-store');
  res.json({ videos: videos.map(v => publicVideo(v, byProduct.get(v.productId), business, req.user.id)),
    coins: business.coins, boostCoins: BOOST_COINS, boostDays: BOOST_DAYS });
});

router.post('/', requireBusiness, trustedBrowser, async (req, res) => {
  const business = await Business.findOne({ ownerId: req.user.id });
  if (!business) throw error(409, 'Set up your business profile first.');
  const { productId, caption, video: submitted } = req.body || {};
  if (!objectId(productId)) throw error(400, 'Choose an existing product.');
  const product = await Product.findOne({ _id: productId, businessId: String(business._id), status: 'active', stock: { $gt: 0 } });
  if (!product) throw error(400, 'Choose one of your visible business products.');
  if (typeof caption !== 'string' || !caption.trim() || caption.trim().length > 200) throw error(400, 'Write a caption under 200 characters.');
  if (typeof submitted !== 'string') throw error(400, 'Upload an MP4 or WebM video.');
  const match = /^data:(video\/mp4|video\/webm);base64,([A-Za-z0-9+/]+={0,2})$/.exec(submitted);
  if (!match) throw error(400, 'Upload a valid MP4 or WebM video.');
  if (match[2].length > Math.ceil(MAX_VIDEO_BYTES * 4 / 3) + 4) throw error(413, 'Keep videos under 8 MB.');
  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > MAX_VIDEO_BYTES) throw error(413, 'Keep videos under 8 MB.');
  const video = await StyleVideo.create({ businessId: String(business._id), productId: String(product._id),
    caption: caption.trim(), video: { data, contentType: match[1] } });
  res.status(201).json({ video: publicVideo(video, product, business, req.user.id) });
});

// Range requests are needed for HTML5 video seeking and autoplay on many browsers.
router.get('/:id/video', async (req, res) => {
  if (!objectId(req.params.id)) return res.sendStatus(404);
  const doc = await StyleVideo.findById(req.params.id).select('+video.data');
  if (!doc) return res.sendStatus(404);
  const data = doc.video?.data;
  if (!data) return res.sendStatus(404);
  const total = data.length;
  res.set({ 'Content-Type': doc.video.contentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=60', 'X-Content-Type-Options': 'nosniff' });
  if (!req.headers.range) { res.set('Content-Length', String(total)); return res.end(data); }
  const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
  if (!match) return res.status(416).set('Content-Range', `bytes */${total}`).end();
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : Math.min(start + 1024 * 1024 - 1, total - 1);
  if (start >= total || end < start || end >= total) return res.status(416).set('Content-Range', `bytes */${total}`).end();
  res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(end - start + 1) });
  res.end(data.subarray(start, end + 1));
});

router.delete('/:id', requireBusiness, trustedBrowser, async (req, res) => {
  const { video } = await ownedVideo(req);
  await video.deleteOne();
  res.json({ message: 'Video deleted.' });
});

router.post('/:id/boost', requireBusiness, trustedBrowser, async (req, res) => {
  const { video, business } = await ownedVideo(req);
  const product = await Product.findOne({ _id: video.productId, status: 'active', businessId: String(business._id), stock: { $gt: 0 } });
  if (!product) throw error(409, 'This video needs an active, in-stock product before you can boost it.');
  const newWallet = await Business.findOneAndUpdate({ _id: business._id, coins: { $gte: BOOST_COINS } },
    { $inc: { coins: -BOOST_COINS } }, { returnDocument: 'after' });
  if (!newWallet) throw error(409, `You need ${BOOST_COINS} coins to boost. Top up on the Promotions page.`);
  const start = sponsored(video) ? new Date(video.boostedUntil) : new Date();
  video.boostedUntil = new Date(start.getTime() + BOOST_DAYS * 86400000);
  await video.save();
  await CoinTransaction.create({ businessId: String(business._id), productId: video.productId,
    type: 'boost', amount: -BOOST_COINS, balanceAfter: newWallet.coins, note: `Style Feed video boost: ${product.name}` });
  res.json({ coins: newWallet.coins, video: publicVideo(video, product, business, req.user.id) });
});

router.post('/:id/like', trustedBrowser, async (req, res) => {
  if (!objectId(req.params.id)) throw error(404, 'Video not found.');
  const userId = req.user.id;
  let video = await StyleVideo.findOneAndUpdate({ _id: req.params.id, likesBy: { $ne: userId } },
    { $addToSet: { likesBy: userId }, $inc: { likes: 1 } }, { returnDocument: 'after' });
  if (video) return res.json({ liked: true, likes: video.likes });
  video = await StyleVideo.findOneAndUpdate({ _id: req.params.id, likesBy: userId },
    { $pull: { likesBy: userId }, $inc: { likes: -1 } }, { returnDocument: 'after' });
  if (!video) throw error(404, 'Video not found.');
  res.json({ liked: false, likes: video.likes });
});

router.post('/:id/event', trustedBrowser, async (req, res) => {
  if (!objectId(req.params.id)) throw error(404, 'Video not found.');
  const type = req.body?.type;
  const field = { view: 'views', product: 'productClicks', store: 'storeClicks', impression: 'sponsoredImpressions' }[type];
  if (!field) throw error(400, 'Unknown interaction.');
  const video = await StyleVideo.findById(req.params.id);
  if (!video) throw error(404, 'Video not found.');
  if (type === 'impression') {
    // Never credit an expired/non-promoted video as paid reach.
    if (!sponsored(video)) return res.json({ counted: false });
    const first = await StyleVideo.updateOne({ _id: video._id, sponsoredSeenBy: { $ne: req.user.id } },
      { $addToSet: { sponsoredSeenBy: req.user.id }, $inc: { uniqueReach: 1 } });
    await StyleVideo.updateOne({ _id: video._id }, { $inc: { sponsoredImpressions: 1 } });
    return res.json({ counted: true, unique: first.modifiedCount === 1 });
  }
  await StyleVideo.updateOne({ _id: video._id }, { $inc: { [field]: 1 } });
  res.json({ counted: true });
});

router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if ([400, 403, 404, 409, 413].includes(err.status)) return res.status(err.status).json({ message: err.message });
  if (err.name === 'ValidationError') return res.status(400).json({ message: 'Check the video details and try again.' });
  console.error('Style Feed request failed:', err.name);
  res.status(500).json({ message: 'Style Feed could not complete the request.' });
});

module.exports = { router, interleave, shuffleCopy, avoidFirstRepeat, randomizedFeed };
