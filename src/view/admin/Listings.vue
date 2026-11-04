<script>
import {
  getListings,
  deleteListing,
} from '../../services/adminService'

import { reviewReport } from '../../services/reportService'

export default {
  data() {
    return {
      listings: [],
      search: '',
      loading: true,
      deletingId: null,
      loadError: '',
      actionError: '',
      message: '',
      failedImages: {},
      reviewingId: null,
      reviewNotes: {},
    }
  },

  computed: {
    businessGroups() {
      const search = this.search.trim().toLowerCase()
      const groups = new Map()

      for (const listing of this.listings) {
        const searchable = [
          listing.name,
          listing.businessName,
          listing.category,
        ].join(' ').toLowerCase()

        if (search && !searchable.includes(search)) continue

        const businessId = listing.businessId

        if (!groups.has(businessId)) {
          groups.set(businessId, {
            id: businessId,
            name: listing.businessName,
            listings: [],
          })
        }

        groups.get(businessId).listings.push(listing)
      }

      return Array.from(groups.values())
    },
  },

  async mounted() {
    try {
      const data = await getListings()
      this.listings = data.listings
    } catch (error) {
      this.loadError = error.message || 'Unable to load listings.'
    } finally {
      this.loading = false
    }
  },

  methods: {
    async decideReport(listing, report, status) {
      if (this.reviewingId !== null || this.deletingId !== null) return

      const note = (this.reviewNotes[report.id] || '').trim()

      this.actionError = ''
      this.message = ''

      if (!note) {
        this.actionError = 'Enter a review note before resolving or dismissing.'
        document.getElementById(`listing-report-note-${report.id}`)?.focus()
        return
      }

      this.reviewingId = report.id

      try {
        const result = await reviewReport(report.id, status, note)

        listing.reports = listing.reports.map(item =>
          item.id === result.report.id ? result.report : item
        )

        delete this.reviewNotes[report.id]

        this.message = status === 'resolved'
          ? 'Report resolved.'
          : 'Report dismissed.'
      } catch (error) {
        if (error.status === 409) {
          try {
            const data = await getListings()
            this.listings = data.listings
            this.actionError =
              'This report was already reviewed. The listings have been refreshed.'
          } catch {
            this.actionError =
              'This report was already reviewed, but refreshing failed. Reload the page to see its current status.'
          }
        } else {
          this.actionError = error.message || 'Unable to update the report.'
        }
      } finally {
        this.reviewingId = null
      }
    },
    formatPrice(price) {
      return `S$${Number(price).toFixed(2)}`
    },

    formatDate(date) {
      return new Date(date).toLocaleDateString('en-SG')
    },

    async removeListing(listing) {
      if (this.deletingId !== null || this.reviewingId !== null) return

      const confirmed = window.confirm(
        `Delete "${listing.name}" from ${listing.businessName}? ` +
        'This permanently removes the listing and all its linked Style Feed videos. This cannot be undone.'
      )

      if (!confirmed) return

      this.deletingId = listing.id
      this.actionError = ''
      this.message = ''

      try {
        await deleteListing(listing.id)

        this.listings = this.listings.filter(
          item => item.id !== listing.id
        )

        this.message = `"${listing.name}" and its linked Style Feed videos have been deleted.`
      } catch (error) {
        if (error.status === 404) {
          this.listings = this.listings.filter(
            item => item.id !== listing.id
          )

          this.message =
            `"${listing.name}" was already deleted. It has been removed from this page.`
        } else {
          this.actionError = error.message || 'Unable to delete listing.'
        }
      } finally {
        this.deletingId = null
      }
    },
  },
}
</script>

