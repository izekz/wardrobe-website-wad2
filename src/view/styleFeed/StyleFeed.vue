<script>
import { styleFeedApi } from '../../services/styleFeedApi'
import { authState } from '../../services/authService'
import '../../assets/styles/styleFeed.css'

export default {
  data() {
    return {
      videos: [], activeIndex: 0, loading: true, error: '', interactionError: '',
      likedBusy: '', muted: true, viewed: new Set(), impressed: new Set(), playbackProgress: {},
      // Native trackpad/wheel scrolling is never locked. Remember when the
      // final card was reached so only a NEW downward gesture loops it.
      scrollSettleTimer: null, lastWheelAt: 0, bottomReachedAt: 0,
      touchStartY: null, touchStartX: null, touchStartedAtEnd: false,
    }
  },
  computed: {
    isBusiness() { return authState.user?.role === 'business' },
    activePost() { return this.videos[this.activeIndex] || null },
    activeId() { return this.activePost?.videoId || null },
  },
  mounted() {
    window.addEventListener('keydown', this.onKeydown)
    this.load()
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKeydown)
    if (this.scrollSettleTimer !== null) clearTimeout(this.scrollSettleTimer)
    this.$refs.feedViewer?.querySelectorAll('video').forEach(video => video.pause())
  },
  methods: {
    formatMoney(value) { return `S$${Number(value || 0).toFixed(2)}` },
    async load() {
      this.loading = true; this.error = ''; this.interactionError = ''
      try {
        // sessionStorage survives refresh but is cleared when the tab is closed.
        // Requesting a different opener avoids an identical first video where possible.
        const lastKey = 'dripped:style-feed:first-video'
        let previousFirst = ''
        try { previousFirst = sessionStorage.getItem(lastKey) || '' } catch { /* storage disabled */ }
        const data = await styleFeedApi(previousFirst ? `?avoidFirst=${encodeURIComponent(previousFirst)}` : '')
        this.videos = data.videos
        this.activeIndex = 0
        this.viewed = new Set()
        this.impressed = new Set()
        this.playbackProgress = {}
        this.lastWheelAt = 0
        this.bottomReachedAt = 0
        try {
          if (this.activeId) sessionStorage.setItem(lastKey, this.activeId)
        } catch { /* storage disabled */ }
        this.loading = false
        await this.$nextTick()
        if (this.$refs.feedViewer) this.$refs.feedViewer.scrollTop = 0
        this.playActive()
      } catch (error) { this.error = error.message }
      finally { this.loading = false }
    },
    videoAt(index) {
      return this.$refs.feedViewer?.querySelector(`video[data-feed-index="${index}"]`) || null
    },
    playActive() {
      const post = this.activePost
      const viewer = this.$refs.feedViewer
      if (!post || !viewer) return
      viewer.querySelectorAll('video').forEach(video => {
        const isActive = Number(video.dataset.feedIndex) === this.activeIndex
        if (!isActive) video.pause()
      })
      const video = this.videoAt(this.activeIndex)
      if (video) {
        video.muted = this.muted
        video.play().catch(() => {}) // Browsers may require a gesture for autoplay.
      }
      if (post.boosted && !this.impressed.has(post.videoId)) {
        this.impressed.add(post.videoId)
        void this.track(post.videoId, 'impression')
      }
    },
    navigate(direction) {
      if (this.loading || !this.videos.length) return
      if (direction < 0 && this.activeIndex === 0) return
      const next = direction > 0 && this.activeIndex === this.videos.length - 1
        ? 0 : Math.max(0, Math.min(this.videos.length - 1, this.activeIndex + direction))
      if (next === this.activeIndex) return
      const wraps = direction > 0 && next === 0
      this.activeIndex = next
      // Keyboard navigation animates between posts. Wrapping to the start is
      // instantaneous so it doesn't sweep past the entire feed backwards.
      this.$nextTick(() => {
        const viewer = this.$refs.feedViewer
        if (viewer) {
          if (wraps) viewer.scrollTop = 0
          else viewer.scrollTo({ top: next * viewer.clientHeight, behavior: 'smooth' })
        }
        this.playActive()
      })
    },
    onKeydown(event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
          !['ArrowDown', 'ArrowUp'].includes(event.key) ||
          event.target?.closest?.('input, textarea, select, [contenteditable], [role="dialog"]')) return
      if (!this.videos.length) return
      event.preventDefault()
      if (event.repeat) return
      this.navigate(event.key === 'ArrowDown' ? 1 : -1)
    },
    syncActiveWithScroll() {
      const viewer = this.$refs.feedViewer
      if (!viewer || !viewer.clientHeight || !this.videos.length) return
      const next = Math.max(0, Math.min(this.videos.length - 1,
        Math.round(viewer.scrollTop / viewer.clientHeight)))
      if (next !== this.activeIndex) {
        this.activeIndex = next
        this.$nextTick(() => this.playActive())
      }
    },
    onScroll() {
      // Scrolling is native (including Mac trackpads). Let CSS scroll snap
      // animate between cards; only update playback when it settles.
      if (this.isAtBottom()) {
        if (!this.bottomReachedAt) this.bottomReachedAt = Date.now()
      } else {
        this.bottomReachedAt = 0
      }
      if (this.scrollSettleTimer !== null) clearTimeout(this.scrollSettleTimer)
      this.scrollSettleTimer = setTimeout(() => {
        this.scrollSettleTimer = null
        this.syncActiveWithScroll()
      }, 80)
    },
    isAtBottom() {
      const viewer = this.$refs.feedViewer
      return !!viewer && viewer.scrollHeight - viewer.clientHeight - viewer.scrollTop <= 3
    },
    onWheel(event) {
      // Do NOT prevent normal scrolling: touchpads emit long bursts of small
      // wheel events and the old debounce kept the whole feed locked.
      if (this.loading || this.videos.length < 2) return
      const now = Date.now()
      // Only a fresh gesture after coming to rest on the LAST video can
      // wrap to the start. Momentum from arriving at the bottom must not loop.
      const newGesture = now - this.lastWheelAt >= 220
      const atLast = this.activeIndex === this.videos.length - 1 && this.isAtBottom()
      const ready = this.bottomReachedAt && now - this.bottomReachedAt >= 350
      this.lastWheelAt = now
      if (event.deltaY > 0 && atLast && ready && newGesture) {
        if (event.cancelable !== false) event.preventDefault()
        this.bottomReachedAt = 0
        this.navigate(1)
      }
      // Otherwise, never consume the event. The browser scrolls and snaps.
    },
    onTouchStart(event) {
      if (event.touches?.length !== 1) return
      this.touchStartY = event.touches[0].clientY
      this.touchStartX = event.touches[0].clientX
      this.touchStartedAtEnd = this.isAtBottom()
    },
    onTouchEnd(event) {
      if (this.touchStartY === null || !event.changedTouches?.length) return
      const deltaY = this.touchStartY - event.changedTouches[0].clientY
      const deltaX = this.touchStartX - event.changedTouches[0].clientX
      // Native touch scrolling handles all regular swipes. Only an upward
      // swipe that STARTS at the bottom can loop the feed to its first post.
      if (this.touchStartedAtEnd && this.isAtBottom() && this.videos.length > 1 &&
          deltaY >= 55 && deltaY > Math.abs(deltaX) * 1.25) {
        this.activeIndex = this.videos.length - 1
        this.navigate(1)
      }
      this.resetTouch()
    },
    resetTouch() {
      this.touchStartY = null
      this.touchStartX = null
      this.touchStartedAtEnd = false
    },
    onProgress(post, event) {
      const video = event.target
      if (post.videoId !== this.activeId) return
      // Keep the timeline synced to the actual video duration (not a timer).
      if (Number.isFinite(video.duration) && video.duration > 0) {
        this.playbackProgress[post.videoId] = Math.max(0, Math.min(100,
          video.currentTime / video.duration * 100))
      }
      if (video.currentTime < 2 || this.viewed.has(post.videoId)) return
      this.viewed.add(post.videoId)
      void this.track(post.videoId, 'view')
    },
    seekVideo(index, event) {
      const video = this.videoAt(index)
      const post = this.videos[index]
      if (!video || !post || !Number.isFinite(video.duration) || video.duration <= 0) return
      const percent = Math.max(0, Math.min(100, Number(event.target.value) || 0))
      video.currentTime = video.duration * percent / 100
      this.playbackProgress[post.videoId] = percent
    },
    togglePlayback(event) {
      const video = event.target
      if (video.paused) video.play().catch(() => {})
      else video.pause()
    },
    async track(id, type) {
      try { await styleFeedApi(`/${id}/event`, { method: 'POST', body: JSON.stringify({ type }) }) }
      catch (error) { this.interactionError = `Some viewing statistics could not be saved: ${error.message}` }
    },
    openProduct(post) {
      void this.track(post.videoId, 'product')
      this.$router.push({ name: 'discover-product', params: { productId: post.productId } })
    },
    openStore(post) {
      void this.track(post.videoId, 'store')
      this.$router.push({ name: 'discover', query: { businessId: post.businessId, businessName: post.businessName, view: 'all' } })
    },
    async toggleLike(post) {
      if (this.likedBusy) return
      this.likedBusy = post.videoId; this.interactionError = ''
      try {
        const data = await styleFeedApi(`/${post.videoId}/like`, { method: 'POST', body: '{}' })
        post.liked = data.liked; post.likes = data.likes
      } catch (error) { this.interactionError = error.message }
      finally { this.likedBusy = '' }
    },
    toggleMute() {
      this.muted = !this.muted
      const video = this.videoAt(this.activeIndex)
      if (video) video.muted = this.muted
    },
  },
}
</script>

