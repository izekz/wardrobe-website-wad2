const express = require('express');
const { createBusinessController, defaultModels } = require('../controllers/businessController');
const { requireBusiness, handleBusinessError } = require('../middleware/business');

// Person 4: business portal API, mounted at /api/business (business accounts only).
function createBusinessRouter(models = defaultModels) {
  const router = express.Router();
  const controller = createBusinessController(models);
  router.use(requireBusiness);

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
  router.get('/products', controller.getCatalog);
  router.get('/products/:id', controller.getCatalogProduct);
  router.post('/products/:id/skip', controller.skipProduct);
  router.get('/products/:id/image', controller.getProductImage);
  router.get('/businesses/:id/logo', controller.getBusinessLogo);
  router.use(handleBusinessError);
  return router;
}

module.exports = { createBusinessRouter, createCatalogRouter, defaultModels };
