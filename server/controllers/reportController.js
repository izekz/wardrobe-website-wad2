const Report = require('../models/Report')
const Listing = require('../models/CommunityListing')

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
      reason,
      explanation = '',
    } = req.body || {}

    if (
      !validId(listingId) ||
      !reasons.includes(reason) ||
      typeof explanation !== 'string' ||
      explanation.trim().length > 1000
    ) {
      return res.status(400).json({
        message: 'Choose a valid reason and enter up to 1,000 characters.',
      })
    }

    if (reason === 'Other' && !explanation.trim()) {
      return res.status(400).json({
        message: 'Please explain your report.',
      })
    }

    const listing = await Listing.findById(listingId)
      .select('name ownerId')
      .lean()

    if (!listing) {
      return res.status(404).json({
        message: 'Listing not found.',
      })
    }

    if (String(listing.ownerId) === String(req.user.id)) {
      return res.status(400).json({
        message: 'You cannot report your own listing.',
      })
    }

    const report = await Report.create({
      listingId,
      listingName: listing.name,
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
        message: 'You have already reported this listing.',
      })
    }

    next(error)
  }
}

async function getReports(req, res, next) {
  try {
    const reports = await Report.find()
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