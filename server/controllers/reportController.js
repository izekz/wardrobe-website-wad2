const Report = require('../models/Report')
const Product = require('../models/Product')
const OutfitRequest = require('../models/OutfitRequest')
const Business = require('../models/Business')
const StyleVideo = require('../models/StyleVideo')

const reasons = [
  'Misleading information',
  'Inappropriate content',
  'Suspected scam',
  'Other',
]

function validId(id) {
  return typeof id === 'string' &&
    /^[a-fA-F0-9]{24}$/.test(id)
}

function reportJson(report) {
  return {
    id: String(report._id),
    targetType: report.targetType,
    listingId: String(report.listingId),
    listingName: report.listingName,
    reporterName: report.reporterName,
    reason: report.reason,
    explanation: report.explanation,
    status: report.status,
    reviewNote: report.reviewNote,
    createdAt: report.createdAt,
    reviewedAt: report.reviewedAt,
  }
}
async function reportsWithTargetState(reports) {
  const idsFor = type => reports
    .filter(report => report.targetType === type)
    .map(report => report.listingId)

  const listingIds = idsFor('listing')
  const requestIds = idsFor('request')
  const videoIds = idsFor('video')

  const [products, requests, videos] = await Promise.all([
    listingIds.length
      ? Product.find({ _id: { $in: listingIds } })
        .select('_id status')
        .lean()
      : [],

    requestIds.length
      ? OutfitRequest.find({ _id: { $in: requestIds } })
        .select('_id deletedAt')
        .lean()
      : [],

    videoIds.length
      ? StyleVideo.find({ _id: { $in: videoIds } })
        .select('_id')
        .lean()
      : [],
  ])

  const productsById = new Map(
    products.map(product => [String(product._id), product])
  )

  const requestsById = new Map(
    requests.map(request => [String(request._id), request])
  )

  const videoIdsFound = new Set(
    videos.map(video => String(video._id))
  )

  return reports.map(report => {
    const id = String(report.listingId)
    let targetState = 'removed'

    if (report.targetType === 'listing') {
      const product = productsById.get(id)

      if (product) {
        targetState = product.status === 'active'
          ? 'available'
          : 'hidden'
      }
    } else if (report.targetType === 'request') {
      const request = requestsById.get(id)

      if (request && !request.deletedAt) {
        targetState = 'available'
      }
    } else if (
      report.targetType === 'video' &&
      videoIdsFound.has(id)
    ) {
      // The admin video endpoint supports inspection even when
      // the video’s linked product has been hidden or deleted.
      targetState = 'available'
    }

    return {
      ...reportJson(report),
      targetState,
      canView: targetState === 'available',
    }
  })
}
async function createReport(req, res, next) {
  try {
    const {
      listingId,
      targetType,
      reason,
      explanation = '',
    } = req.body || {}

    if (
      !validId(listingId) ||
      !['listing', 'request', 'video'].includes(targetType) ||
      !reasons.includes(reason) ||
      typeof explanation !== 'string' ||
      explanation.trim().length > 1000
    ) {
      return res.status(400).json({
        message: 'Choose a valid post type and reason, and enter up to 1,000 characters.',
      })
    }

    if (reason === 'Other' && !explanation.trim()) {
      return res.status(400).json({
        message: 'Please explain your report.',
      })
    }

    let target
    let ownerId
    let targetName

    if (targetType === 'listing') {
      target = await Product.findOne({
        _id: listingId,
        status: 'active',
      })
        .select('name businessId')
        .lean()

      if (target) {
        const business = validId(target.businessId)
          ? await Business.findById(target.businessId)
            .select('ownerId')
            .lean()
          : null

        ownerId = business?.ownerId
        targetName = target.name
      }
    } else if (targetType === 'request') {
      target = await OutfitRequest.findOne({
        _id: listingId,
        deletedAt: null,
      })
        .select('title consumerId')
        .lean()

      ownerId = target?.consumerId
      targetName = target?.title
    } else if (targetType === 'video') {
      target = await StyleVideo.findById(listingId)
        .select('caption businessId productId')
        .lean()

      if (target) {
        const product = validId(target.productId)
          ? await Product.findOne({
              _id: target.productId,
              status: 'active',
            })
              .select('name')
              .lean()
          : null

        if (!product) {
          target = null
        } else {
          const business = validId(target.businessId)
            ? await Business.findById(target.businessId)
              .select('ownerId')
              .lean()
            : null

          ownerId = business?.ownerId
          targetName = target.caption || product.name
        }
      }
    }

    if (!target) {
      return res.status(404).json({
        message: 'This post is no longer available.',
      })
    }

    if (ownerId && String(ownerId) === String(req.user.id)) {
      return res.status(400).json({
        message: 'You cannot report your own post.',
      })
    }

    const report = await Report.create({
      targetType,
      listingId,
      listingName: targetName,
      reporterId: req.user.id,
      reporterName: req.user.name,
      reason,
      explanation: explanation.trim(),
    })

    res.status(201).json({
      message: 'Your report has been submitted.',
      reportId: String(report._id),
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'You have already reported this post.',
      })
    }

    next(error)
  }
}

async function getReports(req, res, next) {
  try {
    const targetType = req.query.targetType

    if (
      targetType !== undefined &&
      !['listing', 'request', 'video'].includes(targetType)
    ) {
      return res.status(400).json({
        message: 'Invalid report type.',
      })
    }

    const filter = targetType
      ? { targetType }
      : { targetType: { $in: ['listing', 'request', 'video'] } }

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .lean()

    const results = await reportsWithTargetState(reports)
    res.set('Cache-Control', 'no-store')
    res.json({
      reports: results,
    })
  } catch (error) {
    next(error)
  }
}

async function reviewReport(req, res, next) {
  try {
    const { status, reviewNote } = req.body || {}

    if (
      !validId(req.params.id) ||
      !['resolved', 'dismissed'].includes(status) ||
      typeof reviewNote !== 'string' ||
      !reviewNote.trim() ||
      reviewNote.trim().length > 1000
    ) {
      return res.status(400).json({
        message: 'Choose resolved or dismissed and enter a review note of up to 1,000 characters.',
      })
    }

    const report = await Report.findOneAndUpdate(
      {
        _id: req.params.id,
        targetType: { $in: ['listing', 'request', 'video'] },
        status: 'pending',
      },
      {
        $set: {
          status,
          reviewNote: reviewNote.trim(),
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean()

    if (!report) {
      return res.status(409).json({
        message: 'Report not found or already reviewed. Refresh the list.',
      })
    }

    const [result] = await reportsWithTargetState([report])

    res.set('Cache-Control', 'no-store')
    res.json({
      report: result,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  createReport,
  getReports,
  reviewReport,
}