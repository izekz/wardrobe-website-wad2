<script setup>
import { computed, watch, ref, onBeforeUnmount } from 'vue'
import { catalogApi } from '../../services/catalogApi'
import { shopState, hydrateShop } from '../../services/shopService'
import ProductCard from '../../components/ProductCard.vue'
const products = ref([]), loading = ref(false), error = ref('')
const liked = computed(() => products.value.filter(p => shopState.liked.includes(p.productId)))
let generation = 0
onBeforeUnmount(() => { generation++ })
watch(() => [shopState.ownerId, shopState.ready, ...shopState.liked], async () => {
  const version = ++generation
  products.value = []
  error.value = ''
  loading.value = false
  if (!shopState.ready) return
  loading.value = true
  try {
    const result = await Promise.all(shopState.liked.map(async id => {
      try { return (await catalogApi(`/products/${encodeURIComponent(id)}`)).product }
      catch (e) { if (e.status === 404) return null; throw e }
    }))
    if (version === generation) products.value = result.filter(Boolean)
  } catch (e) { if (version === generation) error.value = e.message }
  finally { if (version === generation) loading.value = false }
}, { immediate: true })
function retry() { void hydrateShop(true).catch(() => {}) }
</script>
<template>
  <section class="disc-library-page">
    <div class="disc-library-head"><div><p class="community-eyebrow">YOUR SHORTLIST</p><h1>Your Favorites</h1><p>Your favorite finds, all in one place. Revisit them anytime to compare and style your next look.</p></div><RouterLink :to="{name:'discover'}" class="community-btn community-btn-outline">Keep browsing</RouterLink></div>
    <p v-if="loading||shopState.loading" class="community-loading">Loading your likes…</p>
    <div v-else-if="error||shopState.error" class="community-error" role="alert">{{ error||shopState.error }} <button type="button" class="community-text-button" @click="retry">Try again</button></div>
    <div v-else-if="!liked.length" class="community-empty"><h2>No likes yet</h2><p>Tap the heart on any Discover item to save it here.</p><RouterLink :to="{name:'discover'}" class="community-btn">Discover pieces</RouterLink></div>
    <div v-else class="disc-grid"><ProductCard v-for="product in liked" :key="product.productId" :product="product" /></div>
  </section>
</template>