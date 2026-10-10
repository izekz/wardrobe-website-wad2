const express = require("express");
const { handleWardrobeError } = require("../middleware/wardrobe");
const {
  createWardrobeController,
} = require("../controllers/wardrobeController");
const { requireAuth, trustedBrowser } = require("../middleware/authentication");
function createWardrobeRouter(models, weatherProvider) {
  const router = express.Router(),
    c = createWardrobeController(models, weatherProvider);
  router.use(requireAuth);
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/items", c.list);
  router.post("/items", trustedBrowser, c.create);
  router.get("/items/:id/image", c.image);
  router.get("/items/:id", c.get);
  router.put("/items/:id", trustedBrowser, c.update);
  router.delete("/items/:id", trustedBrowser, c.remove);
  router.get("/weather", c.weather);
  router.post("/recommendations", trustedBrowser, c.plan);
  router.post("/selection", trustedBrowser, c.selection);
  router.get("/outfits", c.saved);
  router.post("/outfits", trustedBrowser, c.save);
  router.delete("/outfits/:id", trustedBrowser, c.deleteSaved);
  router.use(handleWardrobeError);
  return router;
}
module.exports = { createWardrobeRouter };
