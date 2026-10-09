const mongoose = require('mongoose');
const { badRequest, singaporeToday } = require('../communityValidation');
const rules = require('../businessValidation');

const defaultModels = {
  Business: require('../models/Business'),
  Product: require('../models/Product'),
  CoinTransaction: require('../models/CoinTransaction'),
  SkipFeedback: require('../models/SkipFeedback'),
  Request: require('../models/OutfitRequest'),
  Response: require('../models/RequestResponse'),
  User: require('../models/User')
};

function failure(status, message) { const error = new Error(message); error.status = status; return error; }
function idIsValid(id) { return mongoose.isObjectIdOrHexString(id); }
function percent(part, whole) { return whole ? Math.round((part / whole) * 1000) / 10 : 0; }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function queryText(value, max = 80) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > max) throw badRequest('One of the filters is invalid.');
  return value.trim();
}
function pageNumber(value) {
  const text = queryText(value, 8) || '1';
  if (!/^[1-9]\d{0,4}$/.test(text)) throw badRequest('Choose a valid page.');
  return Number(text);
}
// Count how often each value appears, biggest first, with a percentage.
function breakdown(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count, percent: percent(count, values.length) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// How well a product fits a shopper's style survey (Person 1's survey saves these on the User).
// Returns a score for sorting and plain-English reasons for the "Why this suits you" panel.
function matchFor(product, prefs) {
  const reasons = [];
  let score = 0;
  if (!prefs) return { score, reasons };
  if (prefs.preferredStyles?.includes(product.style)) { score += 3; reasons.push(`Matches your ${product.style.toLowerCase()} style`); }
  const occasion = (product.occasions || []).find(item => prefs.activities?.some(activity => activity.toLowerCase() === item.toLowerCase()));
  if (occasion) { score += 2; reasons.push(`Good for ${occasion.toLowerCase()}`); }
  if (prefs.budget) {
    if (product.price <= prefs.budget) { score += 2; reasons.push(`Within your S$${prefs.budget} budget`); }
    else if (product.price > prefs.budget * 1.2) score -= 2;
  }
  if (product.premium) score += 1.5;
  else if (product.boosted) score += 1;
  return { score, reasons };
}

function businessJson(doc) {
  return {
    businessId: String(doc._id), businessName: doc.businessName, description: doc.description,
    styles: doc.styles, contact: doc.contact, coins: doc.coins,
    logoURL: doc.logo?.contentType ? `/api/catalog/businesses/${doc._id}/logo` : null
  };
}
function productJson(doc) {
  return {
    productId: String(doc._id), businessId: doc.businessId, businessName: doc.businessName,
    name: doc.name, price: doc.price, style: doc.style, category: doc.category,
    occasions: doc.occasions, sizes: doc.sizes, stock: doc.stock, description: doc.description,
    status: doc.status, boosted: doc.boosted, boostedUntil: doc.boostedUntil || null,
    premium: doc.premium, premiumUntil: doc.premiumUntil || null, views: doc.views,
    imageURL: `/api/catalog/products/${doc._id}/image`, createdAt: doc.createdAt
  };
}
function requestJson(doc) {
  return {
    requestId: String(doc._id), consumerName: doc.consumerName, title: doc.title, occasion: doc.occasion,
    description: doc.description, budget: doc.budget, preferredStyle: doc.preferredStyle,
    deadline: doc.deadline, status: doc.status, createdAt: doc.createdAt
  };
}

function createBusinessController(models = defaultModels) {
  const { Business, Product, CoinTransaction, SkipFeedback, Request, Response, User } = models;

  // Promotions last 7 days. Switch off any that have run out before reading products.
  async function expirePromotions(filter = {}) {
    const now = new Date();
    await Promise.all([
      Product.updateMany({ ...filter, boosted: true, boostedUntil: { $lte: now } }, { $set: { boosted: false } }),
      Product.updateMany({ ...filter, premium: true, premiumUntil: { $lte: now } }, { $set: { premium: false } })
    ]);
  }

  async function myBusiness(req) {
    const business = await Business.findOne({ ownerId: req.user.id });
    if (!business) throw failure(409, 'Set up your business profile first.');
    return business;
  }

  async function myProduct(req, business) {
    if (!idIsValid(req.params.id)) throw failure(404, 'Product not found.');
    const product = await Product.findOne({ _id: req.params.id, businessId: String(business._id) });
    if (!product) throw failure(404, 'Product not found.');
    return product;
  }

  // Takes coins only if the wallet has enough, in one database step, then records it.
  async function changeCoins(business, type, amount, extra = {}) {
    const filter = { _id: business._id };
    if (amount < 0) filter.coins = { $gte: -amount };
    const updated = await Business.findOneAndUpdate(filter, { $inc: { coins: amount } }, { returnDocument: 'after' });
    if (!updated) throw failure(409, `You need ${-amount} coins for this. Buy more coins on the Promotions page.`);
    await CoinTransaction.create({ businessId: String(business._id), type, amount, balanceAfter: updated.coins, ...extra });
    return updated;
  }

  // ---------- Business profile ----------
  async function getProfile(req, res) {
    const business = await Business.findOne({ ownerId: req.user.id });
    res.json({ business: business ? businessJson(business) : null });
  }

  async function saveProfile(req, res) {
    const input = rules.profileInput(req.body);
    if (!input.logo) delete input.logo;
    let business = await Business.findOne({ ownerId: req.user.id });
    if (business) {
      business.set(input);
      await business.save();
      // Keep the store name on products in step with the profile.
      await Product.updateMany({ businessId: String(business._id) }, { $set: { businessName: business.businessName } });
      return res.json({ business: businessJson(business) });
    }
    try {
      business = await Business.create({ ...input, ownerId: req.user.id });
    } catch (error) {
      if (error.code === 11000) throw failure(409, 'This account already has a business profile. Refresh the page.');
      throw error;
    }
    await CoinTransaction.create({ businessId: String(business._id), type: 'starting', amount: business.coins, balanceAfter: business.coins, note: 'Welcome coins' });
    res.status(201).json({ business: businessJson(business) });
  }

  // ---------- Products ----------
  async function getMyProducts(req, res) {
    const business = await myBusiness(req);
    await expirePromotions({ businessId: String(business._id) });
    const products = await Product.find({ businessId: String(business._id) }).sort({ createdAt: -1 });
    res.json({ products: products.map(productJson), freeListings: rules.FREE_LISTINGS, extraListingCost: rules.COIN_COSTS['extra-listing'] });
  }

  async function getMyProduct(req, res) {
    const business = await myBusiness(req);
    res.json({ product: productJson(await myProduct(req, business)) });
  }

  async function createProduct(req, res) {
    let business = await myBusiness(req);
    const input = rules.productInput(req.body, { photoRequired: true });
    // The first few listings are free. Each one after that costs coins.
    const count = await Product.countDocuments({ businessId: String(business._id) });
    const product = new Product({ ...input, businessId: String(business._id), businessName: business.businessName });
    await product.validate();
    if (count >= rules.FREE_LISTINGS) {
      business = await changeCoins(business, 'extra-listing', -rules.COIN_COSTS['extra-listing'],
        { productId: String(product._id), note: `Extra listing: ${input.name}` });
    }
    await product.save();
    res.status(201).json({ product: productJson(product), coins: business.coins });
  }

  async function updateProduct(req, res) {
    const business = await myBusiness(req);
    const product = await myProduct(req, business);
    const input = rules.productInput(req.body, { photoRequired: false });
    if (!input.photo) delete input.photo;
    product.set(input);
    await product.save();
    res.json({ product: productJson(product) });
  }

  async function deleteProduct(req, res) {
    const business = await myBusiness(req);
    const product = await myProduct(req, business);
    await Product.deleteOne({ _id: product._id });
    res.json({ message: 'Product deleted.' });
  }

  // ---------- Coins ----------
  async function getWallet(req, res) {
    const business = await myBusiness(req);
    const transactions = await CoinTransaction.find({ businessId: String(business._id) }).sort({ timestamp: -1 }).limit(50);
    res.json({
      coins: business.coins, costs: rules.COIN_COSTS, packages: rules.COIN_PACKAGES, promotionDays: rules.PROMOTION_DAYS,
      transactions: transactions.map(t => ({ transactionId: String(t._id), type: t.type, amount: t.amount, balanceAfter: t.balanceAfter, note: t.note, productId: t.productId, timestamp: t.timestamp }))
    });
  }

  // Simulated payment for the demo: no card details, the wallet is simply topped up.
  async function purchaseCoins(req, res) {
    const business = await myBusiness(req);
    const amount = req.body?.coins;
    if (!rules.COIN_PACKAGES.includes(amount)) throw badRequest('Choose one of the coin packages.');
    const updated = await changeCoins(business, 'purchase', amount, { note: `Bought ${amount} coins (simulated payment)` });
    res.json({ coins: updated.coins });
  }

  function promote(kind) {
    return async (req, res) => {
      const business = await myBusiness(req);
      const product = await myProduct(req, business);
      if (product.status !== 'active') throw badRequest('Show this product in the store before promoting it.');
      const cost = rules.COIN_COSTS[kind];
      const label = kind === 'boost' ? 'Boost' : 'Premium placement';
      const updated = await changeCoins(business, kind, -cost, { productId: String(product._id), note: `${label}: ${product.name}` });
      // Buying again while a promotion is running adds another 7 days.
      const untilField = kind === 'boost' ? 'boostedUntil' : 'premiumUntil';
      const flagField = kind === 'boost' ? 'boosted' : 'premium';
      const start = product[flagField] && product[untilField] > new Date() ? product[untilField] : new Date();
      product[flagField] = true;
      product[untilField] = new Date(start.getTime() + rules.PROMOTION_DAYS * 24 * 60 * 60 * 1000);
      await product.save();
      res.json({ product: productJson(product), coins: updated.coins });
    };
  }

  // ---------- Dashboard ----------
  async function getDashboard(req, res) {
    const business = await myBusiness(req);
    const businessId = String(business._id);
    await expirePromotions({ businessId });
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [products, skips, recentRequests] = await Promise.all([
      Product.find({ businessId }),
      SkipFeedback.find({ businessId }),
      Request.find({ createdAt: { $gte: since } })
    ]);

    const totalViews = products.reduce((sum, p) => sum + (p.views || 0), 0);
    const skipsByProduct = new Map();
    for (const skip of skips) {
      if (!skipsByProduct.has(skip.productId)) skipsByProduct.set(skip.productId, []);
      skipsByProduct.get(skip.productId).push(skip.reason);
    }
    const productPerformance = products.map(p => {
      const reasons = skipsByProduct.get(String(p._id)) || [];
      return {
        productId: String(p._id), name: p.name, price: p.price, style: p.style, stock: p.stock, status: p.status,
        boosted: p.boosted, premium: p.premium, views: p.views || 0, skips: reasons.length,
        skipRate: percent(reasons.length, p.views || 0), topSkipReason: breakdown(reasons)[0]?.label || null
      };
    }).sort((a, b) => b.views - a.views);

    // Unmet demand: open requests that no business has replied to yet.
    const today = singaporeToday();
    const openRequests = recentRequests.filter(r => r.status === 'open' && r.deadline >= today);
    const answered = new Set((await Response.find({ requestId: { $in: openRequests.map(r => r._id) } })).map(r => String(r.requestId)));
    const unmet = openRequests.filter(r => !answered.has(String(r._id)));

    // Competition: compare views with other businesses that sell the same styles.
    const competitors = await Business.find({ styles: { $in: business.styles } });
    const viewTotals = await Product.aggregate([
      { $match: { businessId: { $in: competitors.map(c => String(c._id)) } } },
      { $group: { _id: '$businessId', views: { $sum: '$views' }, products: { $sum: 1 } } }
    ]);
    const viewsFor = new Map(viewTotals.map(row => [row._id, row]));
    const competition = business.styles.map(style => {
      const rivals = competitors.filter(c => c.styles.includes(style))
        .map(c => ({ id: String(c._id), views: viewsFor.get(String(c._id))?.views || 0, products: viewsFor.get(String(c._id))?.products || 0 }))
        .sort((a, b) => b.views - a.views);
      const average = rivals.length ? rivals.reduce((sum, r) => sum + r.views, 0) / rivals.length : 0;
      return {
        style, businessesInStyle: rivals.length, rank: rivals.findIndex(r => r.id === businessId) + 1,
        yourViews: totalViews, averageViews: Math.round(average)
      };
    });

    res.json({
      business: businessJson(business),
      totals: {
        products: products.length, activeProducts: products.filter(p => p.status === 'active').length,
        views: totalViews, skips: skips.length, skipRate: percent(skips.length, totalViews),
        promoted: products.filter(p => p.boosted || p.premium).length
      },
      skipReasons: breakdown(skips.map(s => s.reason)),
      demand: {
        requestsLast30Days: recentRequests.length,
        byStyle: breakdown(recentRequests.map(r => r.preferredStyle)),
        topOccasions: breakdown(recentRequests.map(r => r.occasion.trim().toLowerCase())).slice(0, 5),
        averageBudget: recentRequests.length ? Math.round(recentRequests.reduce((s, r) => s + r.budget, 0) / recentRequests.length * 100) / 100 : 0,
        unmetCount: unmet.length,
        unmetInMyStyles: unmet.filter(r => business.styles.includes(r.preferredStyle)).length
      },
      productPerformance,
      competition
    });
  }

  // ---------- Request board (reads Person 3's outfit requests) ----------
  async function getRequests(req, res) {
    const business = await myBusiness(req);
    const filter = { status: 'open', deadline: { $gte: singaporeToday() } };
    const style = queryText(req.query.style);
    if (style) filter.preferredStyle = style;
    else if (req.query.myStyles === 'true') filter.preferredStyle = { $in: business.styles };
    const search = queryText(req.query.search);
    if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };
    const page = pageNumber(req.query.page), pageSize = 12;
    const [items, total] = await Promise.all([
      Request.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      Request.countDocuments(filter)
    ]);
    const replies = await Response.find({ requestId: { $in: items.map(r => r._id) } });
    res.json({
      page, pageSize, total,
      requests: items.map(item => {
        const forThis = replies.filter(r => String(r.requestId) === String(item._id));
        return {
          ...requestJson(item), responseCount: forThis.length,
          myResponses: forThis.filter(r => r.businessId === String(business._id)).map(r => ({ productId: r.productId, productName: r.productName, message: r.message }))
        };
      })
    });
  }

  async function respondToRequest(req, res) {
    const business = await myBusiness(req);
    if (!idIsValid(req.params.id)) throw failure(404, 'Request not found.');
    const request = await Request.findById(req.params.id);
    if (!request) throw failure(404, 'Request not found.');
    if (request.status !== 'open' || request.deadline < singaporeToday()) throw badRequest('This request is no longer open.');
    const input = rules.responseInput(req.body);
    if (!idIsValid(input.productId)) throw badRequest('Choose one of your products.');
    const product = await Product.findOne({ _id: input.productId, businessId: String(business._id), status: 'active' });
    if (!product) throw badRequest('Choose one of your products that is showing in the store.');
    if (await Response.findOne({ requestId: request._id, businessId: String(business._id), productId: String(product._id) })) {
      throw failure(409, 'You have already suggested this product for this request.');
    }
    // Product details are copied so the customer still sees them if the product changes later.
    const reply = await Response.create({
      requestId: request._id, businessId: String(business._id), businessName: business.businessName,
      productId: String(product._id), productName: product.name, productPrice: product.price, message: input.message
    });
    res.status(201).json({ response: { responseId: String(reply._id), productId: reply.productId, productName: reply.productName, message: reply.message } });
  }

  // ---------- Catalogue for shoppers (Person 1's Store can call these) ----------
  // Survey answers for the signed-in shopper (null if they have not done the survey).
  async function preferencesFor(req) {
    if (!User || req.user?.role !== 'consumer') return null;
    const user = await User.findById(req.user.id);
    if (!user || (!user.preferredStyles?.length && !user.activities?.length)) return null;
    return { preferredStyles: user.preferredStyles || [], activities: user.activities || [], budget: user.budget || null };
  }

  async function getCatalog(req, res) {
    await expirePromotions();
    const filter = { status: 'active' };
    for (const field of ['style', 'category']) {
      const value = queryText(req.query[field]);
      if (value) filter[field] = value;
    }
    const occasion = queryText(req.query.occasion);
    if (occasion) filter.occasions = { $regex: `^${escapeRegex(occasion)}$`, $options: 'i' };
    const search = queryText(req.query.search);
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
    const maximum = queryText(req.query.maxPrice, 12);
    if (maximum) {
      const amount = Number(maximum);
      if (!Number.isFinite(amount) || amount < 0) throw badRequest('Maximum price must be zero or above.');
      filter.price = { $lte: amount };
    }
    const page = pageNumber(req.query.page), pageSize = 12;
    const prefs = await preferencesFor(req);

    // "For you": rank every matching product by the shopper's survey answers,
    // and leave out anything they already skipped.
    if (req.query.forYou === 'true' && prefs) {
      const skipped = await SkipFeedback.find({ userId: req.user.id });
      if (skipped.length) filter._id = { $nin: skipped.map(skip => skip.productId).filter(idIsValid) };
      const all = await Product.find(filter);
      const ranked = all.map(product => ({ product, ...matchFor(product, prefs) }))
        .sort((a, b) => b.score - a.score || b.product.createdAt - a.product.createdAt);
      const slice = ranked.slice((page - 1) * pageSize, page * pageSize);
      return res.json({
        products: slice.map(row => ({ ...productJson(row.product), reasons: row.reasons })),
        total: ranked.length, page, pageSize, personalised: true, preferences: prefs
      });
    }

    // Everything else: premium placement first, then boosted, then newest.
    const [items, total] = await Promise.all([
      Product.find(filter).sort({ premium: -1, boosted: -1, createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      Product.countDocuments(filter)
    ]);
    res.json({ products: items.map(product => ({ ...productJson(product), reasons: matchFor(product, prefs).reasons })), total, page, pageSize, personalised: false, preferences: prefs });
  }

  async function getCatalogProduct(req, res) {
    if (!idIsValid(req.params.id)) throw failure(404, 'Product not found.');
    const product = await Product.findOne({ _id: req.params.id, status: 'active' });
    if (!product) throw failure(404, 'Product not found.');
    // Each shopper visit to the detail page counts as one view on the dashboard.
    const owner = await Business.findOne({ _id: product.businessId, ownerId: req.user.id });
    if (!owner) {
      await Product.updateOne({ _id: product._id }, { $inc: { views: 1 } });
      product.views += 1;
    }
    const business = await Business.findById(product.businessId);
    const prefs = await preferencesFor(req);
    res.json({
      product: { ...productJson(product), reasons: matchFor(product, prefs).reasons },
      business: business ? { businessId: String(business._id), businessName: business.businessName, description: business.description, styles: business.styles, logoURL: businessJson(business).logoURL } : null,
      preferences: prefs
    });
  }

  // "Why did you skip?" answer from the product page. Feeds the business dashboard.
  async function skipProduct(req, res) {
    if (req.user.role !== 'consumer') throw failure(403, 'Only shoppers can skip products.');
    if (!idIsValid(req.params.id)) throw failure(404, 'Product not found.');
    const product = await Product.findOne({ _id: req.params.id, status: 'active' });
    if (!product) throw failure(404, 'Product not found.');
    const reason = req.body?.reason;
    if (!SkipFeedback.SKIP_REASONS.includes(reason)) throw badRequest('Choose one of the reasons.');
    await SkipFeedback.create({ userId: req.user.id, productId: String(product._id), businessId: product.businessId, reason });
    res.status(201).json({ message: 'Thanks, we’ll show you fewer pieces like this.' });
  }

  async function getProductImage(req, res) {
    if (!idIsValid(req.params.id)) throw failure(404, 'Photo not found.');
    const product = await Product.findById(req.params.id).select('+photo.data');
    if (!product?.photo?.data) throw failure(404, 'Photo not found.');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, max-age=300');
    res.type(product.photo.contentType).send(product.photo.data);
  }

  async function getBusinessLogo(req, res) {
    if (!idIsValid(req.params.id)) throw failure(404, 'Logo not found.');
    const business = await Business.findById(req.params.id).select('+logo.data');
    if (!business?.logo?.data) throw failure(404, 'Logo not found.');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, max-age=300');
    res.type(business.logo.contentType).send(business.logo.data);
  }

  return {
    getProfile, saveProfile, getMyProducts, getMyProduct, createProduct, updateProduct, deleteProduct,
    getWallet, purchaseCoins, boostProduct: promote('boost'), premiumProduct: promote('premium'),
    getDashboard, getRequests, respondToRequest,
    getCatalog, getCatalogProduct, skipProduct, getProductImage, getBusinessLogo
  };
}

module.exports = { createBusinessController, defaultModels };
