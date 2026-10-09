<script>
import { businessApi, sendJson, money, shortDate, bestProduct } from '../../services/businessApi'
import { readableDate } from '../../services/communityApi'
import BusinessIcon from '../../components/BusinessIcon.vue'
export default {
  components: { BusinessIcon },
  data() {
    return { requests: [], products: [], total: 0, page: 1, loading: true, loadingMore: false, error: '', needsProfile: false,
      tab: 'open', search: this.$route.query.search || '', selectedId: this.$route.query.request || '',
      drafts: {}, pickerOpen: false, sending: false, sendError: '', sentNotice: '' }
  },
  computed: {
    openList() { return this.requests.filter(r => !r.myResponses.length) },
    repliedList() { return this.requests.filter(r => r.myResponses.length) },
    visible() { return this.tab === 'open' ? this.openList : this.repliedList },
    selected() { return this.requests.find(r => r.requestId === this.selectedId) || this.visible[0] || null },
    draft() { return this.selected ? this.drafts[this.selected.requestId] : null },
    chosenProduct() { return this.products.find(p => p.productId === this.draft?.productId) || null },
    hasMore() { return this.requests.length < this.total },
  },
  watch: {
    '$route.query.search'(value) { this.search = value || ''; this.load() },
    '$route.query.request'(value) { if (value) this.selectedId = value },
  },
  async mounted() {
    try { this.products = (await businessApi('/products')).products.filter(p => p.status === 'active' && p.stock > 0) }
    catch (error) { if (error.status === 409) { this.needsProfile = true; this.loading = false; return } }
    await this.load()
    if (this.selectedId && this.repliedList.some(r => r.requestId === this.selectedId)) this.tab = 'replied'
  },
  methods: {
    money, shortDate, readableDate,
    initial(name) { return (name || 'C').charAt(0).toUpperCase() },
    prepare(list) {
      for (const request of list) {
        if (this.drafts[request.requestId]) continue
        const product = bestProduct(this.products, request)
        const fits = product && product.price <= request.budget
        this.drafts[request.requestId] = { productId: product?.productId || '',
          message: product ? `Hi ${request.consumerName}, our ${product.name.toLowerCase()} ${fits ? 'fits your budget and ' : ''}would work well for your ${request.occasion.toLowerCase()}.` : '' }
      }
    },
    async fetchPage(page) {
      const query = new URLSearchParams({ page })
      if (this.search) query.set('search', this.search)
      return businessApi(`/requests?${query}`)
    },
    async load() {
      this.loading = true; this.error = ''
      try {
        const result = await this.fetchPage(1)
        this.requests = result.requests; this.total = result.total; this.page = 1
        this.prepare(this.requests)
      } catch (error) { if (error.status === 409) this.needsProfile = true; else this.error = error.message }
      finally { this.loading = false }
    },
    async loadMore() {
      this.loadingMore = true
      try {
        const result = await this.fetchPage(this.page + 1)
        const known = new Set(this.requests.map(r => r.requestId))
        this.requests.push(...result.requests.filter(r => !known.has(r.requestId)))
        this.page = result.page; this.total = result.total
        this.prepare(result.requests)
      } catch (error) { this.error = error.message }
      finally { this.loadingMore = false }
    },
    setTab(tab) { this.tab = tab; this.selectedId = this.visible[0]?.requestId || ''; this.sentNotice = ''; this.pickerOpen = false },
    select(request) { this.selectedId = request.requestId; this.pickerOpen = false; this.sendError = ''; this.sentNotice = '' },
    choose(product) { this.draft.productId = product.productId; this.pickerOpen = false },
    async send() {
      const request = this.selected
      if (!this.draft.productId || !this.draft.message.trim() || this.sending) return
      this.sending = true; this.sendError = ''; this.sentNotice = ''
      try {
        await businessApi(`/requests/${request.requestId}/responses`, sendJson('POST', this.draft))
        request.myResponses.push({ productId: this.draft.productId, productName: this.chosenProduct?.name, message: this.draft.message })
        request.responseCount++
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
              <button type="button" role="tab" :aria-selected="tab === 'open'" :class="{ selected: tab === 'open' }" @click="setTab('open')">Open ({{ openList.length }})</button>
              <button type="button" role="tab" :aria-selected="tab === 'replied'" :class="{ selected: tab === 'replied' }" @click="setTab('replied')">Replied ({{ repliedList.length }})</button>
            </div>
            <form class="biz-input-icon" role="search" @submit.prevent="load"><BusinessIcon name="search" :size="18" /><label for="request-list-search" class="visually-hidden">Search requests</label><input id="request-list-search" v-model.trim="search" type="search" maxlength="80" class="form-control" placeholder="Search requests…" @change="load" /></form>
          </div>
          <p v-if="loading" role="status" class="biz-loading">Loading requests…</p>
          <p v-else-if="!visible.length" class="biz-muted text-center py-5">{{ tab === 'open' ? 'No open requests waiting for you.' : 'You haven’t replied to any open requests yet.' }}</p>
          <button v-for="request in visible" v-else :key="request.requestId" type="button" class="biz-request-item" :class="{ selected: selected?.requestId === request.requestId }" :aria-pressed="selected?.requestId === request.requestId" @click="select(request)">
            <span class="biz-avatar">{{ initial(request.consumerName) }}</span>
            <span>
              <span class="biz-request-top"><strong>{{ request.consumerName }}</strong><span class="biz-pill" :class="request.myResponses.length ? 'green' : 'yellow'">{{ request.myResponses.length ? 'Replied' : 'Open' }}</span></span>
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
            <div><strong>{{ selected.consumerName }}</strong><span class="biz-pill" :class="selected.myResponses.length ? 'green' : 'yellow'">{{ selected.myResponses.length ? 'Replied' : 'Open' }}</span>
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
        </article>
        <div v-else-if="!loading" class="biz-request-detail biz-muted text-center">Choose a request to see the details.</div>
      </div>
    </template>
  </section>
</template>
