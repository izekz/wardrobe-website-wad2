const express = require('express');
const { createCommunityController, defaultModels } = require('../controllers/communityController');
const { actorFor, requireCustomer, handleCommunityError } = require('../middleware/community');
const { trustedBrowser } = require('../middleware/authentication');
const { createRequestCommerceController } = require('../controllers/requestCommerceController');

function createCommunityRouter(models = defaultModels, transact) {
  const router = express.Router();
  const controller = createCommunityController(models);
  const commerce = createRequestCommerceController(models, transact);

  router.use((req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : trustedBrowser(req, res, next));

  router.get('/session', controller.getSession);
  router.get('/members/:id', controller.getMember);
  // The customer-facing resale screens are retired. Keep these legacy endpoints
  // for backwards compatibility with the team admin/listing tooling until agreed.
  router.get('/my/listings', requireCustomer, controller.getMyListings);
  router.get('/listings', controller.getListings);
  router.post('/listings', requireCustomer, controller.createListing);
  router.get('/listings/:id/image', controller.getListingImage);
  router.get('/listings/:id', controller.getListing);
  router.put('/listings/:id', requireCustomer, controller.updateListing);
  router.patch('/listings/:id/status', requireCustomer, controller.setListingStatus);
  router.delete('/listings/:id', requireCustomer, controller.deleteListing);
  router.get('/credits', requireCustomer, (req, res) => res.status(410).json({ message: 'Customer request credits have been retired; requests are free.' }));
  router.post('/credits/purchase', requireCustomer, (req, res) => res.status(410).json({ message: 'Customer credit purchases are no longer needed.' }));
  router.get('/requests', controller.getRequests);
  router.post('/requests', requireCustomer, controller.createRequest);
  router.get('/requests/:id', controller.getRequest);
  router.patch('/requests/:id/status', requireCustomer, controller.setRequestStatus);
  router.delete('/requests/:id', requireCustomer, controller.deleteRequest);
  router.post('/requests/:id/responses/:responseId/accept', requireCustomer, commerce.accept);
  router.delete('/requests/:id/acceptance', requireCustomer, commerce.cancelAcceptance);
  router.post('/requests/:id/responses/:responseId/purchase', requireCustomer, commerce.purchase);
  router.get('/requests/:id/purchase', requireCustomer, commerce.getPurchase);

  router.use(handleCommunityError);
  return router;
}

module.exports = { createCommunityRouter, actorFor, defaultModels };
