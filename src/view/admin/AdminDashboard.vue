<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getReports } from '../../services/reportService'

const reports = ref([])
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const hasLoaded = ref(false)
let refreshTimer
let disposed = false

const pendingReports = computed(() =>
  reports.value.filter(report => report.status === 'pending')
)

const reportTypes = {
  listing: 'Business listing',
  request: 'Outfit request',
  video: 'Outfit video',
}

function formatDate(value) {
  return new Date(value).toLocaleString('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

async function loadReports() {
  if (disposed || refreshing.value) return
  refreshing.value = true

  try {
    const data = await getReports()
    if (disposed) return
    reports.value = data.reports
    hasLoaded.value = true
    loadError.value = ''
  } catch (error) {
    if (!disposed) {
      loadError.value = hasLoaded.value
        ? 'Could not refresh reports. The list and counter may be out of date.'
        : error.message || 'Unable to load reports.'
    }
  } finally {
    if (!disposed) {
      loading.value = false
      refreshing.value = false
    }
  }
}

function refreshWhenVisible() {
  if (!document.hidden) loadReports()
}

onMounted(() => {
  loadReports()
  refreshTimer = window.setInterval(refreshWhenVisible, 20000)
  window.addEventListener('focus', refreshWhenVisible)
  document.addEventListener('visibilitychange', refreshWhenVisible)
})

onBeforeUnmount(() => {
  disposed = true
  window.clearInterval(refreshTimer)
  window.removeEventListener('focus', refreshWhenVisible)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
})
</script>

<template>
  <section class="admin-page">
    <h1>Admin dashboard</h1>
    <p class="page-description">
      Manage users, business listings, and reported content.
    </p>

    <div class="admin-grid">
      <div class="admin-card">
        <h2>Users</h2>
        <p>View and manage registered accounts.</p>
        <RouterLink :to="{ name: 'admin-users' }">
          Manage users →
        </RouterLink>
      </div>

      <div class="admin-card">
        <h2>Business listings</h2>
        <p>Review products, check reports, and delete listings.</p>
        <RouterLink :to="{ name: 'admin-listings' }">
          Manage listings →
        </RouterLink>
      </div>

      <div class="admin-card">
        <h2>Reports</h2>
        <p>Review listing, request, and video reports, including past decisions.</p>
        <RouterLink :to="{ name: 'admin-reports' }">
          Manage reports →
        </RouterLink>
      </div>
    </div>

    <section class="notifications" aria-labelledby="reports-heading">
      <header class="notifications-heading">
        <div class="heading-with-count">
          <h2 id="reports-heading">Report notifications</h2>
          <span
            v-if="!loading && hasLoaded"
            class="report-counter"
            role="status"
            :aria-label="`${pendingReports.length} pending reports`"
          >
            {{ pendingReports.length }}
          </span>
        </div>

        <button
          type="button"
          class="outline-button"
          :disabled="refreshing"
          @click="loadReports"
        >
          {{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </button>
      </header>

      <p class="notification-description">
        Pending reports from listings, outfit requests, and videos.
        Updates every 20 seconds.
      </p>

      <p v-if="loadError" class="error-message" role="alert">
        {{ loadError }}
      </p>

      <p v-if="loading" role="status">Loading reports…</p>

      <p
        v-else-if="hasLoaded && !pendingReports.length && !loadError"
        class="empty-state"
      >
        You’re all caught up. No pending reports.
      </p>

      <article
        v-for="report in pendingReports"
        :key="report.id"
        class="notification-card"
      >
        <div class="report-heading">
          <span class="type-badge">
            {{ reportTypes[report.targetType] }}
          </span>
          <time :datetime="report.createdAt">
            {{ formatDate(report.createdAt) }}
          </time>
        </div>

        <h3>{{ report.listingName }}</h3>

        <p class="report-reason">
          <strong>{{ report.reason }}</strong>
          · Reported by {{ report.reporterName }}
        </p>

        <p v-if="report.explanation" class="report-explanation">
          {{ report.explanation }}
        </p>

        <div class="report-actions">
          <RouterLink
            :to="{
              name: 'admin-reports',
              query: { reportId: report.id },
            }"
            class="primary-button"
            :aria-label="`Review report for ${report.listingName}`"
          >
            Review
          </RouterLink>
        </div>
      </article>
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

h1,
h2 {
  margin: 0 0 12px;
}

p {
  line-height: 1.6;
}

.page-description,
.admin-card p {
  color: #6d6870;
  margin-bottom: 24px;
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.admin-card {
  display: flex;
  flex-direction: column;
  padding: 28px;
  background: white;
  border: 1px solid #e5dfe3;
  border-radius: 16px;
}

.admin-card a {
  align-self: flex-start;
  margin-top: auto;
  padding: 10px 18px;
  background: #683760;
  color: white;
  border-radius: 8px;
  text-decoration: none;
}

.notifications {
  margin-top: 40px;
}

.notifications-heading,
.heading-with-count,
.report-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.notifications-heading,
.report-heading {
  justify-content: space-between;
}

.notifications-heading h2 {
  margin: 0;
}

.report-counter {
  display: inline-grid;
  place-items: center;
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  box-sizing: border-box;
  border-radius: 20px;
  background: #683760;
  color: white;
  font-weight: bold;
  font-size: 14px;
}

.notification-description,
.report-reason,
.report-heading time {
  color: #6d6870;
  font-size: 14px;
}

.notification-card {
  margin-top: 16px;
  padding: 24px;
  background: white;
  border: 1px solid #e5dfe3;
  border-radius: 16px;
}

.notification-card h3 {
  margin: 16px 0 8px;
  font-size: 23px;
  overflow-wrap: anywhere;
}

.type-badge {
  padding: 5px 12px;
  border-radius: 20px;
  background: #f3edf5;
  color: #683760;
  font-size: 13px;
}

.unavailable-label {
  align-self: center;
  color: #6d6870;
  font-size: 14px;
}

.report-explanation {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.notification-card label {
  display: block;
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: bold;
}

textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #ddd5df;
  border-radius: 8px;
  background: #fffdfa;
  color: #44213f;
  font: inherit;
  resize: vertical;
}

.report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.primary-button,
.outline-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border: 1px solid #683760;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
}

.primary-button {
  background: #683760;
  color: white;
}

.outline-button {
  background: white;
  color: #683760;
}

.primary-button:hover:not(:disabled),
.admin-card a:hover {
  background: #542c4e;
}

.outline-button:hover:not(:disabled) {
  background: #f6edf5;
}

button:disabled {
  opacity: .6;
  cursor: not-allowed;
}

button:focus-visible,
a:focus-visible,
textarea:focus-visible {
  outline: 2px solid #683760;
  outline-offset: 3px;
}

.empty-state {
  padding: 28px;
  border: 1px solid #e5dfe3;
  border-radius: 12px;
  background: white;
  color: #6d6870;
  text-align: center;
}

.error-message {
  color: #a0273f;
}

.success-message {
  color: #286344;
}

@media (max-width: 900px) {
  .admin-grid {
    grid-template-columns: 1fr;
  }
}
</style>