const Report = require('../models/Report')
const Product = require('../models/Product')
const OutfitRequest = require('../models/OutfitRequest')
const Business = require('../models/Business')

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
      !['listing', 'request'].includes(targetType) ||
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
    } else {
      target = await OutfitRequest.findOne({
        _id: listingId,
        deletedAt: null,
      })
        .select('title consumerId')
        .lean()

      ownerId = target?.consumerId
      targetName = target?.title
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
      !['listing', 'request'].includes(targetType)
    ) {
      return res.status(400).json({
        message: 'Invalid report type.',
      })
    }

    const filter = targetType
      ? { targetType }
      : { targetType: { $in: ['listing', 'request'] } }

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .lean()

    res.json({
      reports: reports.map(reportJson),
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
        targetType: { $in: ['listing', 'request'] },
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

    res.json({
      report: reportJson(report),
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