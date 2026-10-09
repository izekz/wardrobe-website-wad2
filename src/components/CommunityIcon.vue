<script>
export default {
  props: { name: { type: String, required: true }, size: { type: [Number, String], default: 20 } },
}
</script>
<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="community-icon">
    <template v-if="name === 'search'"><circle cx="10.7" cy="10.7" r="7.1" /><path d="m16 16 5 5" /></template>
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <path v-else-if="name === 'arrow'" d="M4 12h16m-6-6 6 6-6 6" />
    <path v-else-if="name === 'back'" d="M20 12H4m6-6-6 6 6 6" />
    <path v-else-if="name === 'chevron'" d="m7 10 5 5 5-5" />
    <template v-else-if="name === 'tag'"><path d="M3 3h8l10 10-8 8L3 11Z" /><circle cx="7.5" cy="7.5" r="1" /></template>
    <template v-else-if="name === 'hanger'"><path d="M10 6a2 2 0 1 1 2 2v3L3 17v2h18v-2l-9-6" /></template>
    <template v-else-if="name === 'calendar'"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 11h16" /></template>
    <path v-else-if="name === 'check'" d="m5 12 4 4L19 6" />
    <template v-else-if="name === 'upload'"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" /></template>
    <template v-else-if="name === 'message'"><path d="M21 11a9 8 0 0 1-9 8 10 10 0 0 1-4-.8L3 21l1.5-5A7.6 7.6 0 0 1 3 11a9 8 0 0 1 18 0Z" /></template>
    <template v-else-if="name === 'shirt'"><path d="m8 4-6 4 3 5 3-2v10h8V11l3 2 3-5-6-4a4 4 0 0 1-8 0Z" /></template>
  </svg>
</template>
