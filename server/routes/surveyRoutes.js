const express = require('express');
const { trustedBrowser } = require('../middleware/authentication');
const surveyController = require('../controllers/surveyController');

const router = express.Router();
router.get('/', surveyController.getSurvey);
router.post('/', trustedBrowser, surveyController.saveSurvey);

module.exports = router;
