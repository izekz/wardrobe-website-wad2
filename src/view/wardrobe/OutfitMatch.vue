<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../../assets/styles/wardrobe.css";
import ClothingCard from "../../components/ClothingCard.vue";
import CommunityIcon from "../../components/CommunityIcon.vue";
import {
  wardrobeApi,
  send,
  today,
  occasions,
  styles,
  weatherEmoji,
  categories,
  categoryName,
  matchesSearch,
} from "../../services/wardrobeService";
const route = useRoute(),
  router = useRouter();
const items = ref([]),
  product = ref(null),
  weather = ref(null);
const selectedIds = ref([]),
  selectedProduct = ref(false),
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
const productId = computed(() =>
  typeof route.query.productId === "string" ? route.query.productId : undefined,
);
const productColour = computed(() =>
  typeof route.query.colour === "string" ? route.query.colour : undefined,
);
const candidates = computed(() =>
  [...items.value, ...(product.value ? [product.value] : [])].sort((a, b) =>
    (b.recommendation?.priority || 0) - (a.recommendation?.priority || 0) ||
    (b.recommendation?.occasionScore || 0) - (a.recommendation?.occasionScore || 0) ||
    a.name.localeCompare(b.name),
  ),
);
// Selection stays in the existing state; the picker and board are two views of it.
const search = ref(""), category = ref(""), failedPhotos = ref({});
const pickerCategories = [{ value: "", label: "All" }, ...categories.map(value => ({ value, label: categoryName(value) }))];
const availablePieces = computed(() => candidates.value.filter(piece =>
  !isSelected(piece) && (!category.value || piece.category === category.value) &&
  matchesSearch([piece.name, piece.category, categoryName(piece.category), piece.colour, piece.style, piece.material], search.value),
));
const chosenPieces = computed(() => candidates.value.filter(isSelected));
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
const pieceKey = piece => `${piece.source}:${piece.itemId || piece.productId}`;
const photoKey = piece => `${pieceKey(piece)}:${piece.imageURL}`;
function resetOutfit() {
  if (saving.value || busy.value) return;
  selectedIds.value = [];
  selectedProduct.value = false;
  error.value = "";
  notice.value = "";
}
const chosenCount = computed(
  () => selectedIds.value.length + Number(selectedProduct.value),
);
const requiredBasics = computed(() => {
  const chosen = items.value.filter((item) =>
    selectedIds.value.includes(item.itemId),
  );
  if (selectedProduct.value && product.value) chosen.push(product.value);
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
  scoreTone.value === "good"
    ? "Good match"
    : scoreTone.value === "fair"
      ? "Room to improve"
      : "Not ideal",
);
const canSave = computed(
  () =>
    chosenCount.value > 0 &&
    selection.value?.complete &&
    !busy.value &&
    !scoring.value &&
    !saving.value &&
    !!name.value.trim(),
);
let generation = 0,
  scoreRequest = 0,
  loadedProductId;
onBeforeUnmount(() => {
  generation++;
  scoreRequest++;
});
function isSelected(piece) {
  return piece.source === "store"
    ? selectedProduct.value
    : selectedIds.value.includes(piece.itemId);
}
async function assess() {
  const version = ++scoreRequest;
  selection.value = null;
  if (!chosenCount.value) {
    scoring.value = false;
    return;
  }
  scoring.value = true;
  try {
    const result = await wardrobeApi(
      "/selection",
      send("POST", {
        occasion: occasion.value,
        date: date.value,
        style: style.value,
        itemIds: [...selectedIds.value],
        ...(selectedProduct.value ? { productId: productId.value, productColour: productColour.value } : {}),
      }),
    );
    if (version === scoreRequest) selection.value = result.selection;
  } catch (e) {
    if (version === scoreRequest) error.value = e.message;
  } finally {
    if (version === scoreRequest) scoring.value = false;
  }
}
async function generate() {
  const version = ++generation;
  scoreRequest++;
  selection.value = null;
  scoring.value = false;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    const result = await wardrobeApi(
      "/recommendations",
      send("POST", {
        occasion: occasion.value,
        date: date.value,
        style: style.value,
        productId: productId.value,
        productColour: productColour.value,
      }),
    );
    if (version !== generation) return;
    items.value = result.items;
    product.value = result.product;
    weather.value = result.weather;
    selectedIds.value = selectedIds.value.filter((id) =>
      items.value.some((item) => item.itemId === id),
    );
    // Select the store item once on entry or when a different product is opened.
    // Later filter changes preserve the user's choice to remove or replace it.
    if (product.value && productId.value !== loadedProductId) {
      selectedIds.value = selectedIds.value.filter(
        (id) => !piecesConflict(items.value.find((item) => item.itemId === id), product.value),
      );
      selectedProduct.value = true;
    } else if (!product.value) {
      selectedProduct.value = false;
    }
    loadedProductId = productId.value;
    await assess();
  } catch (e) {
    if (version === generation) error.value = e.message;
  } finally {
    if (version === generation) busy.value = false;
  }
}
function piecesConflict(other, piece) {
  return other?.category === piece.category ||
    (piece.category === "Dresses" && ["Tops", "Bottoms"].includes(other?.category)) ||
    (["Tops", "Bottoms"].includes(piece.category) && other?.category === "Dresses");
}
function togglePiece(piece) {
  if (saving.value || busy.value) return;
  error.value = "";
  notice.value = "";
  if (isSelected(piece)) {
    if (piece.source === "store") selectedProduct.value = false;
    else
      selectedIds.value = selectedIds.value.filter((id) => id !== piece.itemId);
    return;
  }
  // Choosing another item in the same slot replaces only that earlier choice.
  const conflict = (other) => piecesConflict(other, piece);
  selectedIds.value = selectedIds.value.filter(
    (id) => !conflict(items.value.find((item) => item.itemId === id)),
  );
  if (selectedProduct.value && product.value && conflict(product.value))
    selectedProduct.value = false;
  if (piece.source === "store") selectedProduct.value = true;
  else selectedIds.value = [...selectedIds.value, piece.itemId];
}
async function save() {
  if (!chosenCount.value) {
    error.value = "Use at least one piece before saving an outfit.";
    return;
  }
  if (!name.value.trim()) {
    error.value = "Enter an outfit name before saving.";
    return;
  }
  if (!canSave.value) {
    error.value =
      "Choose shoes and either a dress or a top and bottom before saving.";
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    await wardrobeApi(
      "/outfits",
      send("POST", {
        name: name.value,
        occasion: occasion.value,
        date: date.value,
        itemIds: [...selectedIds.value],
        ...(selectedProduct.value ? { productId: productId.value, productColour: productColour.value } : {}),
      }),
    );
    await router.push({ name: "saved-outfits" });
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
onMounted(async () => {
  initialized.value = true;
  await generate();
  loading.value = false;
});
watch([occasion, date, style, productId, productColour], (values, previous) => {
  if (values[3] !== previous[3]) selectedProduct.value = false;
  if (initialized.value) generate();
});
watch(
  [selectedIds, selectedProduct],
  () => {
    if (initialized.value && !busy.value) assess();
  },
  { deep: true },
);
</script>
<template>
  <section class="wd-page wd-studio">
    <header class="wd-planner-heading">
      <p class="wd-eyebrow">YOUR PERSONAL STYLING STUDIO</p>
      <h1>Build a look that feels like you</h1>
      <p>Choose your pieces. See your outfit come together.</p>
    </header>

    <div class="wd-studio-toolbar">
      <label class="wd-studio-field">
        <CommunityIcon name="calendar" :size="21" />
        <span id="wd-occasion-label">Occasion</span>
        <select aria-labelledby="wd-occasion-label" v-model="occasion" :disabled="saving">
          <option v-for="o in occasions" :key="o">{{ o }}</option>
        </select>
      </label>
      <label class="wd-studio-field">
        <CommunityIcon name="calendar" :size="21" />
        <span id="wd-date-label">Date</span>
        <input aria-labelledby="wd-date-label" v-model="date" :min="today()" type="date" :disabled="saving" />
      </label>
      <label class="wd-studio-field">
        <CommunityIcon name="hanger" :size="23" />
        <span id="wd-style-label">Style</span>
        <select aria-labelledby="wd-style-label" v-model="style" :disabled="saving">
          <option value="">My preferences</option>
          <option v-for="s in styles" :key="s">{{ s }}</option>
        </select>
      </label>
      <section class="wd-studio-forecast" aria-label="Singapore weather forecast">
        <div class="wd-studio-weather" aria-live="polite">
          <span class="wd-studio-weather-icon" aria-hidden="true">{{ weatherEmoji(weather) }}</span>
          <div>
            <strong>Singapore</strong>
            <small>{{ busy ? "Checking the forecast…" : weather?.available
              ? `${Math.round(weather.temperature)}°C · ${weather.condition}`
              : "Forecast unavailable" }}</small>
          </div>
          <span v-if="weather?.available" class="wd-studio-rain">{{ weather.rainChance == null
            ? "Rain chance unavailable" : `${weather.rainChance}% chance of rain` }}</span>
        </div>
        <details v-if="weather?.available && weather.advice?.length" class="wd-studio-weather-tips">
          <summary>Weather tips</summary>
          <p v-for="advice in weather.advice" :key="advice">{{ advice }}</p>
        </details>
      </section>
    </div>

    <p v-if="error" role="alert" class="community-error">
      {{ error }}
      <button class="wd-link" :disabled="saving" @click="generate">Try again</button>
    </p>
    <p v-if="weather && !weather.available" class="wd-weather-note">{{ weather.message }}</p>
    <p v-if="loading || busy" role="status" class="wd-studio-loading">Finding recommendations for your wardrobe…</p>
    <template v-else>
      <p v-if="product" class="wd-product-note">
        Styling with <strong>{{ product.name }}</strong> · Store pick · S${{ Number(product.price).toFixed(2) }}
        <RouterLink class="wd-remove-store" :to="{ name: 'outfit-match' }"><span aria-hidden="true">×</span> Remove store suggestion</RouterLink>
      </p>
      <div v-if="!candidates.length" class="wd-empty">
        <span>✿</span>
        <h2>Your next outfit starts with a few pieces</h2>
        <p>Add tops, bottoms or dresses and shoes to start building your outfit.</p>
        <RouterLink class="community-btn" :to="{ name: 'wardrobe-new' }">Add clothing</RouterLink>
      </div>
      <div v-else class="wd-planner-layout">
        <section class="wd-studio-picker" aria-labelledby="wd-picker-title">
          <header class="wd-picker-heading">
            <p class="wd-eyebrow">FROM YOUR WARDROBE</p>
            <h2 id="wd-picker-title">Choose your pieces</h2>
            <p>One piece per category. A dress replaces a top and bottom. Choosing another piece in a category replaces your earlier choice.</p>
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
          <div v-if="availablePieces.length" class="wd-picker-grid">
            <ClothingCard v-for="(piece, index) in availablePieces" :key="pieceKey(piece)" :item="piece" :index="index">
              <template #overlay>
                <span v-if="piece.recommendation?.label" class="wd-recommended-tag wd-card-recommended"
                  :class="{ 'wd-style-match-tag': piece.recommendation?.kind === 'style' }">{{ piece.recommendation.label }}</span>
              </template>
              <p class="wd-item-style">{{ piece.style?.join(" · ") || "Style not tagged" }}</p>
              <p class="wd-source-caption">{{ piece.source === 'store' ? `Store pick · S$${Number(piece.price).toFixed(2)}` : 'In your wardrobe' }}</p>
              <button type="button" class="wd-use-piece" :aria-label="`Use this piece: ${piece.name}`" :disabled="saving" @click="togglePiece(piece)">
                <span aria-hidden="true">＋</span>Use this piece
              </button>
            </ClothingCard>
          </div>
          <div v-else class="wd-studio-picker-empty">
            <CommunityIcon name="hanger" :size="32" />
            <h3>{{ search || category ? 'No matching pieces' : 'Your pieces are on the board' }}</h3>
            <p>{{ search || category ? 'Try a different search or category.' : 'Remove a piece from your outfit board to choose it again.' }}</p>
            <button v-if="search || category" type="button" class="wd-link" @click="search = ''; category = ''">Clear filters</button>
          </div>
        </section>

        <section class="wd-studio-board" aria-labelledby="wd-board-title">
          <header class="wd-studio-board-heading">
            <div><p class="wd-eyebrow">MAKE IT YOURS</p><h2 id="wd-board-title">Your outfit board</h2></div>
            <span class="wd-studio-count" aria-live="polite">{{ chosenCount }} {{ chosenCount === 1 ? 'piece' : 'pieces' }}</span>
          </header>
          <p class="wd-studio-board-caption">Your selected photos, together.</p>
          <div class="wd-studio-board-columns">
            <div v-for="group in boardGroups" :key="group.key" :class="`wd-studio-board-${group.key}`">
              <article v-for="slot in group.slots" :key="slot.category" class="wd-board-slot"
                :class="{ 'is-empty': !slot.piece, 'is-dress': slot.category === 'Dresses' }"
                :aria-label="`${slot.label}${slot.piece ? ': ' + slot.piece.name : ': not selected'}`">
                <header class="wd-board-slot-heading">
                  <span class="wd-board-slot-label">{{ slot.label }}<small v-if="slot.optional"> · Optional</small></span>
                  <h3 v-if="slot.piece">{{ slot.piece.name }}</h3>
                </header>
                <template v-if="slot.piece">
                  <div class="wd-board-photo">
                    <img v-if="slot.piece.imageURL && !failedPhotos[photoKey(slot.piece)]" :src="slot.piece.imageURL"
                      :alt="slot.piece.name" @error="failedPhotos[photoKey(slot.piece)] = true" />
                    <span v-else class="wd-board-photo-fallback"><CommunityIcon name="hanger" :size="28" />Photo unavailable</span>
                    <button type="button" class="wd-board-remove" :aria-label="`Remove ${slot.piece.name} from outfit`"
                      :disabled="saving" @click="togglePiece(slot.piece)"><span aria-hidden="true">×</span></button>
                  </div>
                  <span v-if="slot.category === 'Dresses'" class="wd-board-dress-note">Covers top + bottom</span>
                  <p v-if="slot.piece.source === 'store'" class="wd-board-store-note">Store pick · S${{ Number(slot.piece.price).toFixed(2) }}</p>
                </template>
                <div v-else class="wd-board-placeholder">
                  <CommunityIcon :name="slot.category === 'Accessories' ? 'tag' : 'hanger'" :size="26" />
                  <span>{{ slot.optional ? 'Add if you like' : `Choose ${slot.label === 'Shoes' ? 'shoes' : 'a ' + slot.label.toLowerCase()}` }}</span>
                </div>
              </article>
            </div>
          </div>
          <button type="button" class="wd-studio-reset" :disabled="!chosenCount || saving" @click="resetOutfit">
            <span aria-hidden="true">↺</span> Reset outfit
          </button>
        </section>

        <aside class="wd-plan-summary">
          <p class="wd-eyebrow">YOUR SELECTION</p>
          <div class="wd-summary-title">
            <h2>
              {{ occasion }} {{ selection?.complete ? "ready" : "outfit" }}
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
              <strong>Selected outfit match</strong
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
              {{ chosenCount }}
              {{ chosenCount === 1 ? "piece" : "pieces" }} chosen by you. Score
              and progress reflect these pieces only.
              <span v-if="selection?.scoreDetails.provisional">This is a provisional score for one piece.</span>
            </p>
          </div>
          <ul v-if="selection?.comments?.length" class="wd-reasons">
            <li v-for="comment in selection.comments" :key="comment.text"
              :class="comment.kind === 'warning' ? 'wd-match-warning' : 'wd-match-tip'">
              {{ comment.text }}
            </li>
          </ul>
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
                ? "Saving…"
                : !chosenCount
                  ? "Choose pieces to save"
                  : !selection?.complete
                    ? "Complete your outfit to save"
                    : "♡ Save outfit"
            }}
          </button>
          <p v-if="notice" role="status" class="wd-success">{{ notice }}</p>
          <section
            class="wd-score-guide"
            aria-label="Matching score explanation"
          >
            <h3>How your match score works</h3>
            <p class="wd-score-formula">
              Occasion 60 + Colour coordination 25 + Weather 15
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
            <p>Occasion points per piece: Style 30 + Category 15 + Colour 10 + Material 5.
              Each property earns partial points independently. The outfit uses their average.</p>
            <details v-if="selection" class="wd-item-score-details">
              <summary>Points for each selected piece</summary>
              <section v-for="item in selection.scoreDetails.itemDetails" :key="item.itemId || item.name">
                <strong>{{ item.name }} · {{ item.earned }} / 60 occasion points</strong>
                <div v-for="part in item.components" :key="part.label" class="wd-score-detail-row">
                  <span>{{ part.label }}</span><span>{{ part.available ? `${part.earned} / ${part.weight}` : `Unknown · 0 / ${part.weight}` }}</span>
                </div>
              </section>
              <p>Colour pairs: neutral 100%, same or complementary 67%, other known pairs 20%.
                Weather checks earn full, half or zero points for temperature and rain. Unknown checks are left out.</p>
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
              >Occasion and weather estimates use category, colour, material and
              style. These are simple rules, not a guarantee of
              suitability.</small
            >
          </section>
        </aside>
      </div>
    </template>
    <p class="wd-attribution">
      Weather data by
      <a href="https://open-meteo.com/" target="_blank" rel="noopener"
        >Open-Meteo</a
      >. Daily forecast for Singapore; actual conditions may differ.
    </p>
  </section>
</template>