<template>
  <section class="sf-page" aria-label="Style Feed">
    <header class="sf-page-heading">
      <div>
        <span class="sf-eyebrow">Discover your next look</span>
        <h1 id="sf-page-title" tabindex="-1">Style Feed <span aria-hidden="true">✿</span></h1>
      </div>
      <div v-if="isBusiness" class="sf-heading-actions">
        <RouterLink :to="{ name: 'business-style-videos' }" class="sf-primary-btn">Manage my videos</RouterLink>
      </div>
    </header>

    <p v-if="error" class="sf-error" role="alert">{{ error }} <button @click="load">Retry</button></p>
    <p v-else-if="loading" class="sf-status">Loading your feed…</p>
    <div v-else-if="!videos.length" class="sf-empty">
      <h2>No videos yet</h2>
      <p>Businesses can upload outfit videos linked to products in their stores. Check back when the first look is posted.</p>
      <RouterLink v-if="isBusiness" :to="{ name: 'business-style-videos' }" class="sf-primary-btn">Upload the first video</RouterLink>
    </div>
    <template v-else>
      <div ref="feedViewer" class="sf-viewer" role="region" tabindex="0"
        aria-label="Outfit video feed"
        @scroll.passive="onScroll" @wheel="onWheel"
        @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd" @touchcancel="resetTouch">
        <article v-for="(post, index) in videos" :key="post.videoId" class="sf-post"
          :data-video-id="post.videoId">
          <div class="sf-video-stage">
            <video :data-feed-index="index"
              :src="Math.abs(index - activeIndex) <= 1 ? post.videoURL : undefined"
              :poster="post.productImageURL"
              playsinline :muted="muted" loop :autoplay="index === 0"
              :preload="Math.abs(index - activeIndex) <= 1 ? 'metadata' : 'none'"
              @loadedmetadata="index === activeIndex && playActive(); onProgress(post, $event)"
              @timeupdate="onProgress(post, $event)" @click="togglePlayback"
              :aria-label="`Outfit video by ${post.businessName}`" />
            <span v-if="post.boosted" class="sf-sponsored">Sponsored</span>
            <button class="sf-sound" type="button" :aria-label="muted ? 'Unmute video' : 'Mute video'" @click="toggleMute">{{ muted ? '🔇' : '🔊' }}</button>
            <div class="sf-video-caption"><strong>{{ post.businessName }}</strong><p>{{ post.caption }}</p></div>
            <div class="sf-video-actions">
              <button type="button" :disabled="likedBusy === post.videoId" :aria-label="post.liked ? 'Unlike' : 'Like'" :aria-pressed="post.liked" @click="toggleLike(post)"><span>{{ post.liked ? '♥' : '♡' }}</span><small>{{ post.likes }}</small></button>
            </div>
            <input class="sf-video-progress" type="range" min="0" max="100" step="0.1"
              :value="playbackProgress[post.videoId] || 0"
              :style="{ '--played': `${playbackProgress[post.videoId] || 0}%` }"
              :aria-label="`Seek ${post.businessName} outfit video`"
              :aria-valuetext="`${Math.round(playbackProgress[post.videoId] || 0)}% played`"
              @input="seekVideo(index, $event)" />
          </div>
          <aside class="sf-product-card" :aria-label="`Featured product: ${post.productName}`">
            <div class="sf-product-label">Featured in this video</div>
            <div class="sf-product-overview">
              <img v-if="post.productImageURL" :src="post.productImageURL" :alt="post.productName" loading="lazy" />
              <div class="sf-product-copy">
                <strong :title="post.productName">{{ post.productName }}</strong>
                <span class="sf-product-business">{{ post.businessName }}</span>
                <span class="sf-product-price">{{ formatMoney(post.productPrice) }}</span>
              </div>
            </div>
            <div class="sf-product-links">
              <button class="sf-product-view" type="button" @click="openProduct(post)">View product <span aria-hidden="true">→</span></button>
              <button class="sf-product-store" type="button" @click="openStore(post)">Visit store</button>
            </div>
          </aside>
        </article>
      </div>
      <p v-if="interactionError" class="sf-error" role="alert">{{ interactionError }}</p>
    </template>
  </section>
</template>