<template>
  <section class="admin-page">
    <h1>Business listings</h1>
    <p class="page-description">
      Review listings by business, check reports, and remove listings.
    </p>

    <RouterLink
      :to="{ name: 'admin-dashboard' }"
      class="back-button"
    >
      ← Back to dashboard
    </RouterLink>

    <p v-if="loading" role="status">Loading listings…</p>

    <p v-else-if="loadError" class="error-message" role="alert">
      {{ loadError }}
    </p>

    <div v-else>
      <div class="search-field">
        <label for="listing-search">Search business listings</label>
        <input
          id="listing-search"
          v-model="search"
          type="search"
          placeholder="Search by product, business or category"
        />
      </div>

      <p v-if="actionError" class="error-message" role="alert">
        {{ actionError }}
      </p>

      <p v-if="message" class="success-message" role="status">
        {{ message }}
      </p>

      <p v-if="businessGroups.length === 0" class="empty-state">
        No listings found.
      </p>

      <section
        v-for="business in businessGroups"
        :key="business.id"
        class="business-group"
      >
        <header class="business-heading">
          <h2>{{ business.name }}</h2>
          <span>
            {{ business.listings.length }}
            {{ business.listings.length === 1 ? 'listing' : 'listings' }}
          </span>
        </header>

        <article
          v-for="listing in business.listings"
          :key="listing.id"
          class="listing-card"
          :aria-labelledby="`listing-${listing.id}`"
        >
          <div class="listing-summary">
            <img
              v-if="!failedImages[listing.id]"
              :src="listing.imageURL"
              :alt="listing.name"
              class="listing-image"
              loading="lazy"
              @error="failedImages[listing.id] = true"
            />
            <div v-else class="image-placeholder">
              No image
            </div>

            <div class="listing-details">
              <h3 :id="`listing-${listing.id}`">
                {{ listing.name }}
              </h3>

              <p>{{ listing.category }}</p>
              <p class="listing-price">
                {{ formatPrice(listing.price) }}
              </p>

              <div class="listing-meta">
                <span>Stock: {{ listing.stock }}</span>
                <span class="status-badge">{{ listing.status }}</span>
              </div>
            </div>

            <button
              type="button"
              class="delete-button"
              :disabled="deletingId !== null || reviewingId !== null"
              :aria-label="`Delete listing: ${listing.name}`"
              @click="removeListing(listing)"
            >
              {{
                deletingId === listing.id
                  ? 'Deleting…'
                  : 'Delete listing'
              }}
            </button>
          </div>

          <div class="listing-reports">
            <h4>Reports ({{ listing.reports.length }})</h4>

            <p v-if="listing.reports.length === 0" class="muted">
              No reports for this listing.
            </p>

            <div
              v-for="report in listing.reports"
              :key="report.id"
              class="report-card"
            >
              <div class="report-heading">
                <strong>{{ report.reason }}</strong>
                <span
                  class="status-badge"
                  :class="`report-status-${report.status}`"
                >
                  {{ report.status }}
                </span>
              </div>

              <p class="report-byline">
                Reported by {{ report.reporterName }}
                · {{ formatDate(report.createdAt) }}
              </p>

              <p class="report-text">
                {{ report.explanation || 'No additional details provided.' }}
              </p>

              <p v-if="report.reviewNote" class="report-text">
              <strong>Review note:</strong> {{ report.reviewNote }}
            </p>

            <form
              v-if="report.status === 'pending'"
              class="report-review"
              @submit.prevent="decideReport(listing, report, 'resolved')"
            >
              <label :for="`listing-report-note-${report.id}`">
                Review note
              </label>

              <textarea
                :id="`listing-report-note-${report.id}`"
                v-model="reviewNotes[report.id]"
                rows="2"
                maxlength="1000"
                required
                placeholder="Explain your decision or action taken."
                :disabled="reviewingId !== null || deletingId !== null"
              ></textarea>

              <div class="report-review-actions">
                <button
                  type="submit"
                  class="resolve-button"
                  :disabled="reviewingId !== null || deletingId !== null"
                >
                  {{ reviewingId === report.id ? 'Saving…' : 'Resolve' }}
                </button>

                <button
                  type="button"
                  class="dismiss-button"
                  :disabled="reviewingId !== null || deletingId !== null"
                  @click="decideReport(listing, report, 'dismissed')"
                >
                  Dismiss
                </button>
              </div>
            </form>
          </div>
          </div>
        </article>
      </section>
    </div>
  </section>
</template>

<style scoped>
.report-review {
  margin-top: 16px;
}

