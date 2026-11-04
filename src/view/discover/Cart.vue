<script setup>
import { computed } from 'vue'
import { shopState, cartSubtotal, updateCartQuantity, removeFromCart, hydrateShop } from '../../services/shopService'
import { money } from '../../services/catalogApi'
const unavailable = computed(() => shopState.cart.some(item => !item.available))
function retry() { void hydrateShop(true).catch(() => {}) }
async function changeQuantity(item, event) {
  try { await updateCartQuantity(item.key, event.target.value) }
  catch { event.target.value = shopState.cart.find(line => line.key === item.key)?.quantity || item.quantity }
}
function remove(key) { void removeFromCart(key).catch(() => {}) }
</script>
<template>
<section class="disc-library-page">
  <div class="disc-library-head"><div><p class="community-eyebrow">READY WHEN YOU ARE</p><h1>Your cart</h1><p>Review colours, sizes and quantities before checkout.</p></div><RouterLink :to="{name:'discover'}" class="community-btn community-btn-outline">Continue shopping</RouterLink></div>
  <p v-if="shopState.error" role="alert" class="community-error">{{ shopState.error }} <button type="button" class="community-text-button" @click="retry">Try again</button></p>
  <p v-if="shopState.loading" role="status" class="community-loading">Loading your cart…</p>
  <div v-else-if="!shopState.cart.length" class="community-empty"><h2>Your cart is empty</h2><p>Add a piece from Discover when you’re ready to buy.</p><RouterLink :to="{name:'discover'}" class="community-btn">Browse Discover</RouterLink></div>
  <div v-else class="disc-cart-layout">
    <div class="disc-cart-list">
      <article v-for="item in shopState.cart" :key="item.key" class="disc-cart-item">
        <img :src="item.imageURL" :alt="item.name" />
        <div class="disc-cart-copy"><p class="disc-store">{{ item.businessName }}</p><h2><RouterLink class="disc-cart-product-link" :to="{ name: 'discover-product', params: { productId: item.productId }, query: { fromCart: '1', colour: item.colour || '', size: item.size || '', quantity: String(item.quantity) } }">{{ item.name }}</RouterLink></h2><p class="disc-cart-meta"><span v-if="item.colour">{{ item.colour }}</span><span v-if="item.size">Size {{ item.size }}</span></p><strong>{{ money(item.price) }}</strong><p v-if="!item.available" class="text-danger small">Unavailable in this size, colour or quantity. Remove it or review the product.</p></div>
        <div class="disc-cart-qty"><label :for="`qty-${item.key}`">Qty</label><select :id="`qty-${item.key}`" :value="item.quantity" :disabled="shopState.pending>0||!item.available" @change="changeQuantity(item, $event)"><option v-for="n in Math.min(item.stock || 1, 10)" :key="n" :value="n">{{ n }}</option></select><button class="disc-remove-btn" :disabled="shopState.pending>0" @click="remove(item.key)">Remove</button></div>
      </article>
    </div>
    <aside class="disc-order-summary"><h2>Order summary</h2><div><span>Subtotal</span><strong>{{ money(cartSubtotal) }}</strong></div><div><span>Delivery</span><strong>Free Delivery</strong></div><hr /><div class="total"><span>Total</span><strong>{{ money(cartSubtotal) }}</strong></div><p v-if="unavailable" role="status" class="text-danger small">Remove unavailable items before checkout.</p><RouterLink v-if="!unavailable" :to="{name:'checkout'}" class="community-btn">Proceed to checkout</RouterLink></aside>
  </div>
</section>
</template>

<style scoped>
.disc-cart-item { position: relative; }
/* The product link covers the card; controls remain above it and work independently. */
.disc-cart-product-link::after { content: ''; position: absolute; inset: 0; z-index: 1; border-radius: 16px; }
.disc-cart-product-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.disc-cart-product-link:focus-visible { outline: none; }
.disc-cart-product-link:focus-visible::after { outline: 2px solid #976782; outline-offset: 3px; }
.disc-cart-qty { position: relative; z-index: 2; }
</style>
