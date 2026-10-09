<script setup>
import { ref, watch, computed } from "vue";
import { categoryName } from "../services/wardrobeService";
const props = defineProps({
  item: Object,
  index: { type: Number, default: 0 },
});
const colourPalette = {
  White: ["#ffffff", "#403640", "#ddd5dc"],
  Black: ["#202020", "#ffffff", "#202020"],
  Beige: ["#e5d0ac", "#493922", "#cbb28e"],
  Cream: ["#fff3d7", "#594528", "#e7d6b1"],
  Grey: ["#595959", "#ffffff", "#595959"],
  Brown: ["#714c38", "#ffffff", "#714c38"],
  Navy: ["#253b61", "#ffffff", "#253b61"],
  Blue: ["#2967a8", "#ffffff", "#2967a8"],
  Pink: ["#f5c6d8", "#5a2843", "#df9fb8"],
  Purple: ["#76528c", "#ffffff", "#76528c"],
  Green: ["#2c704f", "#ffffff", "#2c704f"],
  Red: ["#ab3e50", "#ffffff", "#ab3e50"],
  Yellow: ["#ffe58b", "#59470a", "#dcc264"],
  Orange: ["#ffcf91", "#593609", "#dcaa6a"],
  Multicolour: [
    "linear-gradient(110deg,#f6c5d7,#ddd0f7,#bfe5d3,#ffe58b)",
    "#423149",
    "#d6b9d0",
  ],
};
const colourTagStyle = computed(() => {
  const [background, color, border] = colourPalette[props.item.colour] || [
    "#eee5f6",
    "#443547",
    "#dfd2e8",
  ];
  return { background, color, border: `1px solid ${border}` };
});
const failed = ref(false);
watch(
  () => props.item.imageURL,
  () => {
    failed.value = false;
  },
);
</script>
<template>
  <article class="wd-card">
    <div class="wd-photo" :class="`wd-tone-${index % 4}`">
      <img
        v-if="item.imageURL && !failed"
        :src="item.imageURL"
        :alt="item.name"
        loading="lazy"
        @error="failed = true"
      /><span v-else class="wd-photo-placeholder"
        >✿<small>Photo unavailable</small></span
      ><slot name="overlay" />
    </div>
    <div class="wd-card-body">
      <h2>{{ item.name }}</h2>
      <div class="wd-tags">
        <span :class="`wd-category-${item.category.toLowerCase()}`">{{
          categoryName(item.category)
        }}</span
        ><span v-if="item.colour" :style="colourTagStyle">{{
          item.colour
        }}</span>
      </div>
      <slot />
    </div>
  </article>
</template>
