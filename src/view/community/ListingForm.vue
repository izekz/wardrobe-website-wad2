<script>
import { communityApi } from '../../services/communityApi'
import CommunityTabs from '../../components/CommunityTabs.vue'
import CommunityIcon from '../../components/CommunityIcon.vue'
export default {
  components: { CommunityTabs, CommunityIcon },
  data() {
    return {
      // v-model connects the fields below to these values.
      form: {
        name: '', category: '', style: '', size: '', condition: '',
        listingType: 'sell', price: '', rentalPrice: '', description: '',
      },
      categories: ['Tops', 'Bottoms', 'Jackets', 'Dresses', 'Shoes', 'Accessories'],
      styles: ['Minimalist', 'Streetwear', 'Vintage', 'Y2K', 'Formal', 'Casual', 'Preppy'],
      conditions: ['New', 'Like new', 'Good', 'Fair'],
      photoUrl: '',
      error: '',
      preview: null,
      photoData: '',
      photoLoading: false,
      photoVersion: 0,
      posting: false,
      saved: null,
      clientRequestId: crypto.randomUUID(),
    }
  },

  methods: {
    async selectPhoto(event) {
      const file = event.target.files[0]
      const version = ++this.photoVersion
      this.error = ''
      this.preview = null
      this.photoData = ''
      this.photoLoading = false
      if (this.photoUrl) URL.revokeObjectURL(this.photoUrl)
      this.photoUrl = ''
      if (!file) return

      const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!supportedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
        this.error = 'Choose a JPG, PNG or WebP image smaller than 5 MB.'
        event.target.value = ''
        return
      }

      // The object URL is only for the preview; FileReader prepares the upload.
      this.photoUrl = URL.createObjectURL(file)
      this.photoLoading = true
      try {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('The photo could not be read. Please choose it again.'))
          reader.readAsDataURL(file)
        })
        if (version === this.photoVersion) this.photoData = data
      } catch (error) { if (version === this.photoVersion) this.error = error.message }
      finally { if (version === this.photoVersion) this.photoLoading = false }
    },

    previewListing() {
      if (!this.$refs.listingForm.reportValidity()) return
      const enteredPrice = this.form.listingType === 'rent'
        ? this.form.rentalPrice : this.form.price
      const amount = Number(enteredPrice)

      if (!this.photoUrl || !this.form.name.trim() || !this.form.size.trim()
        || !this.form.description.trim() || enteredPrice === ''
        || !Number.isFinite(amount) || amount < 0) {
        this.error = 'Please add a photo, complete the details and enter a valid price.'
        return
      }

      this.error = ''
      // Previewing still does not save anything. Post listing sends the data.
      this.preview = { ...this.form, amount, imageURL: this.photoUrl }
    },
    markChanged(event) {
      this.preview = null
      if (event?.target?.type !== 'file') this.error = ''
      this.clientRequestId = crypto.randomUUID()
    },
    async postListing() {
      if (this.posting || this.photoLoading) return
      this.previewListing()
      if (!this.preview) return
      if (!this.photoData) { this.error = 'Choose a readable photo before posting.'; return }
      this.posting = true
      this.error = ''
      try {
        const result = await communityApi('/listings', {
          method: 'POST',
          body: JSON.stringify({ ...this.form, photo: this.photoData, clientRequestId: this.clientRequestId }),
        })
        this.saved = result.listing
        this.preview = null
        this.$nextTick(() => this.$refs.savedHeading?.focus())
      } catch (error) { this.error = error.message }
      finally { this.posting = false }
    },
    startAnother() {
      if (this.photoUrl) URL.revokeObjectURL(this.photoUrl)
      this.form = { name: '', category: '', style: '', size: '', condition: '', listingType: 'sell', price: '', rentalPrice: '', description: '' }
      this.photoUrl = ''; this.photoData = ''; this.preview = null; this.saved = null
      this.error = ''; this.clientRequestId = crypto.randomUUID()
    },
  },

  beforeUnmount() {
    this.photoVersion++
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl)
  },
}
</script>

