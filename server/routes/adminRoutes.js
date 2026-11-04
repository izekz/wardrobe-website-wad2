const express = require('express')
const {
  requireAuth,
  trustedBrowser,
} = require('../middleware/authentication')
const { requireAdmin } = require('../middleware/admin')

const {
  getUsers,
  updateUserStatus,
  getListings,
  deleteListing,
  deleteOutfitRequest,
  deleteOutfitVideo,
} = require('../controllers/adminController')

const router = express.Router()

// Every route below requires a signed-in administrator.
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

router.delete(
  '/videos/:id',
  trustedBrowser,
  deleteOutfitVideo
)

module.exports = router