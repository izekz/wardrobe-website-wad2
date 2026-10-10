<script>
import CommunityIcon from './CommunityIcon.vue'
export default {
  components: { CommunityIcon },
  props: { type: { type: String, required: true } },
}
</script>
<template>
  <span class="listing-type-badge" :class="type === 'rent' ? 'listing-type-rent' : 'listing-type-sale'">
    <CommunityIcon :name="type === 'rent' ? 'calendar' : 'tag'" :size="15" />
    {{ type === 'rent' ? 'RENT' : 'SALE' }}
  </span>
</template>
