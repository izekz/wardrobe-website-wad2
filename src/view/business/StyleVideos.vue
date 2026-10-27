<script>
import { businessApi, money, shortDate } from '../../services/businessApi'
import { styleFeedApi, readVideo } from '../../services/styleFeedApi'
import { refreshBusiness } from '../../services/businessStore'
import '../../assets/styles/styleFeed.css'

export default {
  data() { return { products: [], videos: [], coins: 0, boostCoins: 20, days: 7,
    productId: '', caption: '', file: null, videoPreview: '', loading: true, uploading: false,
    busy: '', error: '', success: '', profileMissing: false } },
  mounted() { this.load() },
  beforeUnmount() { if (this.videoPreview) URL.revokeObjectURL(this.videoPreview) },
  computed: { availableProducts() { return this.products.filter(p => p.status === 'active' && p.stock > 0) } },
  methods: {
    money, shortDate,
    async load() {
      this.loading = true; this.error = ''
      try {
        const [mine, stock] = await Promise.all([styleFeedApi('/mine'), businessApi('/products')])
        this.videos = mine.videos; this.coins = mine.coins; this.boostCoins = mine.boostCoins; this.days = mine.boostDays
        this.products = stock.products
      } catch (error) { this.error = error.message; this.profileMissing = error.message.toLowerCase().includes('profile') }
      finally { this.loading = false }
    },
    chooseFile(event) {
      const file = event.target.files?.[0]
      if (this.videoPreview) URL.revokeObjectURL(this.videoPreview)
      this.file = file || null
      this.videoPreview = file ? URL.createObjectURL(file) : ''
      this.error = ''
    },
    async upload() {
      if (!this.productId || !this.caption.trim() || !this.file) { this.error = 'Choose a product, caption and video.'; return }
      this.uploading = true; this.error = ''; this.success = ''
      try {
        const video = await readVideo(this.file)
        await styleFeedApi('', { method: 'POST', body: JSON.stringify({ productId: this.productId, caption: this.caption.trim(), video }) })
        this.caption = ''; this.productId = ''; this.file = null
        if (this.videoPreview) URL.revokeObjectURL(this.videoPreview)
        this.videoPreview = ''
        this.$refs.uploadInput.value = ''
        this.success = 'Video published! It is now part of the Style Feed.'
        await this.load()
      } catch (error) { this.error = error.message }
      finally { this.uploading = false }
    },
    async boost(post) {
      if (!window.confirm(`Boost this video for ${this.days} days with ${this.boostCoins} coins? Sponsored placements appear after every 3 regular videos. The feed order is shuffled for every visit.`)) return
      this.busy = post.videoId; this.error = ''; this.success = ''
      try {
        await styleFeedApi(`/${post.videoId}/boost`, { method: 'POST', body: '{}' })
        await Promise.all([this.load(), refreshBusiness()])
        this.success = 'Your boost is active. Open Style Feed to see the Sponsored placement.'
      } catch (error) { this.error = error.message }
      finally { this.busy = '' }
    },
    async remove(post) {
      if (!window.confirm('Delete this video permanently?')) return
      this.busy = post.videoId; this.error = ''; this.success = ''
      try { await styleFeedApi(`/${post.videoId}`, { method: 'DELETE' }); this.success = 'Video deleted.'; await this.load() }
      catch (error) { this.error = error.message }
      finally { this.busy = '' }
    },
  },
}
</script>
<template>
  <section class="sf-manager">
    <div class="biz-page-head"><div><span class="sf-eyebrow">Business creator tools</span><h1>Style Feed studio</h1><p>Show your outfits in motion. Every video links to one of your existing products.</p></div><RouterLink :to="{ name: 'style-feed' }" class="biz-btn">Watch Style Feed →</RouterLink></div>
    <p v-if="loading" role="status">Loading your creator studio…</p>
    <p v-if="error" role="alert" class="biz-error">{{ error }}</p>
    <p v-if="success" role="status" class="biz-success">{{ success }}</p>
    <RouterLink v-if="profileMissing" :to="{ name: 'business-profile' }">Create your business profile</RouterLink>
    <template v-if="!loading && !profileMissing">
      <div class="sf-studio-grid">
        <form class="biz-card sf-upload" @submit.prevent="upload">
          <h2>Upload an outfit video</h2>
          <label for="sf-product">Link a product from your store</label>
          <select id="sf-product" v-model="productId" required><option value="" disabled>Choose a product</option><option v-for="product in availableProducts" :key="product.productId" :value="product.productId">{{ product.name }} · {{ money(product.price) }}</option></select>
          <p v-if="!availableProducts.length" class="biz-muted">Add a visible product first. <RouterLink :to="{ name: 'business-product-new' }">Create a product</RouterLink></p>
          <label for="sf-caption">Caption</label><textarea id="sf-caption" v-model="caption" maxlength="200" required rows="3" placeholder="A fresh fit for your next campus day ✨" /><span class="sf-form-hint">{{ caption.length }}/200 characters</span>
          <label for="sf-file">Short video</label><input id="sf-file" ref="uploadInput" type="file" accept="video/mp4,video/webm" required @change="chooseFile" />
          <small class="biz-muted">MP4 or WebM, maximum 8 MB. Recording a short phone video and compressing it first works best.</small>
          <video v-if="videoPreview" class="sf-upload-preview" :src="videoPreview" controls playsinline muted />
          <button type="submit" class="biz-btn biz-btn-pink" :disabled="uploading || !availableProducts.length">{{ uploading ? 'Publishing…' : 'Publish to Style Feed' }}</button>
        </form>
        <aside class="biz-card sf-promo-explainer"><span class="sf-eyebrow">Coin-powered promotion</span><h2>Give your best looks a boost</h2><strong class="sf-coins">{{ coins }} coins</strong><p>Your first upload is free. Boost any video for <strong>{{ boostCoins }} coins / {{ days }} days</strong>.</p><p>Videos are shuffled every time the feed loads. Boosted posts appear in a sponsored slot after every three regular videos, labelled “Sponsored”.</p><RouterLink :to="{ name: 'business-promotions' }" class="biz-btn">Top up demo coins →</RouterLink></aside>
      </div>
      <div class="sf-management-head"><h2>My videos <small>({{ videos.length }})</small></h2><span>Performance updates from customer interactions.</span></div>
      <div v-if="!videos.length" class="biz-card sf-empty"><h3>Nothing posted yet</h3><p>Your first video will appear here after you publish it.</p></div>
      <div v-else class="sf-my-videos">
        <article v-for="post in videos" :key="post.videoId" class="biz-card sf-video-item">
          <video :src="post.videoURL" :poster="post.productImageURL" preload="metadata" controls muted playsinline />
          <div class="sf-video-information"><strong>{{ post.productName }}</strong><p>{{ post.caption }}</p><span v-if="post.boosted" class="sf-live-boost">Sponsored until {{ shortDate(post.boostedUntil) }}</span><span v-else class="sf-organic-label">Organic post · free</span>
            <div class="sf-stats-grid"><div><strong>{{ post.sponsoredImpressions }}</strong><small>Sponsored impressions</small></div><div><strong>{{ post.uniqueReach }}</strong><small>Unique sponsored reach</small></div><div><strong>{{ post.views }}</strong><small>Views</small></div><div><strong>{{ post.likes }}</strong><small>Likes</small></div><div><strong>{{ post.productClicks }}</strong><small>Product clicks</small></div><div><strong>{{ post.storeClicks }}</strong><small>Store clicks</small></div></div>
            <p v-if="!post.productAvailable" class="biz-muted small">This product is hidden or out of stock. Make it available before boosting the video.</p>
            <div class="sf-item-actions"><button type="button" class="biz-btn biz-btn-pink" :disabled="busy !== '' || coins < boostCoins || !post.productAvailable" @click="boost(post)">{{ post.boosted ? 'Extend boost' : 'Boost video' }} · {{ boostCoins }} coins</button><button type="button" class="biz-btn" :disabled="busy !== ''" @click="remove(post)">Delete video</button></div>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
