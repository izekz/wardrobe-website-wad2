<script>
import { communityApi, money, readableDate, today } from '../../services/communityApi'
import CommunityTabs from '../../components/CommunityTabs.vue'
export default {
  components: { CommunityTabs },
  data() { return { item: null, responses: [], loading: false, error: '', loadVersion: 0 } },
  watch: { '$route.params.requestId': { immediate: true, handler() { this.loadRequest() } } },
  methods: {
    money, readableDate, today,
    async loadRequest() {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''; this.item = null; this.responses = []
      try { const result = await communityApi(`/requests/${encodeURIComponent(this.$route.params.requestId)}`); if (version === this.loadVersion) { this.item = result.request; this.responses = result.responses } }
      catch (error) { if (version === this.loadVersion) this.error = error.message }
      finally { if (version === this.loadVersion) this.loading = false }
    },
  },
}
</script>
<template>
  <section class="request-detail-page">
    <CommunityTabs />
    <RouterLink :to="{ name: 'community-requests' }" class="d-inline-block mb-4">← Back to outfit requests</RouterLink>
    <p v-if="loading" role="status">Loading request and suggestions…</p>
    <div v-else-if="error" class="alert alert-danger" role="alert">{{ error }} <button class="btn btn-link" @click="loadRequest">Try again</button></div>
    <template v-else-if="item">
      <p v-if="$route.query.posted === '1'" class="alert alert-success" role="status">Your request has been saved.</p>
      <div class="row g-4">
        <div class="col-lg-7"><div class="community-panel"><p class="community-eyebrow">Requested by {{ item.consumerName }}</p><h1>{{ item.title }}</h1><p class="community-muted mt-3">{{ item.occasion }}</p><div class="d-flex flex-wrap gap-2 my-4"><span class="community-tag peach">Budget {{ money(item.budget) }}</span><span class="community-tag">{{ item.preferredStyle }}</span><span class="community-tag yellow">By {{ readableDate(item.deadline) }}</span><span class="community-tag">{{ item.deadline < today() ? 'Deadline passed' : item.status }}</span></div><p class="community-description mb-0">{{ item.description }}</p></div></div>
        <div class="col-lg-5"><div class="community-panel" style="background: #f0e8f6"><h2>A little context goes a long way</h2><p class="mb-0">Your occasion, budget and style help businesses find a piece that could work for you.</p></div></div>
      </div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-5 mb-3"><h2 class="mb-0">Suggestions ({{ responses.length }})</h2><button class="community-btn community-btn-outline" @click="loadRequest">Refresh suggestions</button></div>
      <div v-if="!responses.length" class="community-empty"><h2>No suggestions yet</h2><p class="mb-0">Check back when a business has responded to this request.</p></div>
      <div v-else class="row g-3"><div v-for="reply in responses" :key="reply.responseId" class="col-md-6"><article class="community-panel h-100"><p class="community-eyebrow">{{ reply.businessName }}</p><h2>{{ reply.productName }}</h2><p class="community-price">{{ money(reply.productPrice) }}</p><span class="community-tag" :class="{ yellow: reply.productPrice > item.budget }">{{ reply.productPrice <= item.budget ? 'Within your budget' : 'Above your budget' }}</span><p class="community-description mt-3 mb-0">{{ reply.message }}</p></article></div></div>
    </template>
  </section>
</template>
