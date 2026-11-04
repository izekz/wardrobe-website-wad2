const express = require('express');
const { createBusinessController, defaultModels } = require('../controllers/businessController');
const { requireBusiness, handleBusinessError } = require('../middleware/business');
const { ensureSizeStock } = require('../services/sizeStock');

// Person 4: before the first portal or store request, give older products
// (made before stock per size) their old stock in every size. Runs once.
const upgradeOldStock = models => async (req, res, next) => {
  try { await ensureSizeStock(models.Product); next(); } catch (error) { next(error); }
};

// Person 4: business portal API, mounted at /api/business (business accounts only).
function createBusinessRouter(models = defaultModels) {
  const router = express.Router();
  const controller = createBusinessController(models);
  router.use(requireBusiness);
  router.use(upgradeOldStock(models));

  router.get('/profile', controller.getProfile);
  router.put('/profile', controller.saveProfile);

  router.get('/products', controller.getMyProducts);
  router.post('/products', controller.createProduct);
  router.get('/products/:id', controller.getMyProduct);
  router.put('/products/:id', controller.updateProduct);
  router.delete('/products/:id', controller.deleteProduct);
  router.post('/products/:id/boost', controller.boostProduct);
  router.post('/products/:id/premium', controller.premiumProduct);

  router.get('/coins', controller.getWallet);
  router.post('/coins/purchase', controller.purchaseCoins);

  router.get('/dashboard', controller.getDashboard);

  router.get('/requests', controller.getRequests);
  router.post('/requests/:id/responses', controller.respondToRequest);

  router.use(handleBusinessError);
  return router;
}

// Person 4: read-only product catalogue for any logged-in user, mounted at /api/catalog.
// Person 1's Store and Product Detail pages can use these instead of writing their own.
function createCatalogRouter(models = defaultModels) {
  const router = express.Router();
  const controller = createBusinessController(models);
  router.use(upgradeOldStock(models));
  router.get('/products', controller.getCatalog);
  router.get('/businesses/:id', controller.getCatalogBusiness);
  router.get('/products/:id', controller.getCatalogProduct);
  router.post('/products/:id/skip', controller.skipProduct);
  router.get('/products/:id/image', controller.getProductImage);
  router.get('/products/:id/colour-image/:colour', controller.getProductColourImage);
  router.get('/products/:id/size-image', controller.getProductSizeImage);
  router.get('/businesses/:id/logo', controller.getBusinessLogo);
  router.use(handleBusinessError);
  return router;
}

module.exports = { createBusinessRouter, createCatalogRouter, defaultModels };
