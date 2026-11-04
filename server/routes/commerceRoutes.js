const express = require('express');
const { checkout, createShoppingController } = require('../controllers/commerceController');
const { requireAuth, trustedBrowser } = require('../middleware/authentication');

function createCommerceRouter(models) {
  const router = express.Router();
  const shopping = createShoppingController(models);
  router.use(requireAuth);
  router.use((req, res, next) => {
    if (req.user.role !== 'consumer') return res.status(403).json({ message: 'Only customer accounts can use shopping features.' });
    // This header is an account-change precondition. Ownership always comes from req.user.
    if (req.get('X-Shop-User') && req.get('X-Shop-User') !== req.user.id)
      return res.status(409).json({ code: 'ACCOUNT_CHANGED', message: 'Your signed-in account changed. Please reload the page.' });
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  const run = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
  router.get('/shop', run(shopping.getShop));
  router.put('/likes/:productId', trustedBrowser, run(shopping.setLike));
  router.put('/cart', trustedBrowser, run(shopping.setCart));
  router.put('/cart/:key', trustedBrowser, run(shopping.updateCartItem));
  router.post('/checkout', trustedBrowser, run(checkout));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Shopping data could not be saved. Please try again.' });
  });
  return router;
}
module.exports = createCommerceRouter();
module.exports.createCommerceRouter = createCommerceRouter;
