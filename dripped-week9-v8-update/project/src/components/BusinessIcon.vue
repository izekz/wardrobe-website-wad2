<script>
// Person 4: line icons used in the business portal (same style as CommunityIcon).
export default { props: { name: { type: String, required: true }, size: { type: [Number, String], default: 22 } } }
</script>
<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="community-icon">
    <path v-if="name === 'home'" d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />
    <template v-else-if="name === 'tag'"><path d="M3 3h8l10 10-8 8L3 11Z" /><circle cx="7.5" cy="7.5" r="1" /></template>
    <path v-else-if="name === 'chat'" d="M4 5h16v11H9l-5 4Z" />
    <template v-else-if="name === 'megaphone'"><path d="M3 10v4h3l8 5V5L6 10Z" /><path d="M6 14v5h3M18 9a4 4 0 0 1 0 6" /></template>
    <template v-else-if="name === 'coins'"><ellipse cx="12" cy="6" rx="6" ry="2.5" /><path d="M6 6v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6M6 10v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4M6 14v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" /></template>
    <template v-else-if="name === 'eye'"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></template>
    <path v-else-if="name === 'skip'" d="m4 5 7 7-7 7Zm8 0 7 7-7 7Z" />
    <template v-else-if="name === 'search'"><circle cx="10.7" cy="10.7" r="7.1" /><path d="m16 16 5 5" /></template>
    <path v-else-if="name === 'chevron-right'" d="m9 6 6 6-6 6" />
    <path v-else-if="name === 'chevron-left'" d="m15 6-6 6 6 6" />
    <path v-else-if="name === 'chevron-down'" d="m7 10 5 5 5-5" />
    <path v-else-if="name === 'arrow'" d="M4 12h16m-6-6 6 6-6 6" />
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <path v-else-if="name === 'trend'" d="m3 17 6-6 4 4 8-8m-5 0h5v5" />
    <template v-else-if="name === 'dots'"><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></template>
    <template v-else-if="name === 'calendar'"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 11h16" /></template>
    <template v-else-if="name === 'hanger'"><path d="M10 6a2 2 0 1 1 2 2v3L3 17v2h18v-2l-9-6" /></template>
    <path v-else-if="name === 'check'" d="m5 12 4 4L19 6" />
    <path v-else-if="name === 'sparkle'" d="M12 3c1 5 3 7 8 8-5 1-7 3-8 8-1-5-3-7-8-8 5-1 7-3 8-8Z" />
    <template v-else-if="name === 'bag'"><path d="M5 8h14l-1 13H6Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></template>
    <template v-else-if="name === 'user'"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></template>
    <template v-else-if="name === 'rocket'"><path d="M12 15c-2-2-3-4-3-6 0-4 3-6 3-6s3 2 3 6c0 2-1 4-3 6Z" /><path d="M9 12 6 15l2 1m7-4 3 3-2 1m-6 3 1 3 1-3" /></template>
    <template v-else-if="name === 'crown'"><path d="m3 8 4 4 5-7 5 7 4-4-2 11H5Z" /></template>
  </svg>
</template>
