<script>
import { businessApi, sendJson, readPhoto, styles } from '../../services/businessApi'
import { refreshBusiness } from '../../services/businessStore'
import CommunityFloral from '../../components/CommunityFloral.vue'
export default {
  components: { CommunityFloral },
  data() {
    return { styles, form: { businessName: '', description: '', contact: '', styles: [] }, original: null, logo: '', logoPreview: '', isNew: true,
      loading: true, saving: false, error: '', saved: '' }
  },
  async mounted() {
    try {
      const { business } = await businessApi('/profile')
      if (business) {
        this.isNew = false
        this.form = { businessName: business.businessName, description: business.description, contact: business.contact, styles: [...business.styles] }
        this.original = JSON.parse(JSON.stringify(this.form))
        this.logoPreview = business.logoURL || ''
      }
    } catch (error) { this.error = error.message }
    finally { this.loading = false }
  },
  methods: {
    async chooseLogo(event) {
      const file = event.target.files[0]
      this.error = ''
      if (!file) return
      try { this.logo = await readPhoto(file); this.logoPreview = this.logo }
      catch (error) { this.error = error.message; event.target.value = '' }
    },
    cancel() { if (this.original) this.form = JSON.parse(JSON.stringify(this.original)); this.saved = ''; this.error = '' },
    async save() {
      if (this.saving || !this.$refs.form.reportValidity()) return
      if (!this.form.styles.length) { this.error = 'Choose at least one fashion style.'; return }
      this.saving = true; this.error = ''; this.saved = ''
      try {
        const wasNew = this.isNew
        await businessApi('/profile', sendJson('PUT', { ...this.form, logo: this.logo || undefined }))
        this.isNew = false; this.logo = ''; this.original = JSON.parse(JSON.stringify(this.form))
        await refreshBusiness()
        if (wasNew) return this.$router.push({ name: 'business-dashboard' })
        this.saved = 'Your profile has been saved.'
      } catch (error) { this.error = error.message }
      finally { this.saving = false }
    },
  },
}
</script>
<template>
  <section aria-labelledby="biz-profile-heading">
    <div class="biz-page-head"><div><h1 id="biz-profile-heading">{{ isNew ? 'Set up your business' : 'Your business profile' }}</h1><p>{{ isNew ? 'Tell students who you are. New businesses get 100 free coins.' : 'Keep your store details and styles up to date.' }}</p></div></div>
    <p v-if="loading" role="status" class="biz-loading">Loading your profile…</p>
    <form v-else ref="form" @submit.prevent="save" :aria-busy="saving">
      <fieldset :disabled="saving" class="border-0 p-0 m-0">
        <div class="row g-4">
          <div class="col-xl-8">
            <section class="biz-card biz-section">
              <h2>Business details</h2>
              <div class="biz-form-grid">
                <div class="biz-logo-picker">
                  <span class="biz-avatar"><img v-if="logoPreview" :src="logoPreview" alt="Business logo" /><template v-else>{{ (form.businessName || 'B').charAt(0).toUpperCase() }}</template></span>
                  <label class="biz-file-link">{{ logoPreview ? 'Change logo' : 'Add a logo' }}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Business logo" @change="chooseLogo" /></label>
                  <small class="biz-muted">Optional · JPG, PNG or WebP</small>
                </div>
                <div>
                  <div class="biz-field"><label for="biz-name" class="form-label">Business name <span aria-hidden="true">*</span></label><input id="biz-name" v-model.trim="form.businessName" class="form-control" required maxlength="80" /></div>
                  <div class="biz-field"><label for="biz-contact" class="form-label">Contact <span aria-hidden="true">*</span></label><input id="biz-contact" v-model.trim="form.contact" class="form-control" required maxlength="120" placeholder="Email, phone or Instagram" /></div>
                  <div class="biz-field mb-0"><label for="biz-description" class="form-label">Description <span aria-hidden="true">*</span></label><textarea id="biz-description" v-model.trim="form.description" class="form-control" rows="3" required maxlength="1000" placeholder="What makes your store different?"></textarea></div>
                </div>
              </div>
            </section>
            <section class="biz-card biz-section">
              <h2>Fashion styles</h2>
              <fieldset><legend class="form-label">What styles do you sell? <span aria-hidden="true">*</span></legend>
                <p class="biz-muted small mt-n1">Customers who like these styles are matched to your store.</p>
                <div class="biz-chip-group"><label v-for="style in styles" :key="style" class="biz-chip"><input v-model="form.styles" type="checkbox" :value="style" /> <span>{{ style }}</span></label></div>
              </fieldset>
              <div v-if="error" class="biz-error mt-4" role="alert">{{ error }}</div>
              <div v-if="saved" class="biz-success mt-4" role="status">{{ saved }}</div>
              <div class="biz-form-actions mt-4">
                <button v-if="!isNew" type="button" class="biz-btn biz-btn-outline" @click="cancel">Cancel</button>
                <button class="biz-btn">{{ saving ? 'Saving…' : isNew ? 'Create business' : 'Save changes' }}</button>
              </div>
            </section>
          </div>
          <div class="col-xl-4">
            <aside class="biz-side-panel">
              <h2>Reach the right students</h2>
              <p>Your styles decide which shoppers see your products first and which outfit requests are suggested to you.</p>
              <CommunityFloral style="width:120px;display:block;margin:10px auto 0" aria-hidden="true" />
            </aside>
          </div>
        </div>
      </fieldset>
    </form>
  </section>
</template>
