<script>
import {
  getReports,
  reviewReport,
} from '../../services/reportService'

import {
  deleteOutfitRequest,
  deleteOutfitVideo,
} from '../../services/adminService'

export default {
  data() {
    return {
      reports: [],
      filter: 'pending',
      typeFilter: 'all',
      loading: true,
      fetching: false,
      saving: false,
      removing: false,
      loadError: '',
      error: '',
      message: '',
      selected: null,
      reviewNote: '',
      drafts: {},
      hasLoaded: false,
      handledReportLink: '',
    }
  },

  computed: {
    busy() {
      return this.fetching || this.saving || this.removing
    },

    filteredReports() {
      return this.reports.filter(report =>
        (this.filter === 'all' || report.status === this.filter) &&
        (this.typeFilter === 'all' ||
          report.targetType === this.typeFilter)
      )
    },

    removalLabel() {
      return this.selected?.targetType === 'video'
        ? 'Delete video'
        : 'Remove request'
    },
  },

  watch: {
    '$route.query.reportId'() {
      this.openLinkedReport()
    },
  },

  mounted() {
    this.loadReports()
  },

  methods: {
    openLinkedReport() {
      const id = this.$route.query.reportId

      if (id === undefined) {
        this.handledReportLink = ''
        return
      }

      // A link can arrive before loading finishes or while saving.
      // The completion handlers retry using the latest route.
      if (this.busy || !this.hasLoaded) return
      if (typeof id === 'string' && id === this.handledReportLink) return

      if (typeof id !== 'string' || !/^[a-fA-F0-9]{24}$/.test(id)) {
        this.error = 'This report link is invalid.'
        return
      }

      const report = this.reports.find(
        item => item.id.toLowerCase() === id.toLowerCase()
      )

      if (!report) {
        this.selected = null
        this.reviewNote = ''
        this.error = 'This report could not be found. Refresh to check the latest reports.'
        return
      }

      this.handledReportLink = id
      this.filter = report.status
      this.typeFilter = report.targetType
      this.selectReport(report)
    },

    reportTypeLabel(type) {
      return {
        listing: 'Business listing',
        request: 'Outfit request',
        video: 'Outfit video',
      }[type] || 'Post'
    },

    statusLabel(status) {
      return {
        pending: 'Pending review',
        resolved: 'Resolved',
        dismissed: 'Dismissed',
      }[status] || status
    },

    reportRoute(report) {
      if (report.targetType === 'request') {
        return {
          name: 'community-request',
          params: { requestId: report.listingId },
        }
      }

      if (report.targetType === 'video') {
        return {
          name: 'style-feed',
          query: { videoId: report.listingId },
        }
      }

      return {
        name: 'discover-product',
        params: { productId: report.listingId },
      }
    },

    formatDate(value) {
      if (!value) return '—'

      return new Date(value).toLocaleString('en-SG', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    },

    rememberDraft() {
      if (this.selected?.status === 'pending') {
        this.drafts[this.selected.id] = this.reviewNote
      }
    },

    async loadReports() {
      if (this.busy) return

      this.rememberDraft()
      this.fetching = true
      this.loading = true
      this.loadError = ''

      try {
        const data = await getReports()
        this.reports = data.reports
        this.hasLoaded = true

        if (this.selected) {
          const updated = this.reports.find(
            report => report.id === this.selected.id
          )

          this.selected = updated || null
          this.reviewNote = updated
            ? updated.status === 'pending'
              ? this.drafts[updated.id] ?? updated.reviewNote ?? ''
              : updated.reviewNote || ''
            : ''
        }
      } catch (error) {
        this.loadError = this.reports.length
          ? 'Could not refresh reports. The displayed information may be out of date.'
          : error.message || 'Unable to load reports.'
      } finally {
        this.loading = false
        this.fetching = false
        this.openLinkedReport()
      }
    },

    selectReport(report) {
      if (this.busy) return

      this.rememberDraft()
      this.selected = report
      this.reviewNote = report.status === 'pending'
        ? this.drafts[report.id] ?? report.reviewNote ?? ''
        : report.reviewNote || ''

      this.error = ''
      this.message = ''

      this.$nextTick(() => {
        this.$refs.reviewPanel?.focus()
        this.$refs.reviewPanel?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    },

    async removePost() {
      if (
        this.busy ||
        !this.selected ||
        !['request', 'video'].includes(this.selected.targetType) ||
        this.selected.targetState === 'removed'
      ) return

      const reportId = this.selected.id
      const targetId = this.selected.listingId
      const targetType = this.selected.targetType
      const targetName = this.selected.listingName
      const isVideo = targetType === 'video'

      const warning = isVideo
        ? `Delete video "${targetName}"? This permanently deletes the video. Its linked product and report history will remain.`
        : `Remove request "${targetName}"? It will no longer appear on the request pages. Its report history will remain.`

      if (!window.confirm(warning)) return

      this.removing = true
      this.error = ''
      this.message = ''

      try {
        let alreadyRemoved = false

        try {
          if (isVideo) {
            await deleteOutfitVideo(targetId)
          } else {
            await deleteOutfitRequest(targetId)
          }
        } catch (error) {
          if (error.status !== 404) throw error
          alreadyRemoved = true
        }

        this.reports = this.reports.map(report =>
          report.targetType === targetType &&
          report.listingId === targetId
            ? {
                ...report,
                targetState: 'removed',
                canView: false,
              }
            : report
        )

        this.selected = this.reports.find(
          report => report.id === reportId
        ) || null

        const label = isVideo ? 'Video' : 'Request'

        this.message = alreadyRemoved
          ? `${label} was already removed. You can still review and close its report.`
          : this.selected?.status === 'pending'
            ? `${label} removed. Record your action below, then mark the report resolved.`
            : `${label} removed. The existing report decision has been preserved.`
      } catch (error) {
        this.error = error.message || 'Unable to remove this post.'
      } finally {
        this.removing = false
        this.openLinkedReport()
      }
    },

    async submitReview(status) {
      if (
        this.busy ||
        !this.selected ||
        this.selected.status !== 'pending' ||
        !['resolved', 'dismissed'].includes(status)
      ) return

      const note = this.reviewNote.trim()

      if (!note) {
        this.error = 'Enter a decision reason before closing this report.'
        document.getElementById('review-note')?.focus()
        return
      }

      const reportId = this.selected.id

      this.saving = true
      this.error = ''
      this.message = ''

      try {
        const { report } = await reviewReport(reportId, status, note)

        this.reports = this.reports.map(item =>
          item.id === report.id ? report : item
        )

        this.selected = report
        this.reviewNote = report.reviewNote || ''
        delete this.drafts[reportId]

        this.message = status === 'resolved'
          ? 'Report marked resolved. Your decision was saved.'
          : 'Report dismissed. Your reason was saved; this action did not remove any content.'
      } catch (error) {
        if (error.status === 409) {
          this.saving = false
          await this.loadReports()
          this.error =
            'This report is no longer pending. Check its refreshed status.'
        } else {
          this.error = error.message || 'Unable to save the review.'
        }
      } finally {
        this.saving = false
        this.openLinkedReport()
      }
    },
  },
}
</script>

<template>
  <section class="admin-page">
    <h1>Reports</h1>
    <p>Review reported listings, outfit requests, and videos.</p>

    <RouterLink
      :to="{ name: 'admin-dashboard' }"
      class="admin-button"
    >
      ← Back to dashboard
    </RouterLink>

    <div class="filter-field">
      <label for="report-type-filter">Report type</label>
      <select
        id="report-type-filter"
        v-model="typeFilter"
        :disabled="busy"
      >
        <option value="all">All types</option>
        <option value="listing">Business listings</option>
        <option value="request">Outfit requests</option>
        <option value="video">Outfit videos</option>
      </select>

      <label for="report-filter">Status</label>
      <select id="report-filter" v-model="filter" :disabled="busy">
        <option value="pending">Pending review</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
        <option value="all">All statuses</option>
      </select>

      <button
        type="button"
        class="outline-button"
        :disabled="busy"
        @click="loadReports"
      >
        {{ fetching ? 'Refreshing…' : 'Refresh' }}
      </button>
    </div>

    <p v-if="loadError" class="error-message" role="alert">
      {{ loadError }}
    </p>

    <p v-if="error" class="error-message" role="alert">
      {{ error }}
    </p>

    <p v-if="message" class="success-message" role="status">
      {{ message }}
    </p>

    <p v-if="loading" role="status">Loading reports…</p>

    <div
      v-else-if="!loadError || reports.length"
      class="table-container"
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Reported post</th>
            <th scope="col">Type</th>
            <th scope="col">Reported by</th>
            <th scope="col">Reason</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="report in filteredReports" :key="report.id">
            <td>{{ report.listingName }}</td>
            <td>{{ reportTypeLabel(report.targetType) }}</td>
            <td>{{ report.reporterName }}</td>
            <td>{{ report.reason }}</td>
            <td>{{ formatDate(report.createdAt) }}</td>
            <td>{{ statusLabel(report.status) }}</td>
            <td>
              <button
                type="button"
                class="admin-button"
                :disabled="busy"
                :aria-label="`Review report for ${report.listingName}`"
                @click="selectReport(report)"
              >
                Review
              </button>
            </td>
          </tr>

          <tr v-if="filteredReports.length === 0">
            <td colspan="7">No reports match these filters.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <section
      v-if="selected"
      ref="reviewPanel"
      class="review-card"
      tabindex="-1"
      aria-labelledby="review-title"
    >
      <span class="type-label">
        {{ reportTypeLabel(selected.targetType) }}
      </span>

      <h2 id="review-title">{{ selected.listingName }}</h2>

      <p>
        <strong>Reason:</strong> {{ selected.reason }}
      </p>

      <p>
        <strong>Reported by:</strong> {{ selected.reporterName }}
        · {{ formatDate(selected.createdAt) }}
      </p>

      <p class="explanation">
        {{ selected.explanation || 'No extra explanation provided.' }}
      </p>

      <RouterLink
        v-if="selected.canView"
        :to="reportRoute(selected)"
        class="admin-button"
      >
        View {{ reportTypeLabel(selected.targetType).toLowerCase() }} →
      </RouterLink>

      <p v-else class="availability-message">
        {{
          selected.targetState === 'hidden'
            ? 'This post has been hidden by the business.'
            : 'This post is no longer available.'
        }}
        Its report remains available for review.
      </p>

      <p>
        <strong>Report status:</strong>
        {{ statusLabel(selected.status) }}
      </p>

      <div class="moderation-step">
        <h3>Content actions</h3>
        <p>
          Inspect the post first. Remove content that breaks the rules,
          or manage the owner's account if necessary.
        </p>

        <div class="actions">
          <RouterLink
            v-if="selected.targetType === 'listing' &&
              selected.targetState !== 'removed'"
            :to="{ name: 'admin-listings' }"
            class="admin-button"
          >
            Manage listings
          </RouterLink>

          <template
            v-if="['request', 'video'].includes(selected.targetType)"
          >
            <button
              v-if="selected.targetState !== 'removed'"
              type="button"
              class="danger-button"
              :disabled="busy"
              @click="removePost"
            >
              {{ removing ? 'Removing…' : removalLabel }}
            </button>

            <span v-else class="removed-label" role="status">
              {{
                selected.targetType === 'video'
                  ? 'Video removed'
                  : 'Request removed'
              }}
            </span>
          </template>

          <RouterLink
            :to="{ name: 'admin-users' }"
            class="outline-button"
          >
            Manage users
          </RouterLink>
        </div>
      </div>


      <form
        v-if="selected.status === 'pending'"
        @submit.prevent="submitReview('resolved')"
      >
        <div class="moderation-step">
          <h3>Record your decision</h3>

          <label for="review-note">Decision reason (required)</label>
          <textarea
            id="review-note"
            v-model="reviewNote"
            maxlength="1000"
            rows="4"
            required
            placeholder="Explain what you checked and any action taken, or why no violation was found."
            :disabled="busy"
          ></textarea>
        </div>

        <div class="moderation-step">
          <h3>Close this report</h3>
          <p>
            Both options remove this report from the pending queue.
            They do not remove the post or suspend its owner.
          </p>

          <div class="decision-options">
            <div class="decision-option">
              <strong>Issue handled</strong>
              <p>
                You addressed the problem. Record the action you took
                in the decision reason above.
              </p>
              <button
                type="submit"
                class="admin-button"
                :disabled="busy"
              >
                {{ saving ? 'Saving…' : 'Mark resolved' }}
              </button>
            </div>

            <div class="decision-option">
              <strong>No violation found</strong>
              <p>
                You checked the report and decided no moderation
                action was needed.
              </p>
              <button
                type="button"
                class="outline-button"
                :disabled="busy"
                @click="submitReview('dismissed')"
              >
                Dismiss report
              </button>
            </div>
          </div>
        </div>
      </form>

      <div v-else class="decision-history">
        <h3>Recorded decision</h3>

        <p>
          {{
            selected.status === 'resolved'
              ? 'This report was marked as handled.'
              : 'This report was dismissed.'
          }}
        </p>

        <p class="explanation">
          <strong>Decision reason:</strong>
          {{ selected.reviewNote || 'No decision reason recorded.' }}
        </p>

        <p v-if="selected.reviewedAt">
          <strong>Reviewed:</strong>
          {{ formatDate(selected.reviewedAt) }}
        </p>
      </div>
    </section>
  </section>
</template>

<style scoped>
.admin-page {
  color: #44213f;
  padding: 24px 0 40px;
}

h1,
h2,
h3 {
  font-family: Georgia, serif;
}

h1 {
  margin: 0 0 10px;
}

p {
  line-height: 1.6;
}

.admin-page > p,
.moderation-step p,
.decision-history p {
  color: #6d6870;
}

.admin-button,
.outline-button,
.danger-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border: 1px solid #683760;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  line-height: 1.4;
  text-decoration: none;
  cursor: pointer;
}

.admin-button {
  background: #683760;
  color: white;
}

.outline-button {
  background: white;
  color: #683760;
}

.danger-button {
  background: #a0273f;
  border-color: #a0273f;
  color: white;
}

.admin-button:hover:not(:disabled) {
  background: #542c4e;
}

.outline-button:hover:not(:disabled) {
  background: #f6edf5;
}

.danger-button:hover:not(:disabled) {
  background: #821e33;
}

button:disabled {
  opacity: .6;
  cursor: not-allowed;
}

button:focus-visible,
a:focus-visible,
textarea:focus-visible,
select:focus-visible,
.review-card:focus-visible {
  outline: 2px solid #683760;
  outline-offset: 3px;
}

.filter-field,
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.filter-field {
  margin: 24px 0;
}

label {
  font-weight: bold;
}

select,
textarea {
  padding: 10px;
  border: 1px solid #ddd5df;
  border-radius: 8px;
  background: white;
  color: #44213f;
  font: inherit;
}

.table-container {
  overflow-x: auto;
  border: 1px solid #e5dfe3;
  border-radius: 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

th,
td {
  padding: 16px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid #e5dfe3;
}

th {
  background: #f7f1fa;
  white-space: nowrap;
}

tbody tr:last-child td {
  border-bottom: none;
}

.review-card {
  margin-top: 24px;
  padding: 24px;
  border: 1px solid #e5dfe3;
  border-radius: 12px;
  background: white;
  scroll-margin-top: 100px;
}

.review-card h2 {
  margin-top: 12px;
  overflow-wrap: anywhere;
}

.type-label {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 20px;
  background: #f3edf5;
  color: #683760;
  font-size: 13px;
}

.explanation {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.availability-message {
  padding: 12px;
  border-radius: 8px;
  background: #f7f1fa;
  color: #6d6870;
}

.moderation-step,
.decision-history {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e5dfe3;
}

.moderation-step h3,
.decision-history h3 {
  margin: 0 0 10px;
  font-size: 21px;
}

textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 8px;
  resize: vertical;
}

.decision-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.decision-option {
  padding: 20px;
  border: 1px solid #e5dfe3;
  border-radius: 12px;
  background: #fcf8fb;
}

.removed-label {
  color: #6d6870;
  font-size: 14px;
}

.admin-page .error-message {
  color: #a0273f;
}

.admin-page .success-message {
  color: #286344;
}

@media (max-width: 650px) {
  .decision-options {
    grid-template-columns: 1fr;
  }

  .review-card {
    padding: 18px;
  }
}
</style>