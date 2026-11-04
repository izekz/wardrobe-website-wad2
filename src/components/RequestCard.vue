<script>
import { authState } from '../services/authService'
import CommunityIcon from './CommunityIcon.vue'
import ReportDialog from './ReportDialog.vue'
import { money, readableDate, today } from '../services/communityApi'
export default {
  components: { CommunityIcon, ReportDialog },
  props: { request: { type: Object, required: true }, index: { type: Number, default: 0 }, personal: { type: Boolean, default: false }, deleting: { type: Boolean, default: false } },
  emits: ['delete-request'],
  data() {
    return { reportOpen: false }
  },
  computed: {
    isMine() {
      return this.request.consumerId === authState.user?.id
    },
    canReport() {
      return !!authState.user && !this.isMine && !this.personal
    },
  },
  methods: {
    money, readableDate, today,
    postedOn(value) { return new Date(value).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' }) },
  },
}
</script>
<template>
  <article class="outfit-request-card" :class="{ 'request-is-closed': request.status === 'closed', 'request-is-mine': isMine }">
    <div class="outfit-request-art" :class="'art-' + (index % 3)" aria-hidden="true"><CommunityIcon name="shirt" :size="70" /><span>{{ request.preferredStyle }}</span></div>
    <div class="outfit-request-body">
      <div class="outfit-request-topline">
        <RouterLink v-if="!personal" :to="{ name: 'community-member', params: { userId: request.consumerId } }" class="community-seller" :aria-label="`View ${request.consumerName}’s profile`">
          <span class="community-avatar community-avatar-small" aria-hidden="true">{{ (request.consumerName || 'Member').charAt(0).toUpperCase() }}</span>
          <span><span class="community-seller-name">{{ request.consumerName }}</span><span class="community-seller-style">Posted {{ postedOn(request.createdAt) }}</span></span>
        </RouterLink>
        <span v-if="personal" class="community-muted small">Posted {{ postedOn(request.createdAt) }}</span>
        <span class="community-tag" :class="request.status === 'open' ? 'request-status-open' : 'request-status-closed'">{{ request.expired ? 'Expired' : request.status === 'open' ? 'Open' : 'Closed' }}</span>
      </div>
      <span v-if="isMine && !personal" class="community-tag request-owner-badge mb-2">Your request</span>
      <h2><RouterLink :to="{ name: 'community-request', params: { requestId: request.requestId } }">{{ request.title }}</RouterLink></h2>
      <p class="request-occasion">{{ request.occasion }}</p><p class="request-description">{{ request.description }}</p>
      <div class="outfit-request-tags"><span class="community-tag pink"><CommunityIcon name="tag" :size="17" /> Budget {{ money(request.budget) }}</span><span class="community-tag lilac"><CommunityIcon name="hanger" :size="18" /> {{ request.preferredStyle }}</span><span class="community-tag yellow"><CommunityIcon name="calendar" :size="17" /> Needed by {{ readableDate(request.deadline) }}</span></div>
      <p v-if="request.status === 'closed'" class="community-muted small">{{ request.fulfilled ? 'Completed' : request.acceptedResponseId ? 'Suggestion accepted' : 'Closed' }}</p>
      <p v-else-if="request.deadline < today()" class="community-muted small">The needed-by date has passed.</p>
      <div class="outfit-request-footer"><RouterLink :to="{ name: 'community-request', params: { requestId: request.requestId } }" class="request-suggestion-count" :class="{ 'has-suggestions': request.suggestionCount > 0 }"><CommunityIcon name="message" :size="18" /> {{ request.suggestionCount || 0 }} {{ request.suggestionCount === 1 ? 'suggestion' : 'suggestions' }}</RouterLink><div class="request-card-links"><RouterLink v-if="personal && request.messageCount" :to="{ name: 'community-request', params: { requestId: request.requestId } }" class="community-text-button">{{ request.messageCount }} {{ request.messageCount === 1 ? 'message' : 'messages' }}</RouterLink><RouterLink :to="{ name: 'community-request', params: { requestId: request.requestId } }">View request <CommunityIcon name="arrow" :size="18" /></RouterLink><button v-if="personal" type="button" class="request-delete-btn" :disabled="deleting" :aria-label="`Delete ${request.title}`" @click="$emit('delete-request', request)">{{ deleting ? 'Deleting…' : 'Delete' }}</button></div></div>
    </div>
    <div v-if="canReport" class="request-report-action">
      <button
        type="button"
        class="request-report-button"
        title="Report request"
        :aria-label="`Report outfit request: ${request.title}`"
        @click="reportOpen = true"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" />
        </svg>
      </button>
    </div>

    <ReportDialog
      v-if="reportOpen"
      :listing-id="request.requestId"
      :listing-name="request.title"
      target-type="request"
      @close="reportOpen = false"
    />
  </article>
</template>

<style scoped>
.outfit-request-card {
  position: relative;
}

.request-report-action {
  position: absolute;
  left: 12px;
  top: 12px;
}

.request-report-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #fffdfaee;
  color: #6b3a55;
  box-shadow: 0 2px 8px #0001;
  cursor: pointer;
}

.request-report-button:hover {
  background: #f6e8ef;
}

.request-report-button:focus-visible {
  outline: 2px solid #683760;
  outline-offset: 3px;
}
</style>