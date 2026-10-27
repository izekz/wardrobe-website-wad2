const express = require('express')
const { requireAuth } = require('../middleware/authentication')
const { trustedBrowser } = require('../middleware/authentication')
const { requireAdmin } = require('../middleware/admin')
const {
  getUsers,
  updateUserStatus,
  getListings,
  updateListingStatus,
} = require('../controllers/adminController')

const router = express.Router()

router.use(requireAuth, requireAdmin)

router.get('/users', getUsers)

router.patch(
  '/users/:id/status',
  trustedBrowser,
  express.json({ limit: '16kb' }),
  updateUserStatus
)

router.get('/listings', getListings)

router.patch(
  '/listings/:id/status',
  trustedBrowser,
  express.json({ limit: '16kb' }),
  updateListingStatus
)

module.exports = router