const express = require('express');
const mongoose = require('mongoose');
const { randomInt } = require('node:crypto');
const StyleVideo = require('../models/StyleVideo');
const Business = require('../models/Business');
const Product = require('../models/Product');
const CoinTransaction = require('../models/CoinTransaction');
const { requireBusiness } = require('../middleware/business');
const { trustedBrowser } = require('../middleware/authentication');
const { boostIsLive, remainingBoostMs, syncProductBoosts } = require('../services/styleBoostAvailability');
const { countUpToLimit } = require('../services/styleFeedCounting');

const router = express.Router();
const MAX_VIDEO_BYTES = 8 * 1024 * 1024; // MongoDB document cap is 16 MB.
const BOOST_COINS = 20;
const BOOST_DAYS = 7;
const objectId = value => mongoose.isObjectIdOrHexString(value);
const error = (status, message) => Object.assign(new Error(message), { status });
const sponsored = item => boostIsLive(item);
const publicVideo = (item, product, business, userId) => ({
  videoId: String(item._id), businessId: item.businessId, productId: item.productId,
  businessName: business?.businessName || product?.businessName || 'Business',
  productName: product?.name || 'Product', productPrice: product?.price ?? null,
  productAvailable: Boolean(product && product.status === 'active' && product.stock > 0),
  productListed: Boolean(product && product.status === 'active'),
  productImageURL: product ? `/api/catalog/products/${product._id}/image` : null,
  caption: item.caption, videoURL: `/api/style-feed/${item._id}/video`,
  boosted: sponsored(item), boostedUntil: item.boostedUntil,
  boostPaused: Boolean(item.boostPausedAt && remainingBoostMs(item) > 0),
  boostRemainingMs: remainingBoostMs(item),
  liked: Boolean(userId && item.likesBy?.includes(userId)), likes: item.likes,
  views: item.views, sponsoredImpressions: item.sponsoredImpressions,
  uniqueReach: item.uniqueReach, productClicks: item.productClicks,
  storeClicks: item.storeClicks, createdAt: item.createdAt,
  boostStartedAt: item.boostStartedAt || null,
  // Lifetime totals are retained, and sinceBoost measures changes following the latest spend.
  sinceBoost: item.boostStartedAt ? Object.fromEntries(
    ['views', 'likes', 'productClicks', 'storeClicks', 'sponsoredImpressions', 'uniqueReach']
      .map(key => [key, key === 'uniqueReach' ? (item.boostUniqueReach || 0) : Math.max(0, (item[key] || 0) - (item.boostBaseline?.[key] || 0))])
  ) : null
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
  // When no organic videos exist, preserve a usable feed of sponsored clips.
  if (!organic.length) return promos;
  let i = 0, j = 0;
  while (i < organic.length) {
    let organicInGroup = 0;
    for (; organicInGroup < 3 && i < organic.length; organicInGroup++) result.push(organic[i++]);
    // Avoid a string of paid videos at the end of a feed. With fewer than
    // three organic clips overall, allow one fallback sponsored placement.
    // Other active boosts remain eligible on the NEXT randomized feed load.
    if (j < promos.length && (organicInGroup === 3 || organic.length < 3)) result.push(promos[j++]);
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
  // When paid placements outnumber sponsored slots, prioritise campaigns with
  // fewer measured impressions *since their latest boost*. Shuffle first so
  // equal-impression campaigns rotate randomly across refreshes.
  const promos = shuffleCopy(candidates.filter(sponsored), pick);
  const campaignImpressions = video => Math.max(0, (video.sponsoredImpressions || 0) - (video.boostBaseline?.sponsoredImpressions || 0));
  promos.sort((a, b) => campaignImpressions(a) - campaignImpressions(b));
  if (organic.length) avoidFirstRepeat(organic, previousFirst);
  else avoidFirstRepeat(promos, previousFirst);
  return interleave(organic, promos);
}

router.get('/', async (req, res) => {
  // Retain recent videos for discovery, PLUS ALL currently promoted posts.
  // A prepaid clip must not disappear merely because 120 newer uploads arrived.
  const [recent, boosted, paused] = await Promise.all([
    StyleVideo.find({}).sort({ createdAt: -1 }).limit(120).select('+likesBy'),
    StyleVideo.find({ boostedUntil: { $gt: new Date() }, boostPausedAt: null }).select('+likesBy'),
    // Pick up older paused campaigns too. This also restores boosts paused by
    // the previous version when a product sold out (even if it remains sold out).
    StyleVideo.find({ boostPausedAt: { $ne: null } }).select('+likesBy'),
  ]);
  const uniqueVideos = new Map([...recent, ...boosted, ...paused].map(video => [String(video._id), video]));
  const all = [...uniqueVideos.values()];
  const ids = [...new Set(all.map(v => v.productId))].filter(objectId);
  // A sold-out product still appears in the feed: viewers can discover the brand
  // and visit the listing, but checkout correctly blocks buying unavailable stock.
  const products = await Product.find({ _id: { $in: ids }, status: 'active' });
  const byProduct = new Map(products.map(p => [String(p._id), p]));
  // Pause hidden listings, and resume previously paused campaigns when a listing
  // is active again. Never pause merely because a visible product has sold out.
  const pauseIds = new Set(all.filter(video => remainingBoostMs(video) > 0 && !video.boostPausedAt && !byProduct.has(video.productId)).map(video => video.productId));
  const resumeIds = new Set(all.filter(video => video.boostPausedAt && byProduct.has(video.productId)).map(video => video.productId));
  for (const id of pauseIds) await syncProductBoosts(StyleVideo, id, false);
  for (const id of resumeIds) {
    const at = new Date();
    // Keep the returned in-memory items in step with the database this load.
    const toResume = all.filter(video => video.productId === id && video.boostPausedAt);
    await syncProductBoosts(StyleVideo, id, true, { at });
    for (const video of toResume) {
      video.boostedUntil = new Date(at.getTime() + remainingBoostMs(video, at));
      video.boostPausedAt = null;
    }
  }
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
  // Reconcile pre-existing listings and any stock changes made by older code.
  // Pauses start when first detected; we cannot reconstruct past downtime.
  for (const product of products) {
    await syncProductBoosts(StyleVideo, product._id, product.status === 'active');
  }
  const refreshed = await StyleVideo.find({ businessId: String(business._id) }).sort({ createdAt: -1 });
  res.set('Cache-Control', 'no-store');
  res.json({ videos: refreshed.map(v => publicVideo(v, byProduct.get(v.productId), business, req.user.id)),
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
  // Data URI MIME labels are user-controlled: check the actual container header.
  const validContainer = match[1] === 'video/mp4'
    ? data.length >= 12 && data.toString('ascii', 4, 8) === 'ftyp'
    : data.length >= 4 && data.subarray(0, 4).equals(Buffer.from([0x1A, 0x45, 0xDF, 0xA3]));
  if (!validContainer) throw error(400, 'This file is not a valid MP4 or WebM video.');
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
  if (remainingBoostMs(video) > 0) {
    throw error(409, 'This video still has unused paid promotion time. Keep it until the boost finishes.');
  }
  await video.deleteOne();
  res.json({ message: 'Video deleted.' });
});

router.post('/:id/boost', requireBusiness, trustedBrowser, async (req, res) => {
  const { video, business } = await ownedVideo(req);
  const product = await Product.findOne({ _id: video.productId, status: 'active', businessId: String(business._id), stock: { $gt: 0 } });
  if (!product) throw error(409, 'This video needs an active, in-stock product before you can boost it.');
  // One transaction: no lost coins if the promotion or ledger write fails.
  const result = await mongoose.connection.transaction(async session => {
    const current = await StyleVideo.findOne({ _id: video._id, businessId: String(business._id) }).session(session);
    if (!current) throw error(404, 'Video not found.');
    const newWallet = await Business.findOneAndUpdate({ _id: business._id, coins: { $gte: BOOST_COINS } },
      { $inc: { coins: -BOOST_COINS } }, { returnDocument: 'after', session });
    if (!newWallet) throw error(409, `You need ${BOOST_COINS} coins to boost. Top up on the Promotions page.`);
    const now = new Date();
    const remaining = remainingBoostMs(current, now);
    const boostedUntil = new Date(now.getTime() + remaining + BOOST_DAYS * 86400000);
    const baseline = Object.fromEntries(
      ['views', 'likes', 'productClicks', 'storeClicks', 'sponsoredImpressions', 'uniqueReach']
        .map(key => [key, current[key] || 0]));
    const updated = await StyleVideo.findOneAndUpdate({ _id: current._id, businessId: String(business._id), boostedUntil: current.boostedUntil, boostPausedAt: current.boostPausedAt || null },
      { $set: { boostedUntil, boostStartedAt: now, boostBaseline: baseline, boostSeenBy: [], boostUniqueReach: 0, boostImpressionsBy: [] }, $unset: { boostPausedAt: '' } },
      { returnDocument: 'after', session, runValidators: true });
    if (!updated) throw error(409, 'This promotion was changed by another action. Please retry.');
    await CoinTransaction.create([{ businessId: String(business._id), productId: video.productId,
      type: 'boost', amount: -BOOST_COINS, balanceAfter: newWallet.coins, note: `Style Feed video boost: ${product.name}` }], { session });
    return { coins: newWallet.coins, video: publicVideo(updated, product, business, req.user.id) };
  });
  res.json(result);
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
    if (!sponsored(video)) return res.json({ counted: false });
    // A repeat visit is another impression (up to ten per person and boost).
    // Unique reach remains one viewer per campaign, independent of repeats.
    const counted = await countUpToLimit(StyleVideo, video._id, req.user.id, 'sponsoredImpressions', 'boostImpressionsBy');
    if (!counted) return res.json({ counted: false, limitReached: true });
    const first = await StyleVideo.updateOne({ _id: video._id, sponsoredSeenBy: { $ne: req.user.id } },
      { $addToSet: { sponsoredSeenBy: req.user.id }, $inc: { uniqueReach: 1 } });
    const campaignFirst = await StyleVideo.updateOne({ _id: video._id, boostSeenBy: { $ne: req.user.id } },
      { $addToSet: { boostSeenBy: req.user.id }, $inc: { boostUniqueReach: 1 } });
    return res.json({ counted: true, unique: first.modifiedCount === 1, uniqueThisBoost: campaignFirst.modifiedCount === 1 });
  }
  if (type === 'view') {
    const counted = await countUpToLimit(StyleVideo, video._id, req.user.id, 'views', 'viewedBy');
    return res.json({ counted, limitReached: !counted });
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
