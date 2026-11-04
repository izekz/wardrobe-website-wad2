const User = require('../models/User')
const Product = require('../models/Product')
const Report = require('../models/Report')
const OutfitRequest = require('../models/OutfitRequest')
const StyleVideo = require('../models/StyleVideo')

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

    // Administrator accounts remain protected.
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

async function getListings(req, res, next) {
  try {
    const listings = await Product.find()
      .select('name businessId businessName category price stock status')
      .sort({ businessName: 1, createdAt: -1 })
      .lean()

    const reports = await Report.find({
      targetType: 'listing',
      listingId: { $in: listings.map(listing => listing._id) },
    })
      .sort({ createdAt: -1 })
      .lean()

    const reportsByListing = new Map()

    for (const report of reports) {
      const id = String(report.listingId)

      if (!reportsByListing.has(id)) {
        reportsByListing.set(id, [])
      }

      reportsByListing.get(id).push({
        id: String(report._id),
        reporterName: report.reporterName,
        reason: report.reason,
        explanation: report.explanation,
        status: report.status,
        reviewNote: report.reviewNote,
        createdAt: report.createdAt,
      })
    }

    res.json({
      listings: listings.map(listing => ({
        id: String(listing._id),
        name: listing.name,
        businessId: listing.businessId,
        businessName: listing.businessName,
        category: listing.category,
        price: listing.price,
        stock: listing.stock,
        status: listing.status,
        imageURL: `/api/catalog/products/${listing._id}/image`,
        reports: reportsByListing.get(String(listing._id)) || [],
      })),
    })
  } catch (error) {
    next(error)
  }
}

async function deleteListing(req, res, next) {
  try {
    const { id } = req.params

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        message: 'Invalid listing ID.',
      })
    }

    const result = await Product.db.transaction(async session => {
      const listing = await Product.findById(id).session(session)

      if (!listing) return null

      const videos = await StyleVideo.deleteMany(
        { productId: String(listing._id) },
        { session }
      )

      await Product.deleteOne({ _id: listing._id }, { session })

      return {
        id: String(listing._id),
        deletedVideoCount: videos.deletedCount,
      }
    })

    if (!result) {
      return res.status(404).json({
        message: 'Listing not found or already deleted.',
      })
    }

    res.json({
      message: 'Business listing and its linked Style Feed videos deleted.',
      ...result,
    })
  } catch (error) {
    next(error)
  }
}

async function deleteOutfitRequest(req, res, next) {
  try {
    const { id } = req.params

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        message: 'Invalid request ID.',
      })
    }

    const request = await OutfitRequest.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
      },
      {
        $set: {
          deletedAt: new Date(),
          status: 'closed',
        },
      },
      {
        new: true,
        runValidators: true,
      }
    )

    if (!request) {
      return res.status(404).json({
        message: 'Request not found or already removed.',
      })
    }

    res.json({
      message: 'Outfit request removed.',
      id: String(request._id),
    })
  } catch (error) {
    next(error)
  }
}

async function deleteOutfitVideo(req, res, next) {
  try {
    const { id } = req.params

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        message: 'Invalid video ID.',
      })
    }

    const video = await StyleVideo.findByIdAndDelete(id)

    if (!video) {
      return res.status(404).json({
        message: 'Video not found or already removed.',
      })
    }

    res.json({
      message: 'Outfit video removed.',
      id: String(video._id),
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getUsers,
  updateUserStatus,
  getListings,
  deleteListing,
  deleteOutfitRequest,
  deleteOutfitVideo,
}