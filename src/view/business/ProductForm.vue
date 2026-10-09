<script>
import { businessApi, sendJson, readPhoto, categories, styles, occasions } from '../../services/businessApi'
import { refreshBusiness } from '../../services/businessStore'
import BusinessIcon from '../../components/BusinessIcon.vue'
const blank = () => ({ name: '', price: '', style: '', category: '', occasions: [], sizes: '', stock: '', description: '', status: 'active' })
export default {
  components: { BusinessIcon },
  data() { return { categories, styles, occasions, form: blank(), photo: '', photoPreview: '', loading: false, saving: false, error: '' } },
  computed: {
    productId() { return this.$route.params.productId },
    editing() { return Boolean(this.productId) },
  },
  watch: { productId: { immediate: true, handler() { this.load() } } },
  methods: {
    async load() {
      this.form = blank(); this.photo = ''; this.photoPreview = ''; this.error = ''
      if (!this.editing) return
      this.loading = true
      try {
        const { product } = await businessApi(`/products/${encodeURIComponent(this.productId)}`)
        this.form = { name: product.name, price: product.price, style: product.style, category: product.category, occasions: [...product.occasions],
          sizes: product.sizes.join(', '), stock: product.stock, description: product.description, status: product.status }
        this.photoPreview = product.imageURL
      } catch (error) { this.error = error.message }
      finally { this.loading = false }
    },
    async choosePhoto(event) {
      const file = event.target.files[0]
      this.error = ''
      if (!file) return
      try { this.photo = await readPhoto(file); this.photoPreview = this.photo }
      catch (error) { this.error = error.message; event.target.value = '' }
    },
    async save() {
      if (this.saving || !this.$refs.form.reportValidity()) return
      if (!this.form.occasions.length) { this.error = 'Choose at least one occasion.'; return }
      if (!this.editing && !this.photo) { this.error = 'Please choose a product photo.'; return }
      this.saving = true; this.error = ''
      const body = { ...this.form, price: Number(this.form.price), stock: Number(this.form.stock),
        sizes: this.form.sizes.split(',').map(size => size.trim()).filter(Boolean), photo: this.photo || undefined }
      try {
        if (this.editing) await businessApi(`/products/${encodeURIComponent(this.productId)}`, sendJson('PUT', body))
        else { await businessApi('/products', sendJson('POST', body)); await refreshBusiness() }
        await this.$router.push({ name: 'business-products' })
      } catch (error) { this.error = error.message }
      finally { this.saving = false }
    },
  },
}
</script>
<template>
  <section aria-labelledby="biz-product-heading">
    <RouterLink :to="{ name: 'business-products' }" class="biz-link mb-3"><BusinessIcon name="chevron-left" :size="16" /> Back to products</RouterLink>
    <div class="biz-page-head mt-2"><div><h1 id="biz-product-heading">{{ editing ? 'Edit product' : 'Add a product' }}</h1><p>{{ editing ? 'Changes show in the store straight away.' : 'It will appear in the customer store as soon as you publish.' }}</p></div></div>
    <p v-if="loading" role="status" class="biz-loading">Loading product…</p>
    <form v-else ref="form" class="biz-card" @submit.prevent="save" :aria-busy="saving">
      <fieldset :disabled="saving" class="border-0 p-0 m-0">
        <div class="row g-4">
          <div class="col-lg-4">
            <label for="product-photo" class="form-label">Photo <span v-if="!editing" aria-hidden="true">*</span></label>
            <div class="biz-photo-box"><img v-if="photoPreview" :src="photoPreview" alt="Product photo preview" /><span v-else>No photo yet</span></div>
            <input id="product-photo" type="file" accept="image/jpeg,image/png,image/webp" class="form-control mt-2" @change="choosePhoto" />
            <p v-if="editing" class="biz-muted small mt-1">Leave empty to keep the current photo.</p>
          </div>
          <div class="col-lg-8">
            <div class="biz-field"><label for="product-name" class="form-label">Product name <span aria-hidden="true">*</span></label><input id="product-name" v-model.trim="form.name" class="form-control" required maxlength="80" /></div>
            <div class="row g-3">
              <div class="col-sm-6 biz-field"><label for="product-price" class="form-label">Price (S$) <span aria-hidden="true">*</span></label><input id="product-price" v-model="form.price" type="number" class="form-control" min="0" max="100000" step="0.01" required /></div>
              <div class="col-sm-6 biz-field"><label for="product-stock" class="form-label">Stock <span aria-hidden="true">*</span></label><input id="product-stock" v-model="form.stock" type="number" class="form-control" min="0" max="100000" step="1" required /></div>
              <div class="col-sm-6 biz-field"><label for="product-style" class="form-label">Style <span aria-hidden="true">*</span></label><select id="product-style" v-model="form.style" class="form-select" required><option disabled value="">Select a style</option><option v-for="style in styles" :key="style">{{ style }}</option></select></div>
              <div class="col-sm-6 biz-field"><label for="product-category" class="form-label">Category <span aria-hidden="true">*</span></label><select id="product-category" v-model="form.category" class="form-select" required><option disabled value="">Select a category</option><option v-for="category in categories" :key="category">{{ category }}</option></select></div>
            </div>
            <fieldset class="biz-field"><legend class="form-label">Occasions <span aria-hidden="true">*</span></legend>
              <div class="biz-chip-group"><label v-for="occasion in occasions" :key="occasion" class="biz-chip"><input v-model="form.occasions" type="checkbox" :value="occasion" /> <span>{{ occasion }}</span></label></div></fieldset>
            <div class="biz-field"><label for="product-sizes" class="form-label">Sizes, separated by commas <span aria-hidden="true">*</span></label><input id="product-sizes" v-model="form.sizes" class="form-control" required maxlength="200" placeholder="e.g. S, M, L" /></div>
            <div class="biz-field"><label for="product-description" class="form-label">Description <span aria-hidden="true">*</span></label><textarea id="product-description" v-model.trim="form.description" class="form-control" rows="3" required maxlength="1000"></textarea></div>
            <div v-if="editing" class="biz-field"><label for="product-status" class="form-label">Visibility</label><select id="product-status" v-model="form.status" class="form-select"><option value="active">Showing in store</option><option value="hidden">Hidden from store</option></select></div>
            <div v-if="error" class="biz-error" role="alert">{{ error }}</div>
            <div class="biz-form-actions">
              <RouterLink :to="{ name: 'business-products' }" class="biz-btn biz-btn-outline">Cancel</RouterLink>
              <button class="biz-btn">{{ saving ? 'Saving…' : editing ? 'Save changes' : 'Publish to store' }}</button>
            </div>
          </div>
        </div>
      </fieldset>
    </form>
  </section>
</template>
