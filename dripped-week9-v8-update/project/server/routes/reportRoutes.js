const express = require('express')
const {
  requireAuth,
  trustedBrowser,
} = require('../middleware/authentication')
const { requireAdmin } = require('../middleware/admin')
const {
  createReport,
  getReports,
  reviewReport,
} = require('../controllers/reportController')

const router = express.Router()

router.use(requireAuth)

router.get('/', requireAdmin, getReports)

router.post(
  '/',
  trustedBrowser,
  express.json({ limit: '16kb' }),
  createReport
)

router.patch(
  '/:id',
  requireAdmin,
  trustedBrowser,
  express.json({ limit: '16kb' }),
  reviewReport
)

module.exports = router