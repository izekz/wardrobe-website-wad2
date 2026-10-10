<script>
// Person 4: labelled percentage bars ("Why shoppers skipped" on the Overview page).
const COLOURS = ['#f6c9d5', '#ddd0f6', '#ffd3c1', '#fde7a6', '#cfe6cc', '#d8e3f3', '#eadbd2']
export default {
  props: { rows: { type: Array, default: () => [] }, empty: { type: String, default: 'No data yet.' } },
  methods: { colour(index) { return COLOURS[index % COLOURS.length] } },
}
</script>
<template>
  <p v-if="!rows.length" class="biz-muted mb-0">{{ empty }}</p>
  <ul v-else class="biz-bars">
    <li v-for="(row, index) in rows" :key="row.label">
      <span>{{ row.label }}</span>
      <div class="biz-bar-track" role="img" :aria-label="`${row.label}: ${row.percent}%, ${row.count} skips`"><div class="biz-bar-fill" :style="{ width: row.percent + '%', background: colour(index) }"></div></div>
      <strong>{{ Math.round(row.percent) }}%</strong>
    </li>
  </ul>
</template>
