const express = require('express');
const { createCommunityController, defaultModels } = require('../controllers/communityController');
const { actorFor, requireCustomer, handleCommunityError } = require('../middleware/community');

function createCommunityRouter(models = defaultModels) {
  const router = express.Router();
  const controller = createCommunityController(models);

  router.get('/session', controller.getSession);
  router.get('/listings', controller.getListings);
  router.post('/listings', requireCustomer, controller.createListing);
  router.get('/listings/:id/image', controller.getListingImage);
  router.get('/listings/:id', controller.getListing);
  router.get('/requests', controller.getRequests);
  router.post('/requests', requireCustomer, controller.createRequest);
  router.get('/requests/:id', controller.getRequest);

  router.use(handleCommunityError);
  return router;
}

module.exports = { createCommunityRouter, actorFor, defaultModels };
