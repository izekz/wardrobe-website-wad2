<script setup>
import WardrobeDialog from "../../components/WardrobeDialog.vue";
import { ref, computed, onMounted } from "vue";
import {
  wardrobeApi,
  occasions,
  matchesSearch,
} from "../../services/wardrobeService";
const outfits = ref([]),
  loading = ref(true),
  error = ref(""),
  filter = ref(""),
  search = ref(""),
  sort = ref("newest"),
  selected = ref(null),
  busy = ref(false),
  deleting = ref(null);
const filtered = computed(() =>
  outfits.value
    .filter(
      (o) =>
        (!filter.value || o.occasion === filter.value) &&
        matchesSearch(
          [
            o.name,
            o.occasion,
            o.eventDate,
            ...o.pieces.flatMap((p) => [
              p.name,
              p.category,
              p.colour,
              p.style,
              p.occasions,
            ]),
          ],
          search.value,
        ),
    )
    .slice()
    .sort((a, b) =>
      sort.value === "name"
        ? a.name.localeCompare(b.name)
        : new Date(b.createdAt) - new Date(a.createdAt),
    ),
);
async function load() {
  loading.value = true;
  error.value = "";
  try {
    outfits.value = (await wardrobeApi("/outfits")).outfits;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
async function remove() {
  busy.value = true;
  try {
    await wardrobeApi("/outfits/" + deleting.value.outfitId, {
      method: "DELETE",
    });
    outfits.value = outfits.value.filter(
      (o) => o.outfitId !== deleting.value.outfitId,
    );
    deleting.value = null;
    selected.value = null;
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
function savedDate(value) {
  return new Date(value).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Singapore",
  });
}
onMounted(load);
</script>
<template>
  <header class="wd-heading wd-heading-centred">
    <div>
      <h1>Good outfits, ready to repeat</h1>
      <p>Your favourites, all in one place.</p>
    </div>
    <RouterLink
      class="community-btn community-btn-outline"
      :to="{ name: 'outfit-match' }"
      >Plan an outfit →</RouterLink
    >
  </header>
  <div class="wd-filters">
    <div class="wd-chips">
      <button :class="{ active: !filter }" @click="filter = ''">All</button
      ><button
        v-for="o in occasions"
        :key="o"
        :class="{ active: filter === o }"
        @click="filter = o"
      >
        {{ o }}
      </button>
    </div>
    <label class="wd-saved-search"
      ><span class="visually-hidden">Search saved outfits</span
      ><input
        v-model="search"
        type="search"
        placeholder="Search saved outfits…"
    /></label>
    <label
      ><span class="visually-hidden">Sort outfits</span
      ><select v-model="sort">
        <option value="newest">Recently saved</option>
        <option value="name">Name A–Z</option>
      </select></label
    >
  </div>
  <p v-if="error" role="alert" class="community-error">
    {{ error }} <button class="wd-link" @click="load">Try again</button>
  </p>
  <p v-if="loading" role="status">Finding your favourites…</p>
  <div v-else-if="!filtered.length" class="wd-empty">
    <span>♡</span>
    <h2>
      {{
        outfits.length
          ? "No outfits match your search or filters"
          : "Good outfits deserve another day"
      }}
    </h2>
    <p>Create a combination in the planner and save it here.</p>
    <RouterLink class="community-btn" :to="{ name: 'outfit-match' }"
      >Plan your first outfit</RouterLink
    >
  </div>
  <div v-else class="wd-grid">
    <article
      v-for="(outfit, index) in filtered"
      :key="outfit.outfitId"
      class="wd-card"
    >
      <div class="wd-collage" :class="`wd-tone-${index % 4}`">
        <div
          v-for="piece in outfit.pieces"
          :key="piece.itemId || piece.productId"
        >
          <img
            v-if="piece.imageURL"
            :src="piece.imageURL"
            :alt="piece.name"
            loading="lazy"
            @error="piece.imageURL = null"
          /><span v-else>✿</span>
        </div>
      </div>
      <div class="wd-card-body">
        <h2 class="wd-saved-title">{{ outfit.name }}</h2>
        <div class="wd-tags">
          <span>{{ outfit.occasion }}</span
          ><span v-if="outfit.pieces.some((p) => p.missing)"
            >Piece unavailable</span
          >
        </div>
        <p class="wd-item-style">Saved {{ savedDate(outfit.createdAt) }}</p>
        <div class="wd-card-actions">
          <button class="community-btn" @click="selected = outfit">
            View outfit</button
          ><button class="wd-link" @click="deleting = outfit">Remove</button>
        </div>
      </div>
    </article>
  </div>
  <div class="wd-banner">
    <span>✿</span>
    <p>Something new on your calendar?</p>
    <RouterLink :to="{ name: 'outfit-match' }"
      >Plan another outfit →</RouterLink
    >
  </div>
  <WardrobeDialog
    v-if="selected"
    title-id="saved-title"
    :busy="false"
    wide
    @close="selected = null"
  >
    <button
      class="wd-modal-close"
      @click="selected = null"
      aria-label="Close outfit"
    >
      ×
    </button>
    <h2 id="saved-title">{{ selected.name }}</h2>
    <p>{{ selected.occasion }} · Planned for {{ selected.eventDate }}</p>
    <div class="wd-piece-grid">
      <article
        v-for="piece in selected.pieces"
        :key="piece.itemId || piece.productId"
      >
        <img
          v-if="piece.imageURL"
          :src="piece.imageURL"
          :alt="piece.name"
          @error="piece.imageURL = null"
        />
        <h3>{{ piece.name }}</h3>
        <p>
          {{
            piece.missing
              ? "Removed from wardrobe"
              : piece.source === "store"
                ? "Store piece · availability may change"
                : "In your wardrobe"
          }}
        </p>
      </article>
    </div>
    <RouterLink class="community-btn" :to="{ name: 'outfit-match' }"
      >Plan another combination</RouterLink
    >
  </WardrobeDialog>
  <WardrobeDialog
    v-if="deleting"
    title-id="remove-outfit"
    :busy="busy"
    @close="deleting = null"
  >
    <p v-if="error" role="alert" class="community-error">{{ error }}</p>
    <h2 id="remove-outfit">Remove saved outfit?</h2>
    <p>Your clothing stays in your wardrobe.</p>
    <div class="wd-card-actions">
      <button
        class="community-btn community-btn-outline"
        :disabled="busy"
        @click="deleting = null"
      >
        Cancel</button
      ><button class="community-btn" :disabled="busy" @click="remove">
        {{ busy ? "Removing…" : "Remove outfit" }}
      </button>
    </div>
  </WardrobeDialog>
</template>