<template>
  <section class="listing-form-page" aria-labelledby="listing-heading">
    <CommunityTabs />
    <div class="heading mb-4">
      <p class="eyebrow mb-2">A SECOND CHAPTER STARTS HERE</p>
      <h1 id="listing-heading">Create a listing</h1>
      <p class="mb-0">Sell or rent a piece from your wardrobe.</p>
    </div>

    <section v-if="saved" class="panel" aria-live="polite">
      <h2 ref="savedHeading" tabindex="-1">Your listing is posted</h2>
      <p>{{ saved.name }} has been saved. It is ready to view in the marketplace.</p>
      <div class="d-flex flex-wrap gap-2">
        <RouterLink :to="{ name: 'community-listing', params: { listingId: saved.listingId } }" class="community-btn">View listing</RouterLink>
        <RouterLink :to="{ name: 'community-marketplace' }" class="community-btn community-btn-outline">Go to marketplace</RouterLink>
        <button type="button" class="btn btn-link" @click="startAnother">Post another item</button>
      </div>
    </section>
    <form v-else ref="listingForm" @submit.prevent="postListing" @input="markChanged" @change="markChanged" :aria-busy="posting">
      <fieldset :disabled="posting" class="border-0 p-0 m-0">
      <div class="row g-4">
        <div class="col-lg-5">
          <section class="panel h-100" aria-labelledby="photo-heading">
            <h2 id="photo-heading" class="h5 mb-3">Photo</h2>
            <div class="photo-area mb-3">
              <img v-if="photoUrl" :src="photoUrl" alt="Selected clothing photo" />
              <div v-else class="text-center p-4">
                <CommunityIcon name="upload" :size="38" class="photo-symbol" />
                <p class="mb-0">Your clothing photo will appear here</p>
              </div>
            </div>
            <label for="photo" class="form-label">Choose a clothing photo</label>
            <input id="photo" class="form-control" type="file" required
              accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help"
              @change="selectPhoto" />
            <p id="photo-help" class="form-text">JPG, PNG or WebP. Maximum 5 MB.</p>
            <p class="photo-tip mb-0">Clear photos help your listing stand out.</p>
          </section>
        </div>

        <div class="col-lg-7">
          <section class="panel" aria-labelledby="details-heading">
            <h2 id="details-heading" class="h5 mb-4">Item details</h2>
            <div class="mb-3">
              <label for="name" class="form-label">Product name</label>
              <input id="name" v-model.trim="form.name" class="form-control" required
                maxlength="80" placeholder="e.g. Beige linen jacket" />
            </div>

            <div class="row g-3 mb-3">
              <div class="col-sm-6">
                <label for="category" class="form-label">Category</label>
                <select id="category" v-model="form.category" class="form-select" required>
                  <option disabled value="">Choose a category</option>
                  <option v-for="category in categories" :key="category">{{ category }}</option>
                </select>
              </div>
              <div class="col-sm-6">
                <label for="style" class="form-label">Style</label>
                <select id="style" v-model="form.style" class="form-select" required>
                  <option disabled value="">Choose a style</option>
                  <option v-for="style in styles" :key="style">{{ style }}</option>
                </select>
              </div>
              <div class="col-sm-6">
                <label for="size" class="form-label">Size</label>
                <input id="size" v-model.trim="form.size" class="form-control" required
                  maxlength="20" placeholder="e.g. M, UK 8 or One size" />
              </div>
              <div class="col-sm-6">
                <label for="condition" class="form-label">Condition</label>
                <select id="condition" v-model="form.condition" class="form-select" required>
                  <option disabled value="">Choose a condition</option>
                  <option v-for="condition in conditions" :key="condition">{{ condition }}</option>
                </select>
              </div>
            </div>

            <fieldset class="mb-3">
              <legend class="form-label fs-6">Listing type</legend>
              <div class="d-flex gap-4">
                <label class="form-check">
                  <input v-model="form.listingType" class="form-check-input" type="radio"
                    name="listingType" value="sell" /> Sell
                </label>
                <label class="form-check">
                  <input v-model="form.listingType" class="form-check-input" type="radio"
                    name="listingType" value="rent" /> Rent
                </label>
              </div>
            </fieldset>

            <div v-if="form.listingType === 'sell'" class="mb-3">
              <label for="sale-price" class="form-label">Price (S$)</label>
              <input id="sale-price" v-model.number="form.price" type="number"
                class="form-control" min="0" max="100000" step="0.01" required placeholder="25.00" />
            </div>
            <div v-else class="mb-3">
              <label for="rental-price" class="form-label">Rental price (S$ per day)</label>
              <input id="rental-price" v-model.number="form.rentalPrice" type="number"
                class="form-control" min="0" max="100000" step="0.01" required placeholder="8.00" />
            </div>

            <div class="mb-4">
              <label for="description" class="form-label">Description</label>
              <textarea id="description" v-model.trim="form.description" class="form-control"
                rows="3" required maxlength="1000"
                placeholder="Describe the item, its fit and any signs of wear."></textarea>
            </div>

            <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
            <div class="d-flex flex-wrap justify-content-sm-end gap-2">
              <button type="button" class="community-btn community-btn-outline" :disabled="photoLoading" @click="previewListing">Preview listing</button>
              <button type="submit" class="community-btn" :disabled="posting || photoLoading">{{ posting ? 'Posting…' : photoLoading ? 'Reading photo…' : 'Post listing' }} <CommunityIcon name="arrow" :size="19" /></button>
            </div>
          </section>
        </div>
      </div>
      </fieldset>
    </form>

    <section v-if="preview" class="panel mt-4" aria-labelledby="preview-heading" aria-live="polite">
      <h2 id="preview-heading" class="h5">Listing preview</h2>
      <p class="text-secondary">This is a preview. Your listing has not been posted or saved.</p>
      <div class="row g-3 align-items-center">
        <div class="col-sm-3">
          <img class="preview-photo" :src="preview.imageURL" :alt="preview.name" />
        </div>
        <div class="col-sm-9">
          <span class="listing-badge">{{ preview.listingType === 'rent' ? 'For rent' : 'For sale' }}</span>
          <h3 class="h4 mt-2">{{ preview.name }}</h3>
          <p class="fw-semibold">S${{ preview.amount.toFixed(2) }}{{ preview.listingType === 'rent' ? ' / day' : '' }}</p>
          <p>{{ preview.category }} · {{ preview.style }} · {{ preview.size }} · {{ preview.condition }}</p>
          <p class="mb-0 description">{{ preview.description }}</p>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.heading { padding: 24px 0 8px; text-align: center; }
