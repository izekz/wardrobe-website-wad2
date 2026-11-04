<script>
import { communityApi } from '../services/communityApi'
import { authState } from '../services/authService'
export default {
  props: { requestId: { type: String, required: true } },
  data() { return { threads: [], activeId: '', text: '', sending: false, loading: true, error: '', notice: '' } },
  computed: {
    isCustomer() { return ['consumer', 'customer'].includes(authState.user?.role) },
    thread() { return this.threads.find(thread => thread.businessId === this.activeId) || this.threads[0] || null },
    canSend() {
      if (!this.isCustomer && authState.user?.role !== 'business') return false
      if (this.sending || !this.text.trim()) return false
      return !this.thread?.messages.length || this.thread.messages[this.thread.messages.length - 1].senderRole !== (this.isCustomer ? 'customer' : 'business')
    },
    awaitingReply() { return !!this.thread?.messages.length && this.thread.messages[this.thread.messages.length - 1].senderRole === (this.isCustomer ? 'customer' : 'business') },
  },
  async mounted() {
    await this.load()
    this.timer = setInterval(() => { if (!document.hidden && !this.sending) this.load(true) }, 20000)
  },
  beforeUnmount() { clearInterval(this.timer) },
  methods: {
    async load(quiet = false) {
      if (!quiet) this.loading = true
      try {
        const result = await communityApi(`/requests/${encodeURIComponent(this.requestId)}/contacts`)
        this.threads = result.threads
        this.error = ''
        if (!this.threads.some(t => t.businessId === this.activeId)) this.activeId = this.threads[0]?.businessId || ''
        if (quiet) this.error = ''
      } catch (error) { this.error = error.message }
      finally { this.loading = false }
    },
    async send() {
      if (!this.canSend) return
      this.sending = true; this.error = ''; this.notice = ''
      try {
        await communityApi(`/requests/${encodeURIComponent(this.requestId)}/contacts`, {
          method: 'POST', body: JSON.stringify({ text: this.text.trim(), ...(this.isCustomer ? { businessId: this.thread?.businessId } : {}) }),
        })
        this.text = ''
        this.notice = 'Message sent.'
        await this.load(true)
      } catch (error) { this.error = error.message }
      finally { this.sending = false }
    },
  },
}
</script>
<template>
  <section class="community-panel request-contacts" aria-label="Request messages">
    <h2 class="h4 mb-2">{{ isCustomer ? 'Messages from businesses' : 'Contact this customer' }}</h2>
    <p class="community-muted small mb-3">{{ isCustomer ? 'Business follow-ups appear here. You can reply without sharing your personal contact details.' : 'Send a private in-app message about this request, even if its deadline has passed. This does not reopen the request or create a new product suggestion.' }}</p>
    <p v-if="loading" class="community-muted">Loading messages…</p>
    <p v-if="error" class="community-error" role="alert">{{ error }}</p>
    <template v-if="!loading && (!isCustomer || threads.length)">
      <div v-if="isCustomer && threads.length > 1" class="mb-3">
        <label for="request-message-business" class="form-label">Conversation</label>
        <select id="request-message-business" v-model="activeId" class="form-select">
          <option v-for="threadItem in threads" :key="threadItem.businessId" :value="threadItem.businessId">{{ threadItem.businessName }}</option>
        </select>
      </div>
      <h3 v-if="thread" class="h6">{{ thread.businessName }}</h3>
      <div v-if="thread?.messages.length" class="request-contact-history" aria-live="polite">
        <div v-for="msg in thread.messages" :key="msg.id" class="request-contact-bubble" :class="{ 'from-me': msg.senderRole === (isCustomer ? 'customer' : 'business') }">
          <strong>{{ msg.senderRole === 'business' ? thread.businessName : 'Customer' }}</strong>
          <p class="mb-0">{{ msg.text }}</p>
        </div>
      </div>
      <p v-else class="community-muted small">{{ isCustomer ? 'No business messages yet.' : 'No conversation yet.' }}</p>
      <form @submit.prevent="send" class="mt-3">
        <label for="request-contact-text" class="form-label">{{ isCustomer ? 'Reply to business' : 'Your message' }}</label>
        <textarea id="request-contact-text" v-model="text" class="form-control" maxlength="600" rows="3" :disabled="awaitingReply || sending" :placeholder="isCustomer ? 'Write your reply…' : 'Ask whether they are still looking for something similar…'"></textarea>
        <p v-if="awaitingReply" class="community-muted small mt-2">You have sent a message. You can send another after the other person replies.</p>
        <button type="submit" class="community-btn mt-2" :disabled="!canSend">{{ sending ? 'Sending…' : 'Send message' }}</button>
        <p v-if="notice" role="status" class="text-success mt-2">{{ notice }}</p>
      </form>
    </template>
    <p v-else-if="!loading && !error" class="community-muted small">No business messages yet.</p>
  </section>
</template>
<style scoped>
.request-contact-history { display: grid; gap: 10px; max-height: 260px; overflow-y: auto; padding: 10px 0; }
.request-contact-bubble { background: #f3edf5; border-radius: 12px; padding: 12px 14px; max-width: 85%; overflow-wrap: anywhere; }
.request-contact-bubble.from-me { background: #fbe4eb; justify-self: end; }
.request-contact-bubble strong { display: block; font-size: 0.84rem; margin-bottom: 4px; }
</style>
