const User = require('../models/User')
const Listing = require('../models/CommunityListing')

async function getUsers(req, res, next) {
  try {
    const users = await User.find()
      .select('_id name email role suspended')
      .sort({ createdAt: -1 })
      .lean()

    res.json({
      users: users.map(user => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        suspended: user.suspended,
      })),
    })
  } catch (error) {
    next(error)
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const { id } = req.params
    const { suspended } = req.body

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        message: 'Invalid user ID.',
      })
    }

    if (typeof suspended !== 'boolean') {
      return res.status(400).json({
        message: 'Suspended must be true or false.',
      })
    }

    // Prevent administrators from suspending themselves.
    if (id === String(req.user.id)) {
      return res.status(403).json({
        message: 'You cannot change your own account status.',
      })
    }

    // Only update non-admin accounts.
    const user = await User.findOneAndUpdate(
      { _id: id, role: { $ne: 'admin' } },
      { $set: { suspended } },
      { new: true, runValidators: true }
    ).select('_id name email role suspended')

    if (!user) {
      return res.status(404).json({
        message: 'Account not found or administrator account is protected.',
      })
    }

    res.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        suspended: user.suspended,
      },
    })
  } catch (error) {
    next(error)
  }
}

function listingJson(listing) {
  return {
    id: String(listing._id),
    name: listing.name,
    ownerName: listing.ownerName,
    category: listing.category,
    listingType: listing.listingType,
    price: listing.price,
    rentalPrice: listing.rentalPrice,
    status: listing.status,
  }
}

async function getListings(req, res, next) {
  try {
    const listings = await Listing.find()
      .select('name ownerName category listingType price rentalPrice status')
      .sort({ createdAt: -1 })
      .lean()

    res.json({
      listings: listings.map(listingJson),
    })
  } catch (error) {
    next(error)
  }
}

async function updateListingStatus(req, res, next) {
  try {
    const { id } = req.params
    const status = req.body?.status

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        message: 'Invalid listing ID.',
      })
    }

    if (!['available', 'unavailable'].includes(status)) {
      return res.status(400).json({
        message: 'Choose available or unavailable.',
      })
    }

    const listing = await Listing.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    )
      .select('name ownerName category listingType price rentalPrice status')
      .lean()

    if (!listing) {
      return res.status(404).json({
        message: 'Listing not found.',
      })
    }

    res.json({ listing: listingJson(listing) })
  } catch (error) {
    next(error)
  }
}

module.exports = { getUsers, updateUserStatus, getListings, updateListingStatus }