.report-review label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: bold;
}

.report-review textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #ddd5df;
  border-radius: 8px;
  background: white;
  color: #44213f;
  font: inherit;
  resize: vertical;
}

.report-review textarea:focus-visible {
  outline: 2px solid #683760;
  outline-offset: 3px;
}

.report-review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.resolve-button,
.dismiss-button {
  padding: 10px 18px;
  border: 1px solid #683760;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.resolve-button {
  background: #683760;
  color: white;
}

.resolve-button:hover:not(:disabled) {
  background: #542c4e;
}

.dismiss-button {
  background: white;
  color: #683760;
}

.dismiss-button:hover:not(:disabled) {
  background: #f6edf5;
}

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
  font-size: 36px;
  margin: 0 0 8px;
}

.page-description {
  color: #6d6870;
  line-height: 1.6;
  margin: 0 0 20px;
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

.back-button:focus-visible,
button:focus-visible {
  outline: 2px solid #683760;
  outline-offset: 3px;
}

.search-field {
  display: grid;
  gap: 8px;
  margin: 4px 0 28px;
  max-width: 440px;
}

.search-field label {
  font-weight: bold;
}

.search-field input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #ddd5df;
  border-radius: 8px;
  background: white;
  font: inherit;
}

.business-group {
  margin-bottom: 32px;
}

.business-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.business-heading h2 {
  margin: 0;
  font-size: 26px;
}

.business-heading > span {
  color: #6d6870;
  font-size: 14px;
}

.listing-card {
  padding: 24px;
  margin-bottom: 16px;
  background: white;
  border: 1px solid #e5dfe3;
  border-radius: 16px;
}

.listing-summary {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.listing-image,
.image-placeholder {
  width: 100px;
  height: 120px;
  flex-shrink: 0;
  border-radius: 10px;
}

.listing-image {
  object-fit: cover;
}

.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f7f1fa;
  color: #6d6870;
  font-size: 13px;
}

.listing-details {
  flex: 1;
  min-width: 0;
}

.listing-details h3 {
  margin: 0 0 8px;
  font-size: 22px;
  overflow-wrap: anywhere;
}

.listing-details p {
  margin: 0 0 8px;
  color: #6d6870;
}

.listing-details .listing-price {
  color: #44213f;
  font-weight: bold;
}

.listing-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  background: #f3edf5;
  color: #683760;
  border-radius: 20px;
  font-size: 12px;
  text-transform: capitalize;
}

.delete-button {
  padding: 10px 18px;
  border: none;
  border-radius: 8px;
  background: #a0273f;
  color: white;
  font: inherit;
  cursor: pointer;
}

.delete-button:hover:not(:disabled) {
  background: #821e33;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.listing-reports {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5dfe3;
}

.listing-reports h4 {
  margin: 0 0 12px;
  font-size: 15px;
}

.report-card {
  margin-top: 12px;
  padding: 16px;
  background: #fcf8fb;
  border: 1px solid #eee5ec;
  border-radius: 10px;
}

.report-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.report-byline,
.muted {
  color: #6d6870;
  font-size: 14px;
}

.report-byline {
  margin: 8px 0;
}

.report-text {
  margin: 8px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
}

.report-status-pending {
  background: #fff1d6;
  color: #805514;
}

.report-status-resolved {
  background: #e8f4eb;
  color: #286344;
}

.report-status-dismissed {
  background: #eeeef0;
  color: #5b5860;
}

.empty-state {
  padding: 28px;
  text-align: center;
  background: white;
  border: 1px solid #e5dfe3;
  border-radius: 12px;
  color: #6d6870;
}

.error-message {
  color: #a0273f;
}

.success-message {
  color: #286344;
}

@media (max-width: 650px) {
  .listing-card {
    padding: 16px;
  }

  .listing-summary {
    flex-wrap: wrap;
    gap: 14px;
  }

  .listing-image,
  .image-placeholder {
    width: 80px;
    height: 100px;
  }

  .listing-details {
    flex-basis: calc(100% - 94px);
  }

  .delete-button {
    width: 100%;
  }
}
</style>