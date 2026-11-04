<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../../assets/styles/wardrobe.css";
import ClothingCard from "../../components/ClothingCard.vue";
import CommunityIcon from "../../components/CommunityIcon.vue";
import {
  wardrobeApi,
  send,
  today,
  occasions,
  noOccasion,
  clothingColours,
  styles,
  categories,
  categoryName,
  matchesSearch,
  normalizeOccasion,
  plannerProductsState, hydratePlannerProducts, removePlannerProduct, storeVariantKey,
} from "../../services/wardrobeService";
const route = useRoute(),
  router = useRouter();
const items = ref([]),
  products = ref([]),
  weather = ref(null);
const selectedIds = ref([]),
  selectedStoreKeys = ref([]),
  selection = ref(null);
const loading = ref(true),
  busy = ref(false),
  scoring = ref(false),
  saving = ref(false),
  error = ref(""),
  notice = ref("");
const occasion = ref("Presentation"),
  date = ref(today()),
  style = ref(""),
  name = ref(""),
  initialized = ref(false);
const editOutfitId = computed(() => typeof route.query.outfitId === "string" ? route.query.outfitId : undefined);
const isEditing = computed(() => !!editOutfitId.value);
const loadedOutfitId = ref(null), editStorePieces = ref([]), editNotices = ref([]);
const candidateRefs = ref([]), unavailableStoreProducts = ref([]);
function noteEdit(message) { if (!editNotices.value.includes(message)) editNotices.value.push(message); }
const productId = computed(() => !isEditing.value && typeof route.query.productId === 'string' ? route.query.productId : undefined);
const productColour = computed(() => !isEditing.value && typeof route.query.colour === 'string' ? route.query.colour : undefined);
const freeStyling = computed(() => occasion.value === noOccasion);
const candidates = computed(() =>
  [...items.value, ...products.value].sort((a, b) =>
    (b.recommendation?.priority || 0) - (a.recommendation?.priority || 0) ||
    (b.recommendation?.occasionScore || 0) - (a.recommendation?.occasionScore || 0) ||
    a.name.localeCompare(b.name),
  ),
);
// Selection stays in the existing state; the picker and board are two views of it.
const search = ref(""), category = ref(""), failedPhotos = ref({});
const plannerRoot = ref(null);
async function placePiece(piece, event) {
  togglePiece(piece);
  await nextTick();
  const slot = [...(plannerRoot.value?.querySelectorAll(".wd-board-slot[data-piece-key]") || [])]
    .find(node => node.dataset.pieceKey === pieceKey(piece));
  slot?.querySelector(".wd-board-remove")?.focus({ preventScroll: event?.detail !== 0 });
}
async function returnPiece(piece, event) {
  togglePiece(piece);
  await nextTick();
  const selector = piece.source === 'store' ? '.wd-store-product-card[data-piece-key]' : '.wd-picker-grid [data-piece-key]';
  const card = [...(plannerRoot.value?.querySelectorAll(selector) || [])]
    .find(node => node.dataset.pieceKey === pieceKey(piece));
  (card?.querySelector('.wd-store-use-piece, .wd-use-piece') || plannerRoot.value?.querySelector(".wd-studio-search input"))?.focus({ preventScroll: event?.detail !== 0 });
}
const pickerCategories = [{ value: "", label: "All" }, ...categories.map(value => ({ value, label: categoryName(value) }))];
const availablePieces = computed(() => candidates.value.filter(piece =>
  piece.source === "wardrobe" &&
  !isSelected(piece) && (!category.value || piece.category === category.value) &&
  matchesSearch([piece.name, piece.category, categoryName(piece.category), clothingColours(piece), piece.style, piece.material], search.value),
));
const chosenPieces = computed(() => candidates.value.filter(isSelected));
const storeTrayPieces = computed(() => [...new Map([...products.value, ...unavailableStoreProducts.value]
  .map(piece => [storeVariantKey(piece), piece])).values()].filter(piece => !isSelected(piece)));
