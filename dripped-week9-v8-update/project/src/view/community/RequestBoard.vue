<script>
import { communityApi, styles, money, today, readableDate, queryString } from '../../services/communityApi'
import CommunityIcon from '../../components/CommunityIcon.vue'
import CommunityTabs from '../../components/CommunityTabs.vue'
import RequestCard from '../../components/RequestCard.vue'
import { authState } from '../../services/authService'
const blankRequest = () => ({ title: '', occasion: '', budget: '', preferredStyle: '', deadline: '', description: '' })
export default {
  components: { CommunityIcon, CommunityTabs, RequestCard },
  data() { return { requests: [], total: 0, page: 1, pageSize: 12, loading: false, loadVersion: 0,
    error: '', formError: '', posting: false, styles, form: blankRequest(),
    refreshError: '', filters: { search: '', style: '', status: '', mine: this.$route.query.mine === 'true' }, clientRequestId: crypto.randomUUID() } },
  computed: { canPost() { return ['consumer', 'customer'].includes(authState.user?.role) }, minimumDate() { return today() } },
  mounted() {
    this.loadRequests()
    window.addEventListener('focus', this.refresh)
    document.addEventListener('visibilitychange', this.refresh)
    this.refreshTimer = setInterval(this.refresh, 15000)
  },
  beforeUnmount() { this.loadVersion++; clearInterval(this.refreshTimer); window.removeEventListener('focus', this.refresh); document.removeEventListener('visibilitychange', this.refresh) },
  methods: {
    money, readableDate, today,
    initial(name) { return (name || 'Member').charAt(0).toUpperCase() },
    postedOn(value) { return new Date(value).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' }) },
    setScope(value) { this.filters.mine = value; this.loadRequests(1) },
    refresh() { if (!document.hidden && !this.loading && !this.posting) this.loadRequests(this.page, true) },
    markChanged() { this.formError = ''; this.clientRequestId = crypto.randomUUID() },
    async loadRequests(page = 1, quiet = false) {
      const version = ++this.loadVersion
      if (!quiet) this.loading = true
      this.error = ''; this.refreshError = ''
      try {
        const result = await communityApi(`/requests?${queryString({ ...this.filters, page })}`)
        if (version !== this.loadVersion) return
        this.requests = result.requests; this.total = result.total; this.page = result.page; this.pageSize = result.pageSize
      } catch (error) { if (version === this.loadVersion) { if (quiet) this.refreshError = error.message; else this.error = error.message } }
      finally { if (version === this.loadVersion) this.loading = false }
    },
    async postRequest() {
      if (this.posting || !this.$refs.requestForm.reportValidity()) return
      this.posting = true; this.formError = ''
      try {
        const result = await communityApi('/requests', { method: 'POST', body: JSON.stringify({ ...this.form, clientRequestId: this.clientRequestId }) })
        // The details page fetches the saved request from the backend again.
        await this.$router.push({ name: 'community-request', params: { requestId: result.request.requestId }, query: { posted: '1' } })
      } catch (error) { this.formError = error.message }
      finally { this.posting = false }
    },
  },
}
</script>
<template>
  <section class="request-board-page" aria-labelledby="request-board-heading">
    <CommunityTabs />
    <div class="request-board-layout" :class="{ 'request-board-readonly': !canPost }">
      <div class="request-board-content">
        <div class="request-board-heading"><h1 id="request-board-heading">Find the piece you’re missing</h1><p>Tell the community what you need, for your occasion and budget.</p></div>
        <form class="request-toolbar" @submit.prevent="loadRequests(1)">
          <div class="community-segmented request-scope-switch" role="group" aria-label="Whose requests"><button type="button" :class="{ selected: !filters.mine }" :aria-pressed="!filters.mine" @click="setScope(false)">All requests</button><button v-if="canPost" type="button" :class="{ selected: filters.mine }" :aria-pressed="filters.mine" @click="setScope(true)">My requests</button></div>
          <div class="community-select-wrap"><label for="request-status-filter" class="visually-hidden">Request status</label><select id="request-status-filter" v-model="filters.status" class="community-select" @change="loadRequests(1)"><option value="">Open &amp; closed</option><option value="open">Open only</option><option value="closed">Closed only</option></select></div>
          <div class="community-search"><button type="submit" aria-label="Search requests"><CommunityIcon name="search" /></button><label for="request-search" class="visually-hidden">Search requests</label><input id="request-search" v-model.trim="filters.search" maxlength="80" type="search" placeholder="Search requests (e.g. jacket, dress)" @change="loadRequests(1)" /></div>
          <div class="community-select-wrap"><label for="request-style-filter" class="visually-hidden">Filter requests by style</label><select id="request-style-filter" v-model="filters.style" class="community-select" @change="loadRequests(1)"><option value="">All styles</option><option v-for="style in styles" :key="style">{{ style }}</option></select><CommunityIcon name="chevron" :size="16" /></div>
        </form>
        <p class="community-muted small">Open requests appear first, with closed requests below. Your requests are labelled and highlighted.</p>
        <div class="d-flex align-items-center flex-wrap gap-3 mb-3"><button type="button" class="community-text-button" :disabled="loading" @click="loadRequests(page)">Refresh requests</button><span class="community-muted small">Suggestion counts update automatically.</span></div>
        <p v-if="refreshError" class="community-error" role="alert">{{ refreshError }}</p>
        <p v-if="loading" role="status" class="community-loading">Loading community requests…</p>
        <div v-else-if="error" class="community-error" role="alert">{{ error }} <button class="community-text-button" @click="loadRequests(page)">Try again</button></div>
        <template v-else>
          <p class="visually-hidden" role="status">{{ total }} requests</p>
          <div v-if="!requests.length" class="community-empty"><CommunityIcon name="hanger" :size="44" /><h2>Your next outfit starts here</h2><p>No matching requests yet. Tell us what you’re looking for.</p><a v-if="canPost" href="#request-title" class="community-text-button" @click.prevent="$refs.requestTitle.focus()">Post the first request <CommunityIcon name="arrow" /></a></div>
          <template v-for="(request, index) in requests" :key="request.requestId">
            <p v-if="filters.status !== 'open' && request.status === 'closed' && (index === 0 || requests[index - 1].status !== 'closed')" class="request-section-divider">Closed requests · kept for reference</p>
            <RequestCard :request="request" :index="index" />
          </template>
          <nav v-if="total > pageSize" class="community-pagination" aria-label="Request pages"><button class="community-btn community-btn-outline" :disabled="page === 1" @click="loadRequests(page - 1)">Previous</button><span>Page {{ page }}</span><button class="community-btn community-btn-outline" :disabled="page * pageSize >= total" @click="loadRequests(page + 1)">Next</button></nav>
        </template>
      </div>
      <form v-if="canPost" ref="requestForm" class="request-create-panel" @submit.prevent="postRequest" @input="markChanged" @change="markChanged" :aria-busy="posting">
        <h2>Post a request</h2><p class="request-create-intro">Tell the community what you’re looking for and find a piece that feels like you.</p>
        <fieldset :disabled="posting" class="border-0 p-0 m-0">
          <div class="request-field"><label for="request-title" class="form-label">Looking for <span aria-hidden="true">*</span></label><input id="request-title" ref="requestTitle" v-model.trim="form.title" class="form-control" required maxlength="100" placeholder="e.g. dress, jacket, jeans, shoes" /></div>
          <div class="request-field"><label for="request-occasion" class="form-label">Occasion <span aria-hidden="true">*</span></label><input id="request-occasion" v-model.trim="form.occasion" class="form-control" list="occasion-choices" required maxlength="80" placeholder="Choose or enter an occasion" /><datalist id="occasion-choices"><option>University presentation</option><option>Interview</option><option>Wedding</option><option>Date</option><option>Casual outing</option></datalist></div>
          <div class="request-field"><label for="request-budget" class="form-label">Budget (S$) <span aria-hidden="true">*</span></label><input id="request-budget" v-model.number="form.budget" type="number" class="form-control" min="0" max="100000" step="0.01" required placeholder="e.g. 40" /></div>
          <div class="request-field"><label for="request-style" class="form-label">Preferred style <span aria-hidden="true">*</span></label><select id="request-style" v-model="form.preferredStyle" class="form-select" required><option disabled value="">Select a style</option><option v-for="style in styles" :key="style">{{ style }}</option></select></div>
          <div class="request-field"><label for="request-deadline" class="form-label">Needed by <span aria-hidden="true">*</span></label><input id="request-deadline" v-model="form.deadline" type="date" class="form-control" :min="minimumDate" required /></div>
          <div class="request-field"><label for="request-description" class="form-label">Additional details <span aria-hidden="true">*</span></label><textarea id="request-description" v-model.trim="form.description" class="form-control" rows="3" maxlength="1000" required placeholder="Add any specific details (e.g. colour, size, brand preferences)."></textarea></div>
          <p v-if="formError" class="community-error" role="alert">{{ formError }}</p>
          <button class="community-btn w-100" :disabled="posting">{{ posting ? 'Posting…' : 'Post request' }}</button>
        </fieldset>
      </form>
    </div>
  </section>
</template>
