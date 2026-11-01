<script setup>
import { shopState, cartSubtotal, updateCartQuantity, removeFromCart } from '../../services/shopService'
import { money } from '../../services/catalogApi'
</script>
<template>
<section class="disc-library-page">
  <div class="disc-library-head"><div><p class="community-eyebrow">READY WHEN YOU ARE</p><h1>Your cart</h1><p>Review colours, sizes and quantities before checkout.</p></div><RouterLink :to="{name:'discover'}" class="community-btn community-btn-outline">Continue shopping</RouterLink></div>
  <div v-if="!shopState.cart.length" class="community-empty"><h2>Your cart is empty</h2><p>Add a piece from Discover when you’re ready to buy.</p><RouterLink :to="{name:'discover'}" class="community-btn">Browse Discover</RouterLink></div>
  <div v-else class="disc-cart-layout">
    <div class="disc-cart-list">
      <article v-for="item in shopState.cart" :key="item.key" class="disc-cart-item">
        <img :src="item.imageURL" :alt="item.name" />
        <div class="disc-cart-copy"><p class="disc-store">{{ item.businessName }}</p><h2>{{ item.name }}</h2><p class="disc-cart-meta"><span v-if="item.colour">{{ item.colour }}</span><span v-if="item.size">Size {{ item.size }}</span></p><strong>{{ money(item.price) }}</strong></div>
        <div class="disc-cart-qty"><label :for="`qty-${item.key}`">Qty</label><select :id="`qty-${item.key}`" :value="item.quantity" @change="updateCartQuantity(item.key, $event.target.value)"><option v-for="n in Math.min(item.stock || 1, 10)" :key="n" :value="n">{{ n }}</option></select><button class="disc-remove-btn" @click="removeFromCart(item.key)">Remove</button></div>
      </article>
    </div>
    <aside class="disc-order-summary"><h2>Order summary</h2><div><span>Subtotal</span><strong>{{ money(cartSubtotal) }}</strong></div><div><span>Delivery</span><strong>Free Delivery</strong></div><hr /><div class="total"><span>Total</span><strong>{{ money(cartSubtotal) }}</strong></div><RouterLink :to="{name:'checkout'}" class="community-btn">Proceed to checkout</RouterLink></aside>
  </div>
</section>
</template>