const boardGroups = computed(() => {
  const dress = chosenPieces.value.some(piece => piece.category === "Dresses");
  const labels = { Tops: "Top", Bottoms: "Bottom", Dresses: "Dress", Shoes: "Shoes", Jackets: "Outerwear", Accessories: "Accessory" };
  const slots = (values, optional = false) => values.map(category => ({
    category, label: labels[category], optional,
    piece: chosenPieces.value.find(piece => piece.category === category),
  }));
  return [
    { key: "basics", slots: slots(dress ? ["Dresses", "Shoes"] : ["Tops", "Bottoms", "Shoes"]) },
    { key: "optional", slots: slots(["Jackets", "Accessories"], true) },
  ];
});
const pieceKey = piece => piece.source === 'store' ? `store:${storeVariantKey(piece)}` : `wardrobe:${piece.itemId}`;
const photoKey = piece => `${pieceKey(piece)}:${piece.imageURL}`;
function resetOutfit() {
  if (saving.value || busy.value) return;
  selectedIds.value = [];
  selectedStoreKeys.value = [];
  error.value = "";
  notice.value = "";
}
const chosenCount = computed(
  () => selectedIds.value.length + selectedStoreKeys.value.length,
);
const requiredBasics = computed(() => {
  const chosen = items.value.filter((item) =>
    selectedIds.value.includes(item.itemId),
  );
  chosen.push(...products.value.filter(isSelected));
  const categories = new Set(chosen.map((p) => p.category));
  const required = categories.has("Dresses")
    ? ["Dresses", "Shoes"]
    : ["Tops", "Bottoms", "Shoes"];
  const labels = {
    Tops: "Top",
    Bottoms: "Bottom",
    Shoes: "Shoes",
    Dresses: "Dress",
  };
  const missing = required
    .filter((c) => !categories.has(c))
    .map((c) => labels[c]);
  return {
    selected: required.length - missing.length,
    total: required.length,
    percent: ((required.length - missing.length) / required.length) * 100,
    missing,
  };
});
const score = computed(() => selection.value?.matchScore ?? 0);
const scoreTone = computed(() =>
  score.value >= 75 ? "good" : score.value >= 50 ? "fair" : "poor",
);
const scoreLabel = computed(() =>
  freeStyling.value && selection.value?.scoreDetails.provisional ? "Provisional" : scoreTone.value === "good"
    ? "Good match"
    : scoreTone.value === "fair"
      ? "Room to improve"
      : "Not ideal",
);
const canSave = computed(
  () =>
    !loading.value &&
    (!isEditing.value || loadedOutfitId.value === editOutfitId.value) &&
    chosenCount.value > 0 &&
    selection.value?.complete &&
    !busy.value &&
    !scoring.value &&
    !saving.value &&
    !!name.value.trim(),
);
// Weather is decorative only; scoring and recommendations still use the existing API.
const weatherPaused = ref(false);
const displayedWeather = computed(() => !busy.value && weather.value?.available ? weather.value : null);
const weatherScene = computed(() => {
  const forecast = displayedWeather.value;
  if (!forecast) return "neutral";
  const code = forecast.weatherCode;
  if (Number.isInteger(code)) {
    if ([95, 96, 99].includes(code)) return "storm";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
    if ([45, 48].includes(code)) return "fog";
    if (code === 3) return "cloudy";
    if ([1, 2].includes(code)) return "partly";
    if (code === 0) return "sunny";
    return "neutral";
  }
  // Support older API responses during deployment without guessing unknown conditions.
  const condition = (forecast.condition || "").toLowerCase();
  if (condition.includes("thunder") || condition.includes("storm")) return "storm";
  if (/rain|shower|drizzle/.test(condition)) return "rain";
  if (condition.includes("snow")) return "snow";
  if (/fog|mist/.test(condition)) return "fog";
  if (condition.includes("partly")) return "partly";
  if (/cloud|overcast/.test(condition)) return "cloudy";
  if (/clear|sunny/.test(condition)) return "sunny";
  return "neutral";
});
const weatherSummary = computed(() => {
  const forecast = displayedWeather.value;
  if (!forecast) return busy.value ? "Checking the selected date’s forecast…" : "Forecast unavailable";
  return [
    forecast.location || "Singapore",
    Number.isFinite(forecast.temperature) ? `${Math.round(forecast.temperature)}°C high` : null,
    forecast.condition,
    Number.isFinite(forecast.rainChance) ? `${forecast.rainChance}% chance of rain` : null,
  ].filter(Boolean).join(" · ");
});
const weatherAdvice = computed(() => displayedWeather.value?.advice || []);

