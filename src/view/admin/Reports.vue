<script>
import {
  getReports,
  reviewReport,
} from '../../services/reportService'
import { deleteOutfitRequest } from '../../services/adminService'

export default {
  data() {
    return {
      reports: [],
      filter: 'pending',
      loading: true,
      saving: false,
      removing: false,
      removedRequestIds: [],
      error: '',
      message: '',
      selected: null,
      reviewNote: '',
    }
  },

  computed: {
    filteredReports() {
      return this.reports.filter(report =>
        this.filter === 'all' ||
        report.status === this.filter
      )
    },
  },

  mounted() {
    this.loadReports()
  },

  methods: {
    async loadReports() {
      this.loading = true
      this.error = ''
      this.selected = null

      try {
        const data = await getReports('request')
        this.reports = data.reports
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    selectReport(report) {
      if (this.saving || this.removing) return
      this.selected = report
      this.reviewNote = report.reviewNote || ''
      this.error = ''
      this.message = ''
    },

    formatDate(date) {
      return new Date(date).toLocaleDateString('en-SG')
    },

    async removeRequest() {
      if (this.saving || this.removing || !this.selected) return

      const requestId = this.selected.listingId
      const requestName = this.selected.listingName

      if (this.removedRequestIds.includes(requestId)) return

      if (!window.confirm(
        `Remove "${requestName}"? It will no longer appear on the request pages.`
      )) return

      this.removing = true
      this.error = ''
      this.message = ''

      try {
        await deleteOutfitRequest(requestId)
        this.removedRequestIds.push(requestId)

        this.message =
          'Request removed. Add a review note and resolve the report when ready.'
      } catch (error) {
        this.error = error.message || 'Unable to remove the request.'
      } finally {
        this.removing = false
      }
    },

    async submitReview(status) {
      if (this.saving || this.removing || !this.selected) return

      if (!this.reviewNote.trim()) {
        this.error = 'Enter a note explaining your decision.'
        return
      }

      this.saving = true
      this.error = ''
      this.message = ''

      try {
        const { report } = await reviewReport(
          this.selected.id,
          status,
          this.reviewNote
        )

        this.reports = this.reports.map(item =>
          item.id === report.id ? report : item
        )

        this.selected = report
        this.message = 'Review saved.'
      } catch (error) {
        this.error = error.message
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<template>
  <section class="admin-page">
    <h1>Outfit request reports</h1>
    <p>Review reported outfit requests and record your moderation decisions.</p>

    <RouterLink :to="{ name: 'admin-dashboard' }" class="back-button">
      ← Back to dashboard
    </RouterLink>

    <div class="filter-field">
      <label for="report-filter">Report status</label>

      <select id="report-filter" v-model="filter">
        <option value="pending">Pending</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
        <option value="all">All reports</option>
      </select>

      <button
        type="button"
        :disabled="loading || saving || removing"
        @click="loadReports"
      >
        Refresh
      </button>
    </div>

    <p v-if="error" class="error-message" role="alert">
      {{ error }}
    </p>

    <p v-if="message" class="success-message" role="status">
      {{ message }}
    </p>

    <p v-if="loading" role="status">Loading reports…</p>

    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th scope="col">Outfit request</th>
            <th scope="col">Reported by</th>
            <th scope="col">Reason</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="report in filteredReports"
            :key="report.id"
          >
            <td>{{ report.listingName }}</td>
            <td>{{ report.reporterName }}</td>
            <td>{{ report.reason }}</td>
            <td>{{ formatDate(report.createdAt) }}</td>
            <td>{{ report.status }}</td>
            <td>
              <button
                type="button"
                :disabled="saving || removing"
                :aria-label="`View report for ${report.listingName}`"
                @click="selectReport(report)"
              >
                View
              </button>
            </td>
          </tr>

          <tr v-if="filteredReports.length === 0">
            <td colspan="6">No reports to display.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <section v-if="selected" class="review-card">
      <h2>{{ selected.listingName }}</h2>

      <p>
        <strong>Reason:</strong> {{ selected.reason }}
      </p>

      <p class="explanation">
        {{ selected.explanation || 'No extra explanation provided.' }}
      </p>

      <RouterLink
        v-if="!removedRequestIds.includes(selected.listingId)"
        :to="{
          name: 'community-request',
          params: { requestId: selected.listingId },
        }"
      >
        Open outfit request →
      </RouterLink>

      <p class="explanation">
        Deleted requests are no longer available to open.
        Their reports remain as moderation records.
      </p>

      <p>
        <strong>Status:</strong> {{ selected.status }}
      </p>

      <form
        v-if="selected.status === 'pending'"
        @submit.prevent="submitReview('resolved')"
      >
        <label for="review-note">Review note</label>

        <textarea
          id="review-note"
          v-model="reviewNote"
          maxlength="1000"
          rows="4"
          required
          :disabled="saving || removing"
        ></textarea>

        <p>
          Record your findings and any moderation action before resolving.
          Resolving or dismissing a report does not delete the request.
        </p>

        <div class="actions">
          <button
              v-if="!removedRequestIds.includes(selected.listingId)"
              type="button"
              class="remove-request-button"
              :disabled="saving || removing"
              @click="removeRequest"
            >
              {{ removing ? 'Removing…' : 'Remove request' }}
            </button>

            <span
              v-else
              class="removed-label"
              role="status"
            >
              Request removed
            </span>
          <button type="submit" :disabled="saving">
            Resolve
          </button>

          <button
            type="button"
            :disabled="saving || removing"
            @click="submitReview('dismissed')"
          >
            Dismiss
          </button>
        </div>
      </form>

      <p v-else class="explanation">
        <strong>Review note:</strong> {{ selected.reviewNote }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.admin-page {
  color: #44213f;
  padding: 24px 0 40px;
}

h1,
h2 {
  font-family: Georgia, serif;
}

a {
  display: inline-block;
  color: #683760;
  margin-bottom: 20px;
}

.back-button {
  display: inline-block;
  margin-bottom: 20px;
  padding: 10px 18px;
  background: #683760;
  color: white;
  border-radius: 8px;
  text-decoration: none;
}

.back-button:hover {
  background: #542c4e;
}

.back-button:focus-visible {
  outline: 2px solid #683760;
  outline-offset: 3px;
}

.filter-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
}

select,
textarea {
  padding: 10px;
  border: 1px solid #ddd5df;
  border-radius: 8px;
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
  text-align: left;
  padding: 16px;
  border-bottom: 1px solid #e5dfe3;
}

th {
  background: #f7f1fa;
  white-space: nowrap;
}

button {
  padding: 10px 14px;
  background: #683760;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.review-card {
  margin-top: 24px;
  padding: 24px;
  border: 1px solid #e5dfe3;
  border-radius: 12px;
  background: white;
}

label {
  font-weight: bold;
}

textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 8px 0 16px;
}

.actions {
  display: flex;
  gap: 12px;
}

.explanation {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.error-message {
  color: #a0273f;
}

.success-message {
  color: #286344;
}

.remove-request-button {
  background: #a0273f;
}

.remove-request-button:hover:not(:disabled) {
  background: #821e33;
}

.removed-label {
  align-self: center;
  color: #6d6870;
  font-size: 14px;
}

.actions {
  flex-wrap: wrap;
}
</style>