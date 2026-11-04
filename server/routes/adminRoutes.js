const express = require('express')
const { requireAuth } = require('../middleware/authentication')
const { trustedBrowser } = require('../middleware/authentication')
const { requireAdmin } = require('../middleware/admin')
const {
  getUsers,
  updateUserStatus,
  getListings,
  deleteListing,
  deleteOutfitRequest,
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

router.delete(
  '/listings/:id',
  trustedBrowser,
  deleteListing
)

router.delete(
  '/requests/:id',
  trustedBrowser,
  deleteOutfitRequest
)

module.exports = router