let generation = 0, scoreRequest = 0, plannerLoad = 0;
onBeforeUnmount(() => { plannerLoad++; generation++; scoreRequest++; });
function isSelected(piece) {
  return piece.source === 'store' ? selectedStoreKeys.value.includes(storeVariantKey(piece)) : selectedIds.value.includes(piece.itemId);
}
const selectedStoreRefs = computed(() => products.value.filter(isSelected).map(piece => ({ productId: piece.productId, colour: piece.colour, size: piece.size })));
async function assess() {
  const version = ++scoreRequest;
  selection.value = null;
  if (!chosenCount.value) { scoring.value = false; return; }
  scoring.value = true;
  try {
    const result = await wardrobeApi('/selection', send('POST', {
      occasion: occasion.value, date: date.value, style: style.value,
      itemIds: [...selectedIds.value], products: selectedStoreRefs.value,
    }));
    if (version === scoreRequest) selection.value = result.selection;
  } catch (e) { if (version === scoreRequest) error.value = e.message; }
  finally { if (version === scoreRequest) scoring.value = false; }
}
async function generate() {
  const version = ++generation;
  weather.value = null; scoreRequest++; selection.value = null; scoring.value = false;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    const result = await wardrobeApi('/recommendations', send('POST', {
      occasion: occasion.value, date: date.value, style: style.value,
      products: candidateRefs.value.map(({ productId, colour, size }) => ({ productId, colour, size })),
    }));
    if (version !== generation) return;
    items.value = result.items;
    products.value = result.products || (result.product ? [result.product] : []);
    weather.value = result.weather;
    const unavailable = [...plannerProductsState.products.filter(piece => piece.missing), ...(result.unavailableProducts || [])];
    unavailableStoreProducts.value = [...new Map(unavailable.map(piece => [storeVariantKey(piece), {
      ...piece, name: plannerProductsState.products.find(saved => storeVariantKey(saved) === storeVariantKey(piece))?.name || piece.name,
    }])).values()];
    const previousCount = selectedIds.value.length + selectedStoreKeys.value.length;
    selectedIds.value = selectedIds.value.filter(id => items.value.some(item => item.itemId === id));
    selectedStoreKeys.value = selectedStoreKeys.value.map(key => {
      const ref = candidateRefs.value.find(piece => storeVariantKey(piece) === key);
      return products.value.find(piece => storeVariantKey(piece) === key || ref && !ref.colour && piece.productId === ref.productId && (piece.size || '') === (ref.size || ''));
    }).filter(Boolean).map(storeVariantKey);
    const compatible = [], owned = [], store = [];
    for (const piece of [...products.value.filter(isSelected), ...items.value.filter(isSelected)]) {
      if (!compatible.some(other => piecesConflict(other, piece))) {
        compatible.push(piece);
        if (piece.source === 'store') store.push(storeVariantKey(piece)); else owned.push(piece.itemId);
      }
    }
    selectedIds.value = owned; selectedStoreKeys.value = store;
    if (previousCount !== owned.length + store.length) noteEdit('Some selected pieces are unavailable or have changed categories. Choose replacements before saving.');
    await assess();
    return true;
  } catch (e) { if (version === generation) error.value = e.message; }
  finally { if (version === generation) busy.value = false; }
}
function piecesConflict(other, piece) {
  return other?.category === piece.category ||
    (piece.category === 'Dresses' && ['Tops', 'Bottoms'].includes(other?.category)) ||
    (['Tops', 'Bottoms'].includes(piece.category) && other?.category === 'Dresses');
}
function togglePiece(piece) {
  if (saving.value || busy.value) return;
  error.value = ''; notice.value = '';
  if (isSelected(piece)) {
    if (piece.source === 'store') selectedStoreKeys.value = selectedStoreKeys.value.filter(key => key !== storeVariantKey(piece));
    else selectedIds.value = selectedIds.value.filter(id => id !== piece.itemId);
    return;
  }
  selectedIds.value = selectedIds.value.filter(id => !piecesConflict(items.value.find(item => item.itemId === id), piece));
  selectedStoreKeys.value = selectedStoreKeys.value.filter(key => !piecesConflict(products.value.find(item => storeVariantKey(item) === key), piece));
  if (piece.source === 'store') selectedStoreKeys.value = [...selectedStoreKeys.value, storeVariantKey(piece)];
  else selectedIds.value = [...selectedIds.value, piece.itemId];
}
async function save() {
  if (!chosenCount.value) { error.value = 'Use at least one piece before saving an outfit.'; return; }
  if (!name.value.trim()) { error.value = 'Enter an outfit name before saving.'; return; }
  if (!canSave.value) { error.value = 'Choose shoes and either a dress or a top and bottom before saving.'; return; }
  saving.value = true; error.value = ''; const version = plannerLoad;
  try {
    await wardrobeApi(isEditing.value ? `/outfits/${encodeURIComponent(editOutfitId.value)}` : '/outfits', send(isEditing.value ? 'PUT' : 'POST', {
      name: name.value, occasion: occasion.value, date: date.value,
      itemIds: [...selectedIds.value], products: selectedStoreRefs.value,
    }));
    if (version === plannerLoad) await router.push({ name: 'saved-outfits' });
  } catch (e) { if (version === plannerLoad) error.value = e.message; }
  finally { if (version === plannerLoad) saving.value = false; }
}
async function loadPlanner() {
  const version = ++plannerLoad;
  initialized.value = false; generation++; scoreRequest++;
  loading.value = true; busy.value = false; scoring.value = false; error.value = '';
  editNotices.value = []; loadedOutfitId.value = null; editStorePieces.value = [];
  selectedIds.value = []; selectedStoreKeys.value = []; selection.value = null;
  items.value = []; products.value = []; candidateRefs.value = []; unavailableStoreProducts.value = [];
  weather.value = null; name.value = ''; occasion.value = 'Presentation'; date.value = today(); style.value = '';
  search.value = ''; category.value = '';
  try {
    await hydratePlannerProducts(true);
    if (version !== plannerLoad) return;
    if (isEditing.value) {
      const { outfit } = await wardrobeApi(`/outfits/${encodeURIComponent(editOutfitId.value)}`);
      if (version !== plannerLoad) return;
      name.value = outfit.name; occasion.value = normalizeOccasion(outfit.occasion);
      if (outfit.eventDate && outfit.eventDate >= today()) date.value = outfit.eventDate;
      else if (outfit.eventDate) noteEdit('This outfit’s planned date has passed. The date is now set to today; you can choose another date.');
      const missing = outfit.pieces.filter(piece => piece.missing);
      if (missing.length) noteEdit(`These pieces are no longer available and were not added: ${missing.map(piece => piece.name).join(', ')}. Choose replacements before updating.`);
      selectedIds.value = outfit.pieces.filter(piece => piece.source === 'wardrobe' && !piece.missing).map(piece => piece.itemId);
      editStorePieces.value = outfit.pieces.filter(piece => piece.source === 'store' && !piece.missing);
      selectedStoreKeys.value = editStorePieces.value.map(storeVariantKey);
    }
    const legacy = !isEditing.value && productId.value ? [{ productId: productId.value, colour: productColour.value || '', size: typeof route.query.size === 'string' ? route.query.size : '' }] : [];
    candidateRefs.value = [...new Map([...plannerProductsState.products.filter(piece => !piece.missing), ...editStorePieces.value, ...legacy].map(piece => [storeVariantKey(piece), piece])).values()];
    // Keep older shared links working; the new Add button only collects candidates.
    if (legacy.length) selectedStoreKeys.value = legacy.map(storeVariantKey);
    await nextTick(); if (version !== plannerLoad) return;
    initialized.value = true;
    const success = await generate();
    if (version === plannerLoad && success && isEditing.value) loadedOutfitId.value = editOutfitId.value;
  } catch (e) { if (version === plannerLoad) error.value = e.message; }
  finally { if (version === plannerLoad) loading.value = false; }
}
function retryPlanner() {
  if (!initialized.value || isEditing.value && loadedOutfitId.value !== editOutfitId.value) loadPlanner();
  else generate();
}
async function removeStoreCandidate(piece) {
  if (saving.value || busy.value || plannerProductsState.pending) return;
  const version = plannerLoad, key = storeVariantKey(piece);
  error.value = '';
  try {
    if (plannerProductsState.products.some(item => storeVariantKey(item) === key)) await removePlannerProduct(key);
    if (version !== plannerLoad) return;
    candidateRefs.value = candidateRefs.value.filter(item => storeVariantKey(item) !== key);
    products.value = products.value.filter(item => storeVariantKey(item) !== key);
    unavailableStoreProducts.value = unavailableStoreProducts.value.filter(item => storeVariantKey(item) !== key);
    selectedStoreKeys.value = selectedStoreKeys.value.filter(item => item !== key);
  } catch (e) { if (version === plannerLoad && e.code !== 'ACCOUNT_CHANGED') error.value = e.message; }
}
onMounted(loadPlanner);
watch([editOutfitId, productId, productColour, () => route.query.size], loadPlanner);
watch([occasion, date, style], () => { if (initialized.value) generate(); });
watch([selectedIds, selectedStoreKeys], () => { if (initialized.value && !busy.value) assess(); }, { deep: true });
watch(() => plannerProductsState.ownerId, owner => {
  if (owner) loadPlanner();
  else { plannerLoad++; generation++; scoreRequest++; initialized.value = false; items.value = []; products.value = []; selectedIds.value = []; selectedStoreKeys.value = []; selection.value = null; }
});
</script>
<template>
  <section ref="plannerRoot" class="wd-page wd-studio wd-weather-studio">
    <div class="wd-weather-scene" :class="[`wd-sky-${weatherScene}`, { 'is-paused': weatherPaused }]" aria-hidden="true" inert>
      <Transition name="wd-weather-fade">
        <div v-if="weatherScene !== 'neutral'" :key="weatherScene" class="wd-weather-atmosphere" :class="`wd-atmosphere-${weatherScene}`">
          <div class="wd-weather-stage">
            <div class="wd-sky-haze"></div>
            <template v-if="['sunny', 'partly'].includes(weatherScene)">
              <div class="wd-sky-sun"></div>
              <div class="wd-sky-beams">
                <span v-for="beam in 6" :key="beam" :style="{ '--beam': beam }"></span>
              </div>
              <div class="wd-sky-glints">
                <span v-for="glint in 16" :key="glint" :style="{ left: `${(glint * 37) % 100}%`, top: `${(glint * 19) % 100}%`, '--glint': glint }"></span>
              </div>
            </template>
            <div v-if="['partly', 'cloudy', 'rain', 'storm', 'fog', 'snow'].includes(weatherScene)" class="wd-sky-clouds">
              <span v-for="cloud in 8" :key="cloud" class="wd-sky-cloud" :style="{ '--cloud': cloud, '--cloud-top': `${[0, 15, 4, 43, 68, 82, 35, 60][cloud - 1]}%` }"></span>
            </div>
            <div v-if="['rain', 'storm', 'snow'].includes(weatherScene)" class="wd-sky-precipitation">
              <span v-for="drop in (weatherScene === 'snow' ? 50 : 120)" :key="drop" class="wd-sky-drop" :class="`wd-drop-depth-${drop % 3}`" :style="{
                left: `${(drop * 37.31) % 120 - 10}%`, '--drop-start': `${(drop * 23) % 100}%`,
                '--fall-duration': `${1.1 + (drop % 7) * 0.18}s`, '--fall-delay': `${-drop * 0.39}s`,
              }"></span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
    <header class="wd-planner-heading">
      <div>
        <h1>{{ isEditing ? "Edit your outfit" : "Outfit planner" }}</h1>
        <p>{{ isEditing ? "Make your changes, then update your saved outfit." : "Choose pieces for your next occasion." }}</p>
      </div>
      <div class="wd-studio-heading-actions">
        <RouterLink :to="{ name: 'saved-outfits' }">{{ isEditing ? 'Cancel editing' : 'Saved outfits' }}<CommunityIcon name="arrow" :size="16" /></RouterLink>
        <div class="wd-weather-controls">
          <button v-if="weatherScene !== 'neutral'" type="button" class="wd-weather-pause" :aria-pressed="weatherPaused" @click="weatherPaused = !weatherPaused">
            {{ weatherPaused ? 'Resume weather animation' : 'Pause weather animation' }}
          </button>
        </div>
      </div>
    </header>

    <div class="wd-studio-toolbar">
      <label class="wd-studio-field">
        <span id="wd-occasion-label">Occasion</span>
        <select aria-labelledby="wd-occasion-label" v-model="occasion" :disabled="saving">
          <option v-for="o in occasions" :key="o">{{ o }}</option>
        </select>
      </label>
      <label class="wd-studio-field">
        <span id="wd-date-label">Date</span>
        <input aria-labelledby="wd-date-label" v-model="date" :min="today()" type="date" :disabled="saving" />
      </label>
      <label class="wd-studio-field">
        <span id="wd-style-label">Style</span>
        <select aria-labelledby="wd-style-label" v-model="style" :disabled="saving">
          <option value="">My preferences</option>
          <option v-for="s in styles" :key="s">{{ s }}</option>
        </select>
      </label>
    </div>

    <section v-if="storeTrayPieces.length && !loading && (!isEditing || loadedOutfitId === editOutfitId)" class="wd-store-product-tray" aria-labelledby="wd-store-products-title">
      <header class="wd-store-tray-heading">
        <h2 id="wd-store-products-title">Added from stores <span>{{ storeTrayPieces.length }}</span></h2>
        <p>Use a store piece alongside your wardrobe.</p>
      </header>
      <ul class="wd-store-product-scroll" tabindex="0" aria-label="Store products — scroll horizontally">
        <li v-for="piece in storeTrayPieces" :key="storeVariantKey(piece)" class="wd-store-product-card" :class="{ 'is-unavailable': piece.missing }" :data-piece-key="pieceKey(piece)">
          <div class="wd-store-product-content">
            <div class="wd-store-product-photo">
              <img v-if="!piece.missing && piece.imageURL && !failedPhotos[photoKey(piece)]" :src="piece.imageURL" :alt="piece.name" loading="lazy" @error="failedPhotos[photoKey(piece)] = true" />
              <span v-else><CommunityIcon name="hanger" :size="23" /><small>Photo unavailable</small></span>
            </div>
            <div class="wd-store-product-copy">
              <h3 :title="piece.name"><RouterLink v-if="!piece.missing" class="wd-store-product-link" :to="{ name: 'discover-product', params: { productId: piece.productId }, query: { fromPlanner: '1', plannerKey: storeVariantKey(piece), colour: piece.colour || '', size: piece.size || '' } }" :aria-label="`View product details: ${piece.name}`">{{ piece.name }}</RouterLink><template v-else>{{ piece.name }}</template></h3>
              <p v-if="piece.businessName" class="wd-store-product-business">{{ piece.businessName }}</p>
              <p class="wd-store-product-options"><span v-if="Number.isFinite(piece.price)">S${{ piece.price.toFixed(2) }}</span><span v-if="piece.colour">{{ piece.colour }}</span><span v-if="piece.size">Size {{ piece.size }}</span></p>
              <p v-if="piece.missing" class="wd-store-product-unavailable">No longer available</p>
              <p v-else-if="piece.description" class="wd-store-product-description" :title="piece.description">{{ piece.description }}</p>
            </div>
          </div>
          <div class="wd-store-product-actions">
            <button type="button" class="wd-store-use-piece" :aria-label="`Use this piece: ${piece.name}`" :disabled="saving || busy || piece.missing || plannerProductsState.pending > 0" @click="placePiece(piece, $event)"><CommunityIcon name="plus" :size="14" />Use this piece</button>
            <button type="button" class="wd-remove-store" :aria-label="`Remove ${piece.name} from planner`" :disabled="saving || busy || plannerProductsState.pending > 0" @click="removeStoreCandidate(piece)"><CommunityIcon name="close" :size="14" />Remove from planner</button>
          </div>
        </li>
      </ul>
    </section>

    <nav class="wd-mobile-steps" aria-label="Planner sections">
      <a href="#wd-picker-title">Choose pieces</a>
      <a href="#wd-board-title">Outfit board</a>
      <a href="#wd-selection-title">Review &amp; save</a>
    </nav>
    <p v-if="error" role="alert" class="community-error">
      {{ error }}
      <button class="wd-link" :disabled="saving" @click="retryPlanner">Try again</button>
    </p>
    <p v-for="message in editNotices" :key="message" class="wd-weather-note" role="status">{{ message }}</p>
    <p v-if="loading || busy" role="status" class="wd-studio-loading">Finding recommendations for your wardrobe…</p>
    <template v-else-if="!isEditing || loadedOutfitId === editOutfitId">
      <div v-if="!candidates.length" class="wd-empty">
        <span>✿</span>
        <h2>Your next outfit starts with a few pieces</h2>
        <p>Add tops, bottoms or dresses and shoes to start building your outfit.</p>
        <RouterLink class="community-btn" :to="{ name: 'wardrobe-new' }">Add clothing</RouterLink>
      </div>
      <div v-else class="wd-planner-layout">
        <section class="wd-studio-picker" aria-labelledby="wd-picker-title">
          <header class="wd-picker-heading">
            <h2 id="wd-picker-title" tabindex="-1">Choose your pieces</h2>
            <details class="wd-picker-help">
              <summary>How selection works</summary>
              <p>One piece per category. A dress replaces a top and bottom. Choosing another piece in a category replaces your earlier choice.</p>
            </details>
          </header>
          <label class="wd-studio-search">
            <CommunityIcon name="search" :size="19" />
            <span class="visually-hidden">Search your wardrobe</span>
            <input v-model="search" type="search" placeholder="Search your wardrobe…" />
          </label>
          <div class="wd-studio-categories" role="group" aria-label="Filter clothing by category">
            <button v-for="option in pickerCategories" :key="option.value" type="button"
              :class="{ active: category === option.value }" :aria-pressed="category === option.value"
              @click="category = option.value">{{ option.label }}</button>
          </div>
          <p class="wd-studio-available" role="status">{{ availablePieces.length }} {{ availablePieces.length === 1 ? 'piece' : 'pieces' }} available</p>
          <TransitionGroup v-if="availablePieces.length" name="wd-piece" tag="div" class="wd-picker-grid">
            <ClothingCard v-for="(piece, index) in availablePieces" :key="pieceKey(piece)" :data-piece-key="pieceKey(piece)" :item="piece" :index="index">
              <template #overlay>
                <div v-if="piece.recommendation?.label" class="wd-photo-recommendations">
                  <span v-if="piece.recommendation.kind === 'occasion'" class="wd-piece-recommendation"><CommunityIcon name="check" :size="13" />{{ piece.recommendation.label }}</span>
                  <span v-if="piece.recommendation.styleMatch || piece.recommendation.kind === 'style'" class="wd-piece-recommendation is-style"><CommunityIcon name="check" :size="13" />Matches your style</span>
                </div>
              </template>
              <p class="wd-item-style">{{ piece.style?.join(" · ") || "Style not tagged" }}</p>
              <button type="button" class="wd-use-piece" :aria-label="`Use this piece: ${piece.name}`" :disabled="saving" @click="placePiece(piece, $event)">
                <CommunityIcon name="plus" :size="16" />Use this piece
              </button>
            </ClothingCard>
          </TransitionGroup>
          <div v-else class="wd-studio-picker-empty">
            <CommunityIcon name="hanger" :size="32" />
            <h3>{{ search || category ? 'No matching pieces' : !items.length ? 'Your wardrobe is empty' : 'Your wardrobe pieces are on the board' }}</h3>
            <p>{{ search || category ? 'Try a different search or category.' : !items.length ? 'Add your own clothes to mix with store pieces.' : 'Remove a wardrobe piece from your outfit board to choose it again.' }}</p>
            <button v-if="search || category" type="button" class="wd-link" @click="search = ''; category = ''">Clear filters</button>
            <RouterLink v-else-if="!items.length" class="wd-link" :to="{ name: 'wardrobe-new' }">Add clothing</RouterLink>
          </div>
          <a v-if="chosenCount" class="wd-mobile-board-link" href="#wd-board-title">View outfit board · {{ chosenCount }} selected<CommunityIcon name="arrow" :size="16" /></a>
        </section>

        <section class="wd-studio-board" aria-labelledby="wd-board-title">
          <header class="wd-studio-board-heading">
            <h2 id="wd-board-title" tabindex="-1">Your outfit board</h2>
            <span class="wd-studio-count" aria-live="polite">{{ chosenCount }} {{ chosenCount === 1 ? 'piece' : 'pieces' }}</span>
          </header>
          <p class="wd-studio-board-caption">Top to toe. Layers and accessories alongside.</p>
          <div class="wd-studio-board-columns">
            <div v-for="group in boardGroups" :key="group.key" :class="`wd-studio-board-${group.key}`">
              <article v-for="slot in group.slots" :key="slot.category" class="wd-board-slot"
                :class="{ 'is-empty': !slot.piece, 'is-dress': slot.category === 'Dresses', 'is-shoes': slot.category === 'Shoes' }"
                :data-piece-key="slot.piece ? pieceKey(slot.piece) : undefined"
                :aria-label="`${slot.label}${slot.piece ? ': ' + slot.piece.name : ': not selected'}`">
                <header class="wd-board-slot-heading">
                  <span class="wd-board-slot-label">{{ slot.label }}<small v-if="slot.optional">Optional</small></span>
                  <h3 v-if="slot.piece">{{ slot.piece.name }}</h3>
                </header>
                <Transition name="wd-board-piece">
                  <div v-if="slot.piece" :key="pieceKey(slot.piece)" class="wd-board-selected">
                    <div class="wd-board-photo">
                      <img v-if="slot.piece.imageURL && !failedPhotos[photoKey(slot.piece)]" :src="slot.piece.imageURL"
                        :alt="slot.piece.name" @error="failedPhotos[photoKey(slot.piece)] = true" />
                      <span v-else class="wd-board-photo-fallback"><CommunityIcon name="hanger" :size="28" />Photo unavailable</span>
                      <button type="button" class="wd-board-remove" :aria-label="`Remove ${slot.piece.name} from outfit`"
                        :disabled="saving" @click="returnPiece(slot.piece, $event)"><CommunityIcon name="close" :size="18" /></button>
                    </div>
                    <span v-if="slot.category === 'Dresses'" class="wd-board-dress-note">Covers top + bottom</span>
                    <p v-if="slot.piece.source === 'store'" class="wd-board-store-note">{{ slot.piece.businessName || 'Store pick' }} · {{ slot.piece.colour }}<span v-if="slot.piece.size"> · Size {{ slot.piece.size }}</span> · S${{ Number(slot.piece.price).toFixed(2) }}</p>
                  </div>
                  <div v-else key="empty" class="wd-board-placeholder">
                    <CommunityIcon :name="slot.category === 'Accessories' ? 'tag' : 'hanger'" :size="26" />
                    <span>{{ slot.optional ? 'Add if you like' : `Choose ${slot.label === 'Shoes' ? 'shoes' : 'a ' + slot.label.toLowerCase()}` }}</span>
                  </div>
                </Transition>
              </article>
            </div>
          </div>
          <button type="button" class="wd-studio-reset" :disabled="!chosenCount || saving" @click="resetOutfit">
            <CommunityIcon name="close" :size="15" /> Reset outfit
          </button>
        </section>

        <aside class="wd-plan-summary">
          <p id="wd-selection-title" tabindex="-1" class="wd-selection-label">Your selection</p>
          <div class="wd-summary-title">
            <h2>
              {{ freeStyling ? 'Your styled outfit' : `${occasion} ${selection?.complete ? 'ready' : 'outfit'}` }}
            </h2>
            <div
              v-if="selection && chosenCount"
              class="wd-rating"
              :class="`wd-rating-${scoreTone}`"
            >
              <strong>{{ score }}<small>/100</small></strong
              ><span>{{ scoreLabel }}</span>
            </div>
          </div>
          <div class="wd-tags">
            <span>{{ style || "Your wardrobe" }}</span
            ><span
              >{{ chosenCount }}
              {{ chosenCount === 1 ? "piece" : "pieces" }} selected</span
            >
          </div>
          <div class="wd-match-progress" aria-live="polite">
            <div class="wd-progress-label">
              <strong>{{ freeStyling ? "Styling match" : "Selected outfit match" }}</strong
              ><span>{{
                scoring
                  ? "Calculating…"
                  : selection
                    ? `${score} / 100`
                    : "Choose a piece"
              }}</span>
            </div>
            <div
              class="wd-progress-track"
              role="progressbar"
              aria-label="Selected outfit match score"
              :aria-valuenow="score"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuetext="
                selection
                  ? `${score} out of 100 for your selected pieces`
                  : 'No pieces selected'
              "
            >
              <div
                :class="`wd-progress-${scoreTone}`"
                :style="{ width: `${score}%` }"
              ></div>
            </div>
            <p v-if="!chosenCount">
              Use a piece from your wardrobe to start building your outfit.
            </p>
            <p v-else>
              Based on your {{ chosenCount }} selected {{ chosenCount === 1 ? "piece" : "pieces" }}.
              <span v-if="selection?.scoreDetails.provisional">{{ freeStyling ? chosenCount < 2 ? 'Choose another piece for a colour and style comparison. This score is provisional.' : 'Some colour or style details cannot be compared. This score is provisional.' : 'This is a provisional score for one piece.' }}</span>
            </p>
          </div>
          <ul v-if="selection?.comments?.length" class="wd-reasons">
            <li v-for="comment in selection.comments" :key="comment.text"
              :class="comment.kind === 'warning' ? 'wd-match-warning' : 'wd-match-tip'">
              {{ comment.text }}
            </li>
          </ul>
          <section class="wd-selection-weather" aria-labelledby="wd-weather-advice-title" aria-live="polite" aria-atomic="true">
            <h3 id="wd-weather-advice-title">Weather advice</h3>
            <p class="wd-selection-forecast">
              {{ weatherSummary }}
            </p>
            <template v-if="displayedWeather">
              <p v-if="displayedWeather.date" class="wd-selection-forecast-date">Forecast for {{ displayedWeather.date }} · Daily forecast, not live conditions.</p>
              <ul v-if="weatherAdvice.length">
                <li v-for="advice in weatherAdvice" :key="advice">{{ advice }}</li>
              </ul>
            </template>
            <p v-else-if="!busy">{{ weather?.message || 'You can still plan your outfit. Weather advice will appear when a forecast is available.' }}</p>
          </section>
          <div class="wd-basics-progress" aria-live="polite">
            <div class="wd-progress-label">
              <strong>Required basic pieces</strong
              ><span
                >{{ requiredBasics.selected }} /
                {{ requiredBasics.total }}</span
              >
            </div>
            <div
              class="wd-progress-track wd-basics-track"
              role="progressbar"
              aria-label="Required basic pieces selected"
              :aria-valuenow="requiredBasics.selected"
              aria-valuemin="0"
              :aria-valuemax="requiredBasics.total"
            >
              <div
                class="wd-basics-fill"
                :class="
                  requiredBasics.selected === requiredBasics.total
                    ? 'wd-basics-green'
                    : requiredBasics.selected <= 1
                      ? 'wd-basics-red'
                      : 'wd-basics-yellow'
                "
                :style="{ width: `${requiredBasics.percent}%` }"
              ></div>
              <span
                v-for="step in requiredBasics.total - 1"
                :key="step"
                class="wd-basics-divider"
                :style="{ left: `${(step / requiredBasics.total) * 100}%` }"
                aria-hidden="true"
              ></span>
            </div>
            <ul v-if="requiredBasics.missing.length" class="wd-missing-basics">
              <li v-for="piece in requiredBasics.missing" :key="piece">
                {{ piece }} not selected
              </li>
            </ul>
            <p class="wd-basics-note">
              Accessories and outerwear are optional. A dress replaces a top and
              bottom.
            </p>
          </div>
          <label class="wd-outfit-name"
            ><span class="wd-field-label"
              >Outfit name
              <span class="wd-required" aria-hidden="true">*</span></span
            ><input
              v-model.trim="name"
              placeholder="Enter Name"
              required
              aria-required="true"
              maxlength="80"
              :disabled="saving"
          /></label>
          <button class="community-btn" :disabled="!canSave" @click="save">
            {{
              saving
                ? isEditing ? "Updating…" : "Saving…"
                : isEditing ? "Update Outfit" : !chosenCount
                  ? "Choose pieces to save"
                  : !selection?.complete
                    ? "Complete your outfit to save"
                    : "Save outfit"
            }}
          </button>
          <p v-if="notice" role="status" class="wd-success">{{ notice }}</p>
          <details class="wd-score-guide" aria-label="Matching score explanation">
            <summary>How your match score works</summary>
            <p class="wd-score-formula">
              {{ freeStyling ? 'Colour coordination 50 + Style harmony 50' : 'Occasion 60 + Colour coordination 25 + Weather 15' }}
            </p>
            <div v-if="selection" class="wd-score-breakdown">
              <div
                v-for="component in selection.scoreDetails.components"
                :key="component.label"
              >
                <span>{{ component.label }}</span
                ><strong>{{
                  component.available
                    ? `${component.earned.toFixed(1)} / ${component.weight}`
                    : "Not assessed"
                }}</strong>
              </div>
            </div>
            <p>
              Score = earned points ÷ available points × 100. Basic-piece
              completeness is shown separately. Unavailable checks are left out.
              Selected outfits have a minimum display score of 5. This minimum is not a bonus.
            </p>
            <p v-if="!freeStyling">Occasion points per piece: Style 40 + Colour 10 + Material 10.
              Each property earns partial points independently. The outfit uses their average. Category does not add match points.</p>
            <p v-else>With no specific occasion, the score compares your selected clothes' colours and style tags. Shared styles earn 100%, related styles 70% and contrasting styles 30%. Each garment pair has equal weight. Weather and materials do not add points in this mode.</p>
            <p><template v-if="!freeStyling">For multi-coloured items, occasion colour points average all selected colours. </template>Colour coordination averages every colour combination between two garments, then averages the garment pairs.</p>
            <details v-if="selection && !freeStyling" class="wd-item-score-details">
              <summary>Points for each selected piece</summary>
              <section v-for="item in selection.scoreDetails.itemDetails" :key="item.itemId || item.name">
                <strong>{{ item.name }} · {{ item.earned }} / 60 occasion points</strong>
                <div v-for="part in item.components" :key="part.label" class="wd-score-detail-row">
                  <span>{{ part.label }}</span><span>{{ part.available ? `${part.earned} / ${part.weight}` : `${part.provided ? 'Not assessed' : 'Unknown'} · 0 / ${part.weight}` }}</span>
                </div>
              </section>
              <p>Colour pairs: neutral 100%, same or compatible 67%, other known pairs 20%.
                Compatible pairs include existing matches and complementary or analogous palettes from The Color API.
                Palette matching allows nearby shades; unavailable palettes use the existing colour rules.
                Weather checks use material, with temperature weighted 10 and rain weighted 5. Unknown checks are left out. Clothing category does not change these points.</p>
            </details>
            <details v-if="selection?.scoreDetails.colourDetails?.length" class="wd-item-score-details">
              <summary>Colour pair points</summary>
              <section v-for="(pair, index) in selection.scoreDetails.colourDetails" :key="index">
                <strong>{{ pair.colours.join(' + ') }} · {{ pair.points }} / 3</strong>
                <p>{{ pair.explanation }}</p>
                <div v-if="pair.comparisons?.length > 1" v-for="(comparison, index) in pair.comparisons" :key="index" class="wd-score-detail-row"><span>{{ comparison.colours.join(' + ') }}</span><span>{{ comparison.points.toFixed(1) }} / 3</span></div>
              </section>
              <p>Average garment-pair points ÷ 3 × {{ freeStyling ? 50 : 25 }} gives your colour coordination points. Every selected colour contributes.</p>
            </details>
            <details v-if="freeStyling && selection?.scoreDetails.styleDetails?.length" class="wd-item-score-details">
              <summary>Style pair points</summary>
              <section v-for="(pair, index) in selection.scoreDetails.styleDetails" :key="index"><strong>{{ pair.names.join(' + ') }} · {{ Math.round(pair.ratio * 100) }}%</strong><p>{{ pair.explanation }}: {{ pair.styles.map(tags => tags.join(', ')).join(' + ') }}</p></section>
              <p>Related style pairs: Classic with Minimalist, Preppy, Vintage or Romantic; Minimalist with Preppy; Preppy with Vintage; Romantic with Vintage or Y2K; Streetwear with Vintage or Y2K; Vintage with Y2K. Other different styles earn partial points. These are simple styling assumptions, not strict fashion rules.</p>
            </details>
            <p>Personal style preferences affect recommendations only. They do not add match points.</p>
            <p class="wd-score-key">
              <span class="good">75–100: Good</span
              ><span class="fair">50–74: Room to improve</span
              ><span class="poor">5–49: Not ideal</span>
            </p>
            <p>
              The badge and progress bar show the same score for your selected
              pieces. Recommendations do not count until you choose them. Adding
              or removing a piece recalculates the match.
            </p>
            <small
              >Scores use simple styling rules, not a guarantee of suitability. Category only controls outfit structure and completeness. Missing metadata and legacy generic colour labels can limit assessment.</small
            >
          </details>
        </aside>
      </div>
    </template>
    <p class="wd-attribution">
      Weather data by
      <a href="https://open-meteo.com/" target="_blank" rel="noopener"
        >Open-Meteo</a
      >. Daily forecast for Singapore; actual conditions may differ.
      Colour palettes by <a href="https://www.thecolorapi.com/" target="_blank" rel="noopener">The Color API</a> when available.
    </p>
  </section>
</template>
