<script>
import ListingTypeBadge from './ListingTypeBadge.vue'
import { listingPrice } from '../services/communityApi'
export default {
  components: { ListingTypeBadge },
  props: { item: { type: Object, required: true }, showOwner: { type: Boolean, default: true } },
  methods: { listingPrice },
}
</script>
<template>
  <article class="community-card">
    <RouterLink :to="{ name: 'community-listing', params: { listingId: item.listingId } }" class="community-card-visual d-block">
      <img :src="item.imageURL" :alt="item.name" class="community-card-image" loading="lazy" />
      <ListingTypeBadge :type="item.listingType" class="community-listing-label" />
    </RouterLink>
    <div class="community-card-body">
      <h2><RouterLink :to="{ name: 'community-listing', params: { listingId: item.listingId } }">{{ item.name }}</RouterLink></h2>
      <p class="community-price">{{ listingPrice(item) }}</p>
      <p class="community-card-meta">Size {{ item.size }} <span aria-hidden="true">·</span> {{ item.condition }} condition</p>
      <p v-if="item.status !== 'available'" class="community-tag request-status-closed">Unavailable</p>
      <RouterLink v-if="showOwner" :to="{ name: 'community-member', params: { userId: item.ownerId } }" class="community-seller" :aria-label="`View ${item.ownerName}’s profile`">
        <span class="community-avatar community-avatar-small" aria-hidden="true">{{ (item.ownerName || 'Member').charAt(0).toUpperCase() }}</span>
        <span><span class="community-seller-name">{{ item.ownerName }}</span><span class="community-seller-style">{{ item.style }}</span></span>
      </RouterLink>
      <slot />
    </div>
  </article>
</template>
