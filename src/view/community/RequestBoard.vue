<script>
import { communityApi, styles, money, today, readableDate, queryString } from '../../services/communityApi'
import CommunityIcon from '../../components/CommunityIcon.vue'
import CommunityTabs from '../../components/CommunityTabs.vue'
const blankRequest = () => ({ title: '', occasion: '', budget: '', preferredStyle: '', deadline: '', description: '' })
export default {
  components: { CommunityIcon, CommunityTabs },
  data() { return { requests: [], total: 0, page: 1, pageSize: 12, loading: false, loadVersion: 0,
    error: '', formError: '', posting: false, styles, form: blankRequest(),
    filters: { search: '', style: '', openOnly: true }, clientRequestId: crypto.randomUUID() } },
  computed: { minimumDate() { return today() } },
  mounted() { this.loadRequests() },
  methods: {
    money, readableDate, today,
    initial(name) { return (name || 'Member').charAt(0).toUpperCase() },
    postedOn(value) { return new Date(value).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' }) },
    setOpenOnly(value) { this.filters.openOnly = value; this.loadRequests(1) },
    markChanged() { this.formError = ''; this.clientRequestId = crypto.randomUUID() },
    async loadRequests(page = 1) {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''
      try {
        const result = await communityApi(`/requests?${queryString({ ...this.filters, page })}`)
        if (version !== this.loadVersion) return
        this.requests = result.requests; this.total = result.total; this.page = result.page; this.pageSize = result.pageSize
      } catch (error) { if (version === this.loadVersion) this.error = error.message }
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
    <div class="request-board-layout">
      <div class="request-board-content">
        <div class="request-board-heading"><h1 id="request-board-heading">Find the piece you’re missing</h1><p>Tell the community what you need, for your occasion and budget.</p></div>
        <form class="request-toolbar" @submit.prevent="loadRequests(1)">
          <div class="community-segmented request-scope-switch" role="group" aria-label="Request status"><button type="button" :class="{ selected: !filters.openOnly }" :aria-pressed="!filters.openOnly" @click="setOpenOnly(false)">All requests</button><button type="button" :class="{ selected: filters.openOnly }" :aria-pressed="filters.openOnly" @click="setOpenOnly(true)">Open only</button></div>
          <div class="community-search"><button type="submit" aria-label="Search requests"><CommunityIcon name="search" /></button><label for="request-search" class="visually-hidden">Search requests</label><input id="request-search" v-model.trim="filters.search" maxlength="80" type="search" placeholder="Search requests (e.g. jacket, dress)" @change="loadRequests(1)" /></div>
          <div class="community-select-wrap"><label for="request-style-filter" class="visually-hidden">Filter requests by style</label><select id="request-style-filter" v-model="filters.style" class="community-select" @change="loadRequests(1)"><option value="">All styles</option><option v-for="style in styles" :key="style">{{ style }}</option></select><CommunityIcon name="chevron" :size="16" /></div>
        </form>
        <p v-if="loading" role="status" class="community-loading">Loading community requests…</p>
        <div v-else-if="error" class="community-error" role="alert">{{ error }} <button class="community-text-button" @click="loadRequests(page)">Try again</button></div>
        <template v-else>
          <p class="visually-hidden" role="status">{{ total }} requests</p>
          <div v-if="!requests.length" class="community-empty"><CommunityIcon name="hanger" :size="44" /><h2>Your next outfit starts here</h2><p>No matching requests yet. Tell us what you’re looking for.</p><a href="#request-title" class="community-text-button" @click.prevent="$refs.requestTitle.focus()">Post the first request <CommunityIcon name="arrow" /></a></div>
          <article v-for="(request, index) in requests" :key="request.requestId" class="outfit-request-card">
            <div class="outfit-request-art" :class="['art-' + (index % 3)]" aria-hidden="true"><CommunityIcon name="shirt" :size="70" /><span>{{ request.preferredStyle }}</span></div>
            <div class="outfit-request-body">
              <div class="outfit-request-topline"><div class="community-seller"><span class="community-avatar community-avatar-small" aria-hidden="true">{{ initial(request.consumerName) }}</span><div><span class="community-seller-name">{{ request.consumerName }}</span><span class="community-seller-style">Posted {{ postedOn(request.createdAt) }}</span></div></div><span class="community-tag" :class="request.status === 'open' && request.deadline >= today() ? 'green' : 'pink'">{{ request.deadline < today() ? 'Deadline passed' : request.status === 'open' ? 'Open' : 'Closed' }}</span></div>
              <h2>{{ request.title }}</h2><p class="request-occasion">{{ request.occasion }}</p><p class="request-description">{{ request.description }}</p>
              <div class="outfit-request-tags"><span class="community-tag pink"><CommunityIcon name="tag" :size="17" /> Budget {{ money(request.budget) }}</span><span class="community-tag lilac"><CommunityIcon name="hanger" :size="18" /> {{ request.preferredStyle }}</span><span class="community-tag yellow"><CommunityIcon name="calendar" :size="17" /> Needed by {{ readableDate(request.deadline) }}</span></div>
              <div class="outfit-request-footer"><span><CommunityIcon name="message" :size="18" /> Suggestions</span><RouterLink :to="{ name: 'community-request', params: { requestId: request.requestId } }">View request <CommunityIcon name="arrow" :size="18" /></RouterLink></div>
            </div>
          </article>
          <nav v-if="total > pageSize" class="community-pagination" aria-label="Request pages"><button class="community-btn community-btn-outline" :disabled="page === 1" @click="loadRequests(page - 1)">Previous</button><span>Page {{ page }}</span><button class="community-btn community-btn-outline" :disabled="page * pageSize >= total" @click="loadRequests(page + 1)">Next</button></nav>
        </template>
      </div>
      <form ref="requestForm" class="request-create-panel" @submit.prevent="postRequest" @input="markChanged" @change="markChanged" :aria-busy="posting">
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
