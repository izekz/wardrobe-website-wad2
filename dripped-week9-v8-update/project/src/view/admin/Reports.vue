<script>
import {
  getReports,
  reviewReport,
} from '../../services/reportService'

export default {
  data() {
    return {
      reports: [],
      filter: 'pending',
      loading: true,
      saving: false,
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
        const data = await getReports()
        this.reports = data.reports
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    selectReport(report) {
      this.selected = report
      this.reviewNote = report.reviewNote || ''
      this.error = ''
      this.message = ''
    },

    formatDate(date) {
      return new Date(date).toLocaleDateString('en-SG')
    },

    async submitReview(status) {
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
    <h1>Manage reports</h1>
    <p>Review complaints about community listings.</p>

    <RouterLink :to="{ name: 'admin-dashboard' }">
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
        :disabled="loading || saving"
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
            <th scope="col">Listing</th>
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
                :disabled="saving"
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
        :to="{
          name: 'community-listing',
          params: { listingId: selected.listingId },
        }"
      >
        Open listing →
      </RouterLink>

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
          :disabled="saving"
        ></textarea>

        <p>
          Record any action taken in Manage users or
          Manage listings before resolving.
        </p>

        <div class="actions">
          <button type="submit" :disabled="saving">
            Resolve
          </button>

          <button
            type="button"
            :disabled="saving"
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
</style>