<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../../assets/styles/wardrobe.css";
import ClothingCard from "../../components/ClothingCard.vue";
import {
  wardrobeApi,
  send,
  today,
  occasions,
  styles,
  weatherEmoji,
} from "../../services/wardrobeService";
const route = useRoute(),
  router = useRouter();
const items = ref([]),
  plans = ref([]),
  eligibleIds = ref([]),
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
const recommendedIds = computed(() => new Set(eligibleIds.value));
const featuredIds = computed(
  () =>
    new Set((plans.value[0]?.pieces || []).map((p) => p.itemId || p.productId)),
);
const candidates = computed(() =>
  [...items.value, ...(product.value ? [product.value] : [])].sort((a, b) => {
    const aId = a.itemId || a.productId,
      bId = b.itemId || b.productId;
    return (
      Number(recommendedIds.value.has(bId)) -
        Number(recommendedIds.value.has(aId)) ||
      Number(recommendedIds.value.has(bId) && featuredIds.value.has(bId)) -
        Number(recommendedIds.value.has(aId) && featuredIds.value.has(aId))
    );
  }),
);
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
        ...(selectedProduct.value ? { productId: productId.value } : {}),
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
      }),
    );
    if (version !== generation) return;
    items.value = result.items;
    eligibleIds.value = result.recommendedIds || [];
    plans.value = result.plans;
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
        ...(selectedProduct.value ? { productId: productId.value } : {}),
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
watch([occasion, date, style, productId], (values, previous) => {
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
  <section class="wd-page">
    <header class="wd-planner-heading">
      <p class="wd-eyebrow">A LITTLE INSPIRATION, ALREADY YOURS</p>
      <h1>A little outfit inspiration</h1>
      <p>Bring your wardrobe and your next occasion together.</p>
    </header>
    <div class="wd-planner-controls">
      <label
        >Occasion<select v-model="occasion" :disabled="saving">
          <option v-for="o in occasions" :key="o">{{ o }}</option>
        </select></label
      >
      <label
        >Date<input
          v-model="date"
          :min="today()"
          type="date"
          :disabled="saving"
      /></label>
      <label
        >Style<select v-model="style" :disabled="saving">
          <option value="">My preferences</option>
          <option v-for="s in styles" :key="s">{{ s }}</option>
        </select></label
      >

    </div>
    <section class="wd-planner-weather" aria-label="Singapore weather forecast">
      <div class="wd-weather" aria-live="polite">
        <span aria-hidden="true">{{ weatherEmoji(weather) }}</span>
        <div>
          <strong>Singapore</strong
          ><small>{{
            busy
              ? "Checking the forecast…"
              : weather?.available
                ? `${Math.round(weather.temperature)}°C high · ${weather.condition}`
                : "Forecast unavailable"
          }}</small>
        </div>
      </div>
      <div v-if="weather?.available" class="wd-weather-advice">
        <strong class="wd-rain-heading">{{
          weather.rainChance === null
            ? "Rain chance unavailable"
            : `${weather.rainChance}% chance of rain`
        }}</strong
        ><small>Singapore · Forecast for {{ date }}</small>
        <div class="wd-weather-tips">
          <p v-for="advice in weather.advice" :key="advice">{{ advice }}</p>
        </div>
      </div>
    </section>
    <p v-if="error" role="alert" class="community-error">
      {{ error }}
      <button class="wd-link" :disabled="saving" @click="generate">
        Try again
      </button>
    </p>
    <p v-if="weather && !weather.available" class="wd-weather-note">
      {{ weather.message }}
    </p>
    <p v-if="loading || busy" role="status">
      Finding recommendations for your wardrobe…
    </p>
    <template v-else>
      <p v-if="product" class="wd-product-note">
        Styling with <strong>{{ product.name }}</strong> · Store pick · S${{
          Number(product.price).toFixed(2)
        }}
        <RouterLink
          class="wd-remove-store"
          :to="{ name: 'outfit-match' }"
        ><span aria-hidden="true">×</span> Remove store suggestion</RouterLink>
      </p>
      <div v-if="!candidates.length" class="wd-empty">
        <span>✿</span>
        <h2>Your next outfit starts with a few pieces</h2>
        <p>Add tops, bottoms or dresses and shoes to see recommendations.</p>
        <RouterLink class="community-btn" :to="{ name: 'wardrobe-new' }"
          >Add clothing</RouterLink
        >
      </div>
      <div v-else class="wd-planner-layout">
        <div class="wd-outfit-board wd-tone-1 wd-picker">
          <header class="wd-picker-heading">
            <h2>Choose your pieces</h2>
            <p>
              One piece per category. A dress replaces a top and bottom. Choosing
              another piece in a category replaces your earlier choice.
            </p>
          </header>
          <div class="wd-picker-grid">
            <ClothingCard
              v-for="(piece, index) in candidates"
              :key="piece.itemId || piece.productId"
              :item="piece"
              :index="index"
              :class="{ 'wd-piece-chosen': isSelected(piece) }"
            >
              <template #overlay
                ><span
                  v-if="recommendedIds.has(piece.itemId || piece.productId)"
                  class="wd-recommended-tag wd-card-recommended"
                  >Recommended!</span
                ></template
              >
              <p class="wd-item-style">
                {{ piece.style?.join(" · ") || "Style not tagged" }}
              </p>
              <p class="wd-source-caption">
                {{
                  piece.source === "store"
                    ? `Store pick · S$${Number(piece.price).toFixed(2)}`
                    : "In your wardrobe"
                }}
              </p>
              <button
                type="button"
                class="wd-use-piece"
                :class="{ 'is-selected': isSelected(piece) }"
                :aria-pressed="isSelected(piece)"
                :disabled="saving"
                @click="togglePiece(piece)"
              >
                <span aria-hidden="true">{{
                  isSelected(piece) ? "−" : "＋"
                }}</span
                >{{
                  isSelected(piece) ? "Remove this piece" : "Use this piece"
                }}
              </button>
            </ClothingCard>
          </div>
        </div>
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
            </p>
          </div>
          <ul v-if="selection" class="wd-reasons">
            <li v-for="reason in selection.reasons" :key="reason">
              {{ reason }}
            </li>
            <li
              v-for="tip in selection.suggestions"
              :key="tip"
              class="wd-match-tip"
            >
              {{ tip }}
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
              Occasion 40 + Style 25 + Colour 20 + Weather 15
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
                    : "Not available"
                }}</strong>
              </div>
            </div>
            <p>
              Score = earned points ÷ available points × 100. Basic-piece
              completeness is shown separately. Unavailable checks are left out.
              Rounded to a number from 0 to 100.
            </p>
            <p class="wd-score-key">
              <span class="good">75–100: Good</span
              ><span class="fair">50–74: Room to improve</span
              ><span class="poor">0–49: Not ideal</span>
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
