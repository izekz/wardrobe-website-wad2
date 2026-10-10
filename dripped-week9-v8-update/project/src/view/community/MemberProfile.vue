<script setup>
import CommunityTabs from '../../components/CommunityTabs.vue'
import CommunityHistory from '../../components/CommunityHistory.vue'
</script>
<template>
  <section><CommunityTabs /><CommunityHistory :user-id="$route.params.userId" /></section>
</template>
