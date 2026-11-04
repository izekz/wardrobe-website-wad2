<script>
import { businessApi, sendJson, readPhoto, categories, styles, occasions } from '../../services/businessApi'
import { colours } from '../../services/wardrobeService'
import { refreshBusiness } from '../../services/businessStore'
import BusinessIcon from '../../components/BusinessIcon.vue'
// Person 4: each size has its own stock. `sizeRows` is the list the business edits.
const blank = () => ({ name: '', price: '', style: '', category: '', colours: [], material: '', occasions: [], sizeRows: [{ size: '', stock: '' }], description: '', status: 'active' })
const QUICK_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One size']
export default {
  components: { BusinessIcon },
  data() { return { categories, colours, styles, occasions, form: blank(), quickSizes: QUICK_SIZES, legacyStock: null, photo: '', photoPreview: '', sizePhoto: '', sizePhotoPreview: '', loading: false, saving: false, error: '' } },
  computed: {
    productId() { return this.$route.params.productId },
    editing() { return Boolean(this.productId) },
    totalStock() { return this.form.sizeRows.reduce((sum, row) => sum + (Number(row.stock) || 0), 0) },
  },
  watch: { productId: { immediate: true, handler() { this.load() } } },
  methods: {
    async load() {
      this.form = blank(); this.legacyStock = null; this.photo = ''; this.photoPreview = ''; this.sizePhoto = ''; this.sizePhotoPreview = ''; this.error = ''
      if (!this.editing) return
      this.loading = true
      try {
        const { product } = await businessApi(`/products/${encodeURIComponent(this.productId)}`)
        this.form = { name: product.name, price: product.price, style: product.style, category: product.category, colours: [...(product.colours?.length ? product.colours : product.availableColours?.length ? product.availableColours : product.colour ? [product.colour] : [])], material: product.material || '', occasions: [...product.occasions],
          sizeRows: product.sizeStock
            ? Object.entries(product.sizeStock).map(([size, stock]) => ({ size, stock }))
            // Older listing: one stock shared by all sizes. Ask for each size's stock.
            : product.sizes.map(size => ({ size, stock: '' })),
          description: product.description, status: product.status }
        if (!product.sizeStock) this.legacyStock = product.stock
        if (!this.form.sizeRows.length) this.form.sizeRows = [{ size: '', stock: '' }]
        this.photoPreview = product.imageURL; this.sizePhotoPreview = product.sizeImageURL || ''
      } catch (error) { this.error = error.message }
      finally { this.loading = false }
    },
    hasSize(size) { return this.form.sizeRows.some(row => row.size.trim().toLowerCase() === size.toLowerCase()) },
    addSize(size = '') {
      if (size && this.hasSize(size)) return
      // Fill the first empty row before adding a new one.
      const empty = size && this.form.sizeRows.find(row => !row.size.trim())
      if (empty) empty.size = size
      else if (this.form.sizeRows.length < 12) this.form.sizeRows.push({ size, stock: '' })
    },
    removeSize(index) {
      this.form.sizeRows.splice(index, 1)
      if (!this.form.sizeRows.length) this.form.sizeRows.push({ size: '', stock: '' })
    },
    async chooseSizePhoto(event) { const file=event.target.files[0]; this.error=''; if(!file)return; try{this.sizePhoto=await readPhoto(file);this.sizePhotoPreview=this.sizePhoto}catch(error){this.error=error.message;event.target.value=''} },
    async choosePhoto(event) {
      const file = event.target.files[0]
      this.error = ''
      if (!file) return
      try { this.photo = await readPhoto(file); this.photoPreview = this.photo }
      catch (error) { this.error = error.message; event.target.value = '' }
    },
    async save() {
      if (this.saving || !this.$refs.form.reportValidity()) return
      if (!this.form.colours.length) { this.error = 'Choose at least one available colour.'; return }
      if (!this.form.occasions.length) { this.error = 'Choose at least one occasion.'; return }
      if (!this.editing && !this.photo) { this.error = 'Please choose a product photo.'; return }
      const names = this.form.sizeRows.map(row => row.size.trim().toLowerCase())
      if (new Set(names).size !== names.length) { this.error = 'Each size can only be listed once.'; return }
      this.saving = true; this.error = ''
      const { sizeRows, ...fields } = this.form
      const body = { ...fields, price: Number(this.form.price),
        sizeStock: sizeRows.map(row => ({ size: row.size.trim(), stock: Number(row.stock) })),
        photo: this.photo || undefined, sizePhoto: this.sizePhoto || undefined }
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
            <label for="product-size-photo" class="form-label mt-4">Size guide image <span class="biz-muted">(recommended)</span></label>
            <div class="biz-photo-box"><img v-if="sizePhotoPreview" :src="sizePhotoPreview" alt="Size guide preview" /><span v-else>Add a simple measurement chart so customers can choose confidently.</span></div>
            <input id="product-size-photo" type="file" accept="image/jpeg,image/png,image/webp" class="form-control mt-2" @change="chooseSizePhoto" />
            <p class="biz-muted small mt-1">Shown as the second image on the customer product page. Leave empty when editing to keep the current guide.</p>
          </div>
          <div class="col-lg-8">
            <div class="biz-field"><label for="product-name" class="form-label">Product name <span aria-hidden="true">*</span></label><input id="product-name" v-model.trim="form.name" class="form-control" required maxlength="80" /></div>
            <div class="row g-3">
              <div class="col-sm-6 biz-field"><label for="product-price" class="form-label">Price (S$) <span aria-hidden="true">*</span></label><input id="product-price" v-model="form.price" type="number" class="form-control" min="0" max="100000" step="0.01" required /></div>
              <div class="col-sm-6 biz-field"><label for="product-style" class="form-label">Style <span aria-hidden="true">*</span></label><select id="product-style" v-model="form.style" class="form-select" required><option disabled value="">Select a style</option><option v-for="style in styles" :key="style">{{ style }}</option></select></div>
              <div class="col-sm-6 biz-field"><label for="product-category" class="form-label">Category <span aria-hidden="true">*</span></label><select id="product-category" v-model="form.category" class="form-select" required><option disabled value="">Select a category</option><option v-for="category in categories" :key="category">{{ category }}</option></select></div>
              <fieldset class="col-12 biz-field">
                <legend class="form-label">Available colours <span aria-hidden="true">*</span></legend>
                <p class="biz-muted small">Choose at least one. Customers choose one of these colours at checkout.</p>
                <div class="biz-chip-group">
                  <label v-for="(colour, index) in colours" :key="colour" class="biz-chip">
                    <input v-model="form.colours" type="checkbox" :value="colour" :required="index === 0 && !form.colours.length" />
                    <span>{{ colour }}</span>
                  </label>
                </div>
              </fieldset>
              <div class="col-sm-6 biz-field">
                <label for="product-material" class="form-label">Material <span aria-hidden="true">*</span></label>
                <input id="product-material" v-model.trim="form.material" class="form-control" required maxlength="50" placeholder="e.g. Cotton, linen, denim" />
              </div>
            </div>
            <fieldset class="biz-field"><legend class="form-label">Occasions <span aria-hidden="true">*</span></legend>
              <div class="biz-chip-group"><label v-for="occasion in occasions" :key="occasion" class="biz-chip"><input v-model="form.occasions" type="checkbox" :value="occasion" /> <span>{{ occasion }}</span></label></div></fieldset>
            <fieldset class="biz-field">
              <legend class="form-label">Sizes and stock <span aria-hidden="true">*</span></legend>
              <p class="biz-muted small">Enter how many you have of each size. When a customer buys a size, only that size's stock goes down.</p>
              <p v-if="legacyStock !== null" class="biz-error small" role="status">This listing was made before stock per size. It had {{ legacyStock }} in stock shared across all sizes. Enter the stock for each size, then save.</p>
              <div class="size-quick" aria-label="Quick add a size">
                <button v-for="size in quickSizes" :key="size" type="button" class="biz-btn biz-btn-outline biz-btn-small" :disabled="hasSize(size) || form.sizeRows.length >= 12 && !form.sizeRows.some(r => !r.size.trim())" @click="addSize(size)">+ {{ size }}</button>
              </div>
              <div class="size-stock-head" aria-hidden="true"><span>Size</span><span>Stock</span><span></span></div>
              <div v-for="(row, index) in form.sizeRows" :key="index" class="size-stock-row">
                <input v-model="row.size" class="form-control" required maxlength="20" placeholder="e.g. M" :aria-label="`Size ${index + 1} name`" />
                <input v-model="row.stock" type="number" class="form-control" min="0" max="100000" step="1" required placeholder="0" :aria-label="`Stock for size ${row.size || index + 1}`" />
                <button type="button" class="biz-btn biz-btn-outline biz-btn-small" :aria-label="`Remove size ${row.size || index + 1}`" @click="removeSize(index)">Remove</button>
              </div>
              <div class="size-stock-foot">
                <button type="button" class="biz-btn biz-btn-outline biz-btn-small" :disabled="form.sizeRows.length >= 12" @click="addSize()">+ Add another size</button>
                <span>Total stock: <strong>{{ totalStock }}</strong></span>
              </div>
            </fieldset>
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

<style scoped>
.size-quick { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.size-stock-head, .size-stock-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 10px; align-items: center; }
.size-stock-head { font-size: 13px; font-weight: 600; color: #6f6372; margin-bottom: 6px; }
.size-stock-row { margin-bottom: 10px; }
.size-stock-foot { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-top: 4px; font-size: 15px; }
</style>
