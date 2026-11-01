<script setup>
import { computed, onMounted, ref } from 'vue'
import { catalogApi } from '../../services/catalogApi'
import { shopState } from '../../services/shopService'
import ProductCard from '../../components/ProductCard.vue'
const products = ref([]); const loading = ref(true); const error = ref('')
const liked = computed(() => products.value.filter(p => shopState.liked.includes(p.productId)))
onMounted(async () => { try { products.value = (await Promise.all(shopState.liked.map(async id => { try { return (await catalogApi(`/products/${encodeURIComponent(id)}`)).product } catch { return null } }))).filter(Boolean) } catch(e){ error.value=e.message } finally { loading.value=false } })
</script>
<template>
  <section class="disc-library-page">
    <div class="disc-library-head"><div><p class="community-eyebrow">YOUR SHORTLIST</p><h1>Your Favorites</h1><p>Your favorite finds, all in one place. Revisit them anytime to compare and style your next look.</p></div><RouterLink :to="{name:'discover'}" class="community-btn community-btn-outline">Keep browsing</RouterLink></div>
    <p v-if="loading" class="community-loading">Loading your likes…</p>
    <div v-else-if="error" class="community-error">{{ error }}</div>
    <div v-else-if="!liked.length" class="community-empty"><h2>No likes yet</h2><p>Tap the heart on any Discover item to save it here.</p><RouterLink :to="{name:'discover'}" class="community-btn">Discover pieces</RouterLink></div>
    <div v-else class="disc-grid"><ProductCard v-for="product in liked" :key="product.productId" :product="product" /></div>
  </section>
</template>