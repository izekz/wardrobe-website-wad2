<script setup>
import WardrobeDialog from "../../components/WardrobeDialog.vue";
import { computed, ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import "../../assets/styles/wardrobe.css";
import ClothingCard from "../../components/ClothingCard.vue";
import SavedOutfits from "./SavedOutfits.vue";
import {
  wardrobeApi,
  categories,
  styles,
  colours,
  categoryName,
  matchesSearch,
} from "../../services/wardrobeService";
const route = useRoute(),
  items = ref([]),
  loading = ref(true),
  error = ref(""),
  search = ref(""),
  category = ref(""),
  style = ref(""),
  colour = ref(""),
  deleting = ref(false),
  selected = ref(null);
const saved = computed(() => route.name === "saved-outfits");
const filtered = computed(() =>
  items.value.filter(
    (i) =>
      (!category.value || i.category === category.value) &&
      (!style.value || i.style.includes(style.value)) &&
      (!colour.value || i.colour === colour.value) &&
      matchesSearch(
        [
          i.name,
          i.category,
          categoryName(i.category),
          i.colour,
          i.style,
          i.material,
          i.occasions,
          i.weather,
        ],
        search.value,
      ),
  ),
);
async function load() {
  loading.value = true;
  error.value = "";
  try {
    items.value = (await wardrobeApi("/items")).items;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
async function remove() {
  deleting.value = true;
  error.value = "";
  try {
    await wardrobeApi("/items/" + selected.value.itemId, { method: "DELETE" });
    items.value = items.value.filter((i) => i.itemId !== selected.value.itemId);
    selected.value = null;
  } catch (e) {
    error.value = e.message;
  } finally {
    deleting.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="wd-page">
    <nav class="wd-tabs" aria-label="Wardrobe sections">
      <RouterLink
        :to="{ name: 'wardrobe' }"
        :class="{ active: !saved }"
        :aria-current="!saved ? 'page' : undefined"
        >My clothing</RouterLink
      ><RouterLink
        :to="{ name: 'saved-outfits' }"
        :class="{ active: saved }"
        :aria-current="saved ? 'page' : undefined"
        >Saved outfits</RouterLink
      >
    </nav>
    <SavedOutfits v-if="saved" />
    <template v-else>
      <header class="wd-heading">
        <div>
          <p class="wd-eyebrow">YOUR EVERYDAY COLLECTION</p>
          <h1>Your wardrobe, rediscovered</h1>
          <p>Build something new from what you already own.</p>
        </div>
        <div class="wd-heading-actions">
          <span class="wd-count"
            >✿ <strong>{{ items.length }} pieces</strong
            ><small>So many possibilities.</small></span
          ><RouterLink class="community-btn" :to="{ name: 'wardrobe-new' }"
            >＋ Add clothing</RouterLink
          >
        </div>
      </header>
      <div class="wd-filters">
        <div class="wd-chips" aria-label="Category filters">
          <button
            :class="{ active: !category }"
            @click="category = ''"
            :aria-pressed="!category"
          >
            All items</button
          ><button
            v-for="c in categories"
            :key="c"
            :class="{ active: category === c }"
            @click="category = c"
            :aria-pressed="category === c"
          >
            {{ categoryName(c) }}
          </button>
        </div>
        <div class="wd-search">
          <label
            ><span class="visually-hidden">Search your wardrobe</span
            ><input
              v-model="search"
              type="search"
              placeholder="Search your wardrobe…" /></label
          ><label
            ><span class="visually-hidden">Style</span
            ><select v-model="style">
              <option value="">All styles</option>
              <option v-for="s in styles" :key="s">{{ s }}</option>
            </select></label
          ><label
            ><span class="visually-hidden">Colour</span
            ><select v-model="colour">
              <option value="">All colours</option>
              <option v-for="c in colours" :key="c">{{ c }}</option>
            </select></label
          >
        </div>
      </div>
      <p v-if="error" role="alert" class="community-error">
        {{ error }} <button class="wd-link" @click="load">Try again</button>
      </p>
      <p v-if="loading" role="status">Opening your wardrobe…</p>
      <div v-else-if="!items.length" class="wd-empty">
        <span>✿</span>
        <h2>A little space for your favourite pieces</h2>
        <p>Add your first clothing photo. Your wardrobe belongs only to you.</p>
        <RouterLink class="community-btn" :to="{ name: 'wardrobe-new' }"
          >Add your first piece</RouterLink
        >
      </div>
      <div v-else-if="!filtered.length" class="wd-empty">
        <h2>No pieces match these filters</h2>
        <button
          class="community-btn community-btn-outline"
          @click="
            category = '';
            style = '';
            colour = '';
            search = '';
          "
        >
          Clear filters
        </button>
      </div>
      <div v-else class="wd-grid">
        <ClothingCard
          v-for="(item, index) in filtered"
          :key="item.itemId"
          :item="item"
          :index="index"
          ><p class="wd-item-style">{{ item.style.join(" · ") }}</p>
          <div class="wd-card-actions">
            <RouterLink
              :to="{ name: 'wardrobe-edit', params: { id: item.itemId } }"
              >Edit piece</RouterLink
            ><button class="wd-link" @click="selected = item">Delete</button>
          </div></ClothingCard
        >
      </div>
      <div class="wd-banner">
        <span>✿</span>
        <p>Something new on your calendar?</p>
        <RouterLink :to="{ name: 'outfit-match' }">Plan an outfit →</RouterLink>
      </div>
    </template>
    <WardrobeDialog
      v-if="selected"
      title-id="delete-title"
      :busy="deleting"
      @close="selected = null"
    >
      <p v-if="error" role="alert" class="community-error">{{ error }}</p>
      <h2 id="delete-title">Remove this piece?</h2>
      <p>
        {{ selected.name }} will be removed from your wardrobe. Saved outfits
        will mark it as unavailable.
      </p>
      <div class="wd-card-actions">
        <button
          class="community-btn community-btn-outline"
          :disabled="deleting"
          @click="selected = null"
        >
          Cancel</button
        ><button class="community-btn" :disabled="deleting" @click="remove">
          {{ deleting ? "Removing…" : "Delete piece" }}
        </button>
      </div>
    </WardrobeDialog>
  </section>
</template>
