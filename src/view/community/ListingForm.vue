<script>
export default {
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
    }
  },

  methods: {
    selectPhoto(event) {
      const file = event.target.files[0]
      this.error = ''
      this.preview = null
      if (this.photoUrl) URL.revokeObjectURL(this.photoUrl)
      this.photoUrl = ''
      if (!file) return

      const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!supportedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
        this.error = 'Choose a JPG, PNG or WebP image smaller than 5 MB.'
        event.target.value = ''
        return
      }

      // This shows a local image; it does not upload or save the photo.
      this.photoUrl = URL.createObjectURL(file)
    },

    previewListing() {
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
      // Step 1: copy the entered values into a preview card.
      // Step 2 will send the listing and photo to the backend for saving.
      this.preview = { ...this.form, amount, imageURL: this.photoUrl }
    },
  },

  beforeUnmount() {
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl)
  },
}
</script>

<template>
  <section aria-labelledby="listing-heading">
    <div class="heading mb-4">
      <span class="flower" aria-hidden="true">✿</span>
      <p class="eyebrow mb-2">COMMUNITY / CREATE LISTING</p>
      <h1 id="listing-heading">Create a listing</h1>
      <p class="mb-0">Sell or rent a piece from your wardrobe.</p>
    </div>

    <form @submit.prevent="previewListing" @input="preview = null" @change="preview = null">
      <div class="row g-4">
        <div class="col-lg-5">
          <section class="panel h-100" aria-labelledby="photo-heading">
            <h2 id="photo-heading" class="h5 mb-3">Photo</h2>
            <div class="photo-area mb-3">
              <img v-if="photoUrl" :src="photoUrl" alt="Selected clothing photo" />
              <div v-else class="text-center p-4">
                <span class="photo-symbol" aria-hidden="true">＋</span>
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
                class="form-control" min="0" step="0.01" required placeholder="25.00" />
            </div>
            <div v-else class="mb-3">
              <label for="rental-price" class="form-label">Rental price (S$ per day)</label>
              <input id="rental-price" v-model.number="form.rentalPrice" type="number"
                class="form-control" min="0" step="0.01" required placeholder="8.00" />
            </div>

            <div class="mb-4">
              <label for="description" class="form-label">Description</label>
              <textarea id="description" v-model.trim="form.description" class="form-control"
                rows="3" required maxlength="1000"
                placeholder="Describe the item, its fit and any signs of wear."></textarea>
            </div>

            <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>
            <div class="text-sm-end">
              <button type="submit" class="btn btn-plum px-4">Preview listing</button>
            </div>
          </section>
        </div>
      </div>
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
.heading { position: relative; padding: 26px; background: #f8e9ed; border-radius: 16px; }
.heading h1 { font: 500 clamp(2rem, 5vw, 3rem) Georgia, serif; }
.eyebrow { font-size: .7rem; letter-spacing: .1em; color: #705180; }
.flower { float: right; font-size: 3rem; line-height: 1; color: #ac86b2; }
.panel { padding: 24px; background: white; border: 1px solid #e5dfe5; border-radius: 14px; }
.photo-area { aspect-ratio: 1; display: grid; place-items: center; background: #f3e9ec; border-radius: 10px; overflow: hidden; }
.photo-area img { width: 100%; height: 100%; object-fit: contain; }
.photo-symbol { font-size: 3rem; color: #705180; }
.photo-tip { padding: 14px; background: #fff4ce; border-radius: 8px; font-size: .9rem; }
.form-label { font-weight: 500; }
.form-control, .form-select { border-color: #d6ccd8; min-width: 0; }
.form-control:focus, .form-select:focus { border-color: #705180; box-shadow: 0 0 0 .2rem #70518022; }
.form-check-input:checked { background-color: #705180; border-color: #705180; }
.btn-plum { background: #705180; color: white; }
.btn-plum:hover, .btn-plum:focus-visible { background: #583d67; color: white; }
.listing-badge { display: inline-block; padding: 4px 10px; background: #eee5f5; border-radius: 999px; font-size: .8rem; }
.preview-photo { width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; background: #fcfaf5; }
.description { white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 575px) { .panel, .heading { padding: 18px; } }
</style>
