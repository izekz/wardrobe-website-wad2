<script>
import ListingForm from './view/community/ListingForm.vue'

export default {
  components: { ListingForm },
}
</script>

<template>
  <header class="site-header">
    <div class="container d-flex justify-content-between align-items-center gap-3">
      <span class="brand">Wardrobe <span aria-hidden="true">✿</span></span>
      <span class="section-label">Community Marketplace</span>
    </div>
  </header>

  <main class="container py-4 py-md-5">
    <ListingForm />
  </main>
</template>

<style>
body { margin: 0; background: #fcfaf5; color: #322936; }
.site-header { padding: 18px 0; border-bottom: 1px solid #e7e0e5; background: white; }
.brand { font: 600 clamp(1.4rem, 4vw, 2rem) Georgia, serif; color: #3b2547; }
.brand span { color: #af83ad; }
.section-label { font-size: .85rem; text-align: right; color: #705180; }
</style>