.heading h1 { font-size: clamp(2.4rem, 4.5vw, 3.9rem); }
.heading > p:last-child { font-size: 1.1rem; color: #736674; }
.eyebrow { font-size: .68rem; letter-spacing: .14em; color: #986d81; }
.panel { padding: 28px; background: #fffdfa; border: 1px solid #e8dfe1; border-radius: 16px; }
.panel h2 { font-family: Georgia, serif; font-size: 1.6rem; }
.photo-area { aspect-ratio: 1; display: grid; place-items: center; background: #faeee7; border: 1px dashed #dbc8c5; border-radius: 12px; overflow: hidden; }
.photo-area img { width: 100%; height: 100%; object-fit: contain; }
.photo-symbol { margin-bottom: 20px; color: #825c73; }
.photo-tip { padding: 15px; background: #fff3d2; border-radius: 8px; font-size: .85rem; color: #7b6758; }
.form-control, .form-select { min-width: 0; }
.form-check-input:checked { background-color: #694463; border-color: #694463; }
.listing-badge { display: inline-block; padding: 5px 12px; background: #f9e0eb; color: #522747; border-radius: 999px; font-size: .8rem; }
.preview-photo { width: 100%; max-height: 200px; object-fit: contain; border-radius: 10px; background: #f8f0e9; }
.description { white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 575px) { .panel { padding: 20px; } .heading { padding-top: 18px; } }
</style>
