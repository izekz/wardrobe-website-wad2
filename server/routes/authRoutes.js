const express = require('express');
const authController = require('../controllers/authController');
const { trustedBrowser } = require('../middleware/authentication');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/session', authController.getSession);
router.post('/login', trustedBrowser, authController.login);
router.post('/register', trustedBrowser, authController.register);
router.post('/logout', trustedBrowser, authController.logout);

module.exports = router;
