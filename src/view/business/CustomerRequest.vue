<script>
import { businessApi, sendJson, money, shortDate, bestProduct } from '../../services/businessApi'
import { readableDate, today } from '../../services/communityApi'
import BusinessIcon from '../../components/BusinessIcon.vue'
export default {
  components: { BusinessIcon },
  data() {
    return { openRequests: [], repliedRequests: [], totals: { open: 0, replied: 0 }, pages: { open: 1, replied: 1 }, products: [], loading: true, loadingMore: false, error: '', needsProfile: false,
      tab: 'open', search: this.$route.query.search || '', selectedId: this.$route.query.request || '', linkedRequestId: this.$route.query.request || '',
      drafts: {}, pickerOpen: false, sending: false, sendError: '', sentNotice: '' }
  },
  computed: {
    openList() { return this.openRequests },
    repliedList() { return this.repliedRequests },
    visible() { return this.tab === 'open' ? this.openList : this.repliedList },
    selected() { return this.visible.find(r => r.requestId === this.selectedId) || this.visible[0] || null },
    draft() { return this.selected ? this.drafts[this.selected.requestId] : null },
    chosenProduct() { return this.products.find(p => p.productId === this.draft?.productId) || null },
    hasMore() { return this.visible.length < this.totals[this.tab] },
    canReply() { return !!this.selected && this.selected.status === 'open' && this.selected.deadline >= today() },
  },
  watch: {
    '$route.query.search'(value) { this.search = value || ''; this.load() },
    '$route.query.request'(value) { this.linkedRequestId = value || ''; if (value) { this.selectedId = value; this.load() } },
  },
  async mounted() {
    this.refreshTimer = setInterval(() => { if (!document.hidden && !this.loading && !this.sending && !this.loadingMore) this.refresh() }, 20000)
    window.addEventListener('focus', this.refresh)
    document.addEventListener('visibilitychange', this.refresh)
    try { this.products = (await businessApi('/products')).products.filter(p => p.status === 'active' && p.stock > 0) }
    catch (error) { if (error.status === 409) { this.needsProfile = true; this.loading = false; return } }
    await this.load()
    if (this.selectedId && this.repliedList.some(r => r.requestId === this.selectedId)) this.tab = 'replied'
  },
  beforeUnmount() { clearInterval(this.refreshTimer); window.removeEventListener('focus', this.refresh); document.removeEventListener('visibilitychange', this.refresh) },
  methods: {
    money, shortDate, readableDate,
    requestState(request) {
      if (request.fulfilled && request.acceptedResponseId && request.myResponses.some(reply => reply.responseId === request.acceptedResponseId)) return 'Purchased'
      if (request.acceptedResponseId && request.myResponses.some(reply => reply.responseId === request.acceptedResponseId)) return 'Accepted'
      if (request.expired || (request.status === 'open' && request.deadline < today())) return 'Expired'
      if (request.status === 'closed') return 'Closed'
      return request.myResponses.length ? 'Replied' : 'Open'
    },
    async refresh() {
      if (this.sending || document.hidden) return
      this.error = ''
      try { this.products = (await businessApi('/products')).products.filter(p => p.status === 'active' && p.stock > 0); await this.load({ preservePages: true }) }
      catch (error) { this.error = error.message }
    },
    initial(name) { return (name || 'C').charAt(0).toUpperCase() },
    prepare(list) {
      for (const request of list) {
        if (this.drafts[request.requestId]) continue
        const product = bestProduct(this.products, request)
        this.drafts[request.requestId] = { productId: product?.productId || '', message: this.suggestedMessage(request, product) }
      }
    },
    suggestedMessage(request, product) {
      if (!product) return ''
      const fits = product.price <= request.budget
      return `Hi ${request.consumerName}, our ${product.name.toLowerCase()} ${fits ? 'fits your budget and ' : ''}would work well for your ${request.occasion.toLowerCase()}.`
    },
    async fetchPage(tab, page) {
      const query = new URLSearchParams({ tab, page })
      if (this.search) query.set('search', this.search)
      return businessApi(`/requests?${query}`)
    },
    async load({ preservePages = false } = {}) {
      this.loading = true; this.error = ''
      try {
        // Auto-refresh must retain expanded history, not send a business back
        // to the first page every 20 seconds. A new search resets pagination.
        const fetchLoaded = async tab => {
          const count = preservePages ? Math.max(1, this.pages[tab]) : 1
          const responses = await Promise.all(Array.from({ length: count }, (_, n) => this.fetchPage(tab, n + 1)))
          const first = responses[0]
          const seen = new Set()
          const requests = responses.flatMap(result => result.requests).filter(item => {
            if (seen.has(item.requestId)) return false
            seen.add(item.requestId)
            return true
          })
          return { requests, total: first.total, page: Math.min(count, Math.max(1, Math.ceil(first.total / 12))) }
        }
        const [open, replied] = await Promise.all([fetchLoaded('open'), fetchLoaded('replied')])
        this.openRequests = open.requests; this.repliedRequests = replied.requests
        this.totals = { open: open.total, replied: replied.total }
        this.pages = { open: open.page, replied: replied.page }
        this.prepare([...open.requests, ...replied.requests])
        // The dashboard can point to a request on page 2+ of either tab.
        // Fetch only that request (server still enforces business visibility).
        const linkedId = this.linkedRequestId
        if (linkedId && ![...this.openList, ...this.repliedList].some(r => r.requestId === linkedId)) {
          const [targetOpen, targetReplied] = await Promise.all([
            businessApi(`/requests?${new URLSearchParams({ tab: 'open', requestId: linkedId })}`),
            businessApi(`/requests?${new URLSearchParams({ tab: 'replied', requestId: linkedId })}`),
          ])
          const target = targetOpen.requests[0] || targetReplied.requests[0]
          if (target) {
            const list = targetOpen.requests.length ? this.openRequests : this.repliedRequests
            if (!list.some(r => r.requestId === linkedId)) list.unshift(target)
            this.prepare([target])
          } else {
            this.linkedRequestId = ''
            this.error = 'That request is no longer available in your inbox.'
          }
        }
        if (linkedId && this.openList.some(r => r.requestId === linkedId)) this.tab = 'open'
        else if (linkedId && this.repliedList.some(r => r.requestId === linkedId)) this.tab = 'replied'
        if (this.selectedId && !this.visible.some(r => r.requestId === this.selectedId)) {
          const other = this.tab === 'open' ? this.repliedList : this.openList
          if (other.some(r => r.requestId === this.selectedId)) this.tab = this.tab === 'open' ? 'replied' : 'open'
        }
        if (!this.visible.some(r => r.requestId === this.selectedId)) this.selectedId = this.visible[0]?.requestId || ''
      } catch (error) { if (error.status === 409) this.needsProfile = true; else this.error = error.message }
      finally { this.loading = false }
    },
    async loadMore() {
      if (this.loadingMore || !this.hasMore) return
      const tab = this.tab
      this.loadingMore = true
      try {
        const result = await this.fetchPage(tab, this.pages[tab] + 1)
        const list = tab === 'open' ? this.openRequests : this.repliedRequests
        const known = new Set(list.map(r => r.requestId))
        list.push(...result.requests.filter(r => !known.has(r.requestId)))
        this.pages[tab] = result.page; this.totals[tab] = result.total
        this.prepare(result.requests)
      } catch (error) { this.error = error.message }
      finally { this.loadingMore = false }
    },
    setTab(tab) { this.tab = tab; this.selectedId = this.visible[0]?.requestId || ''; this.sentNotice = ''; this.pickerOpen = false },
    select(request) { this.selectedId = request.requestId; this.pickerOpen = false; this.sendError = ''; this.sentNotice = '' },
    choose(product) {
      // Person 4: swap the ready-made message to the new product, unless the business already wrote their own.
      const message = this.draft.message.trim()
      if (!message || message === this.suggestedMessage(this.selected, this.chosenProduct)) this.draft.message = this.suggestedMessage(this.selected, product)
      this.draft.productId = product.productId; this.pickerOpen = false
    },
    async send() {
      const request = this.selected
      if (!this.canReply || !this.draft?.productId || !this.draft.message.trim() || this.sending) return
      this.sending = true; this.sendError = ''; this.sentNotice = ''
      try {
        const result = await businessApi(`/requests/${request.requestId}/responses`, sendJson('POST', this.draft))
        const wasReplied = request.myResponses.length > 0
        request.myResponses.push(result.response)
        request.responseCount++
        if (!wasReplied) {
          this.openRequests = this.openRequests.filter(item => item.requestId !== request.requestId)
          this.totals.open = Math.max(0, this.totals.open - 1)
          this.repliedRequests.unshift(request)
          this.totals.replied++
        }
        this.tab = 'replied'
        this.selectedId = request.requestId
        this.sentNotice = `Sent. ${request.consumerName} will see your suggestion on their request.`
      } catch (error) { this.sendError = error.message }
      finally { this.sending = false }
    },
  },
}
</script>
<template>
  <section aria-labelledby="biz-requests-heading">
    <div class="biz-page-head"><div><h1 id="biz-requests-heading">Meet a customer’s next outfit</h1><p>Respond to requests that match your collection.</p></div></div>
    <div v-if="needsProfile" class="biz-empty"><h2>Set up your business first</h2><RouterLink :to="{ name: 'business-profile' }" class="biz-btn">Set up profile</RouterLink></div>
    <template v-else>
      <div v-if="error" class="biz-error" role="alert">{{ error }} <button @click="load">Try again</button></div>
      <div class="biz-requests">
        <div class="biz-request-list">
          <div class="biz-request-tools">
            <div class="biz-segment" role="tablist" aria-label="Requests">
              <button type="button" role="tab" :aria-selected="tab === 'open'" :class="{ selected: tab === 'open' }" @click="setTab('open')">Open ({{ totals.open }})</button>
              <button type="button" role="tab" :aria-selected="tab === 'replied'" :class="{ selected: tab === 'replied' }" @click="setTab('replied')">Replied ({{ totals.replied }})</button>
            </div>
            <form class="biz-input-icon" role="search" @submit.prevent="load"><BusinessIcon name="search" :size="18" /><label for="request-list-search" class="visually-hidden">Search requests</label><input id="request-list-search" v-model.trim="search" type="search" maxlength="80" class="form-control" placeholder="Search requests…" @change="load" /></form>
          </div>
          <p v-if="loading" role="status" class="biz-loading">Loading requests…</p>
          <p v-else-if="!visible.length" class="biz-muted text-center py-5">{{ tab === 'open' ? 'No open requests waiting for you.' : 'You haven’t sent any suggestions yet.' }}</p>
          <button v-for="request in visible" v-else :key="request.requestId" type="button" class="biz-request-item" :class="{ selected: selected?.requestId === request.requestId }" :aria-pressed="selected?.requestId === request.requestId" @click="select(request)">
            <span class="biz-avatar">{{ initial(request.consumerName) }}</span>
            <span>
              <span class="biz-request-top"><strong>{{ request.consumerName }}</strong><span class="biz-pill" :class="request.myResponses.length ? 'green' : 'yellow'">{{ requestState(request) }}</span></span>
              <p>{{ request.title }}</p>
              <span class="biz-request-tags"><span class="biz-pill pink"><BusinessIcon name="coins" :size="15" /> {{ money(request.budget) }} budget</span><span class="biz-pill">{{ request.preferredStyle }}</span><span class="biz-pill plain"><BusinessIcon name="calendar" :size="15" /> {{ shortDate(request.deadline) }}</span></span>
            </span>
            <BusinessIcon name="chevron-right" :size="20" />
          </button>
          <button v-if="hasMore && !loading" type="button" class="biz-btn biz-btn-outline w-100" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? 'Loading…' : 'Load more requests' }}</button>
        </div>

        <article v-if="selected" class="biz-request-detail" aria-live="polite">
          <div class="biz-request-person">
            <span class="biz-avatar">{{ initial(selected.consumerName) }}</span>
            <div><strong>{{ selected.consumerName }}</strong><span class="biz-pill" :class="selected.myResponses.length ? 'green' : 'yellow'">{{ requestState(selected) }}</span>
              <div class="biz-muted">Requested on {{ shortDate(selected.createdAt) }} · {{ selected.responseCount }} {{ selected.responseCount === 1 ? 'reply' : 'replies' }} so far</div></div>
          </div>
          <h2>{{ selected.title }}</h2>
          <p class="biz-request-desc">{{ selected.occasion }}. {{ selected.description }}</p>
          <div class="biz-request-facts">
            <div><BusinessIcon name="coins" :size="28" /><span><strong>{{ money(selected.budget) }}</strong><small>Budget</small></span></div>
            <div><BusinessIcon name="tag" :size="28" /><span><strong>{{ selected.preferredStyle }}</strong><small>Preferred style</small></span></div>
            <div><BusinessIcon name="calendar" :size="28" /><span><strong>{{ readableDate(selected.deadline) }}</strong><small>Needed by</small></span></div>
          </div>

          <div v-if="selected.myResponses.length" class="biz-replied">
            <div v-for="reply in selected.myResponses" :key="reply.productId"><BusinessIcon name="check" :size="16" /> You suggested <strong>{{ reply.productName }}</strong>: “{{ reply.message }}”</div>
          </div>
          <div v-if="sentNotice" class="biz-success" role="status">{{ sentNotice }}</div>

          <p v-if="!canReply" class="biz-muted">This request is no longer accepting suggestions. Your earlier suggestions remain above for reference.</p>
          <template v-else>
          <h3>{{ selected.myResponses.length ? 'Suggest another product' : 'Send a suggestion' }}</h3>
          <p v-if="!products.length" class="biz-muted">You need a product showing in the store before you can reply. <RouterLink :to="{ name: 'business-product-new' }">Add a product</RouterLink>.</p>
          <form v-else @submit.prevent="send">
            <p class="form-label" id="choose-product-label">Choose a product</p>
            <div class="biz-product-picker">
              <button type="button" class="biz-product-option" aria-labelledby="choose-product-label" :aria-expanded="pickerOpen" @click="pickerOpen = !pickerOpen">
                <img v-if="chosenProduct" :src="chosenProduct.imageURL" :alt="chosenProduct.name" />
                <span v-if="chosenProduct"><strong>{{ chosenProduct.name }}</strong><span class="price">{{ money(chosenProduct.price) }}</span>
                  <span v-if="chosenProduct.price <= selected.budget" class="biz-pill green"><BusinessIcon name="check" :size="15" /> Within budget</span>
                  <span v-else class="biz-pill yellow">{{ money(chosenProduct.price - selected.budget) }} over budget</span></span>
                <span v-else>Choose one of your products</span>
                <BusinessIcon name="chevron-right" :size="20" />
              </button>
              <div v-if="pickerOpen" class="biz-product-list" role="listbox" aria-labelledby="choose-product-label">
                <button v-for="product in products" :key="product.productId" type="button" role="option" class="biz-product-option" :aria-selected="product.productId === draft.productId" @click="choose(product)">
                  <img :src="product.imageURL" :alt="''" />
                  <span><strong>{{ product.name }}</strong><span class="price">{{ money(product.price) }} · {{ product.style }}</span></span>
                </button>
              </div>
            </div>
            <div class="biz-field"><label :for="`message-${selected.requestId}`" class="form-label">Message</label>
              <textarea :id="`message-${selected.requestId}`" v-model="draft.message" class="form-control" rows="3" maxlength="1000" required></textarea></div>
            <div v-if="sendError" class="biz-error" role="alert">{{ sendError }}</div>
            <button class="biz-btn w-100" :disabled="sending || !draft.productId">{{ sending ? 'Sending…' : 'Send suggestion' }}</button>
            <p class="biz-caption">{{ selected.consumerName }} will see your suggestion on their request.</p>
          </form>
          </template>
        </article>
        <div v-else-if="!loading" class="biz-request-detail biz-muted text-center">Choose a request to see the details.</div>
      </div>
    </template>
  </section>
</template>
