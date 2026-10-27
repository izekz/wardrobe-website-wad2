<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import "../../assets/styles/wardrobe.css";
import {
  wardrobeApi,
  send,
  readPhoto,
  categories,
  colours,
  styles,
  categoryName,
} from "../../services/wardrobeService";
const route = useRoute(),
  router = useRouter(),
  editing = !!route.params.id,
  loading = ref(editing),
  busy = ref(false),
  error = ref(""),
  preview = ref(""),
  photo = ref(undefined);
const form = ref({
  name: "",
  category: "Tops",
  colour: "White",
  material: "",
  style: [],
});
let alive = true,
  photoVersion = 0;
onBeforeUnmount(() => {
  alive = false;
});
onMounted(async () => {
  if (!editing) return;
  try {
    const item = (await wardrobeApi("/items/" + route.params.id)).item;
    if (!alive) return;
    for (const key of Object.keys(form.value)) form.value[key] = item[key];
    preview.value = item.imageURL;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
async function choosePhoto(event) {
  const version = ++photoVersion;
  try {
    const value = await readPhoto(event.target.files[0]);
    if (version !== photoVersion || !alive) return;
    photo.value = value;
    preview.value = value;
    error.value = "";
  } catch (e) {
    error.value = e.message;
    event.target.value = "";
  }
}
async function submit() {
  if (busy.value) return;
  error.value = "";
  if (!editing && !photo.value) {
    error.value = "Choose a clothing photo.";
    return;
  }
  if (!form.value.style.length) {
    error.value = "Choose at least one style.";
    return;
  }
  busy.value = true;
  try {
    await wardrobeApi(
      editing ? "/items/" + route.params.id : "/items",
      send(editing ? "PUT" : "POST", {
        ...form.value,
        ...(photo.value ? { photo: photo.value } : {}),
      }),
    );
    await router.push({ name: "wardrobe" });
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="wd-page">
    <RouterLink class="wd-back" :to="{ name: 'wardrobe' }"
      >← My clothing</RouterLink
    >
    <header class="wd-heading">
      <div>
        <h1>
          {{
            editing ? "A fresh look at your piece" : "Make room for a favourite"
          }}
        </h1>
        <p>A few details help us find combinations that feel like you.</p>
      </div>
    </header>
    <p v-if="loading" role="status">Loading your piece…</p>
    <form v-else class="wd-form-layout" @submit.prevent="submit">
      <div class="wd-upload wd-tone-1">
        <img v-if="preview" :src="preview" alt="Your selected clothing photo" />
        <div v-else class="wd-upload-prompt">
          <span>＋</span>
          <h2>Your piece, in focus</h2>
          <p>A clear photo works best.</p>
        </div>
        <p class="wd-photo-label">
          Item image
          <span v-if="!editing" class="wd-required" aria-hidden="true">*</span
          ><small v-else>Replace only if needed</small>
        </p>
        <label class="community-btn community-btn-outline"
          >{{ preview ? "Change photo" : "Choose a photo"
          }}<input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            :disabled="busy"
            @change="choosePhoto" /></label
        ><small>JPG, PNG or WebP · up to 5 MB</small>
      </div>
      <div class="wd-form-panel">
        <p v-if="error" role="alert" class="community-error">{{ error }}</p>
        <p class="wd-required-note">
          Fields marked <span class="wd-required">*</span> are required.
        </p>
        <fieldset :disabled="busy">
          <div class="wd-form-fields">
            <label
              ><span class="wd-field-label"
                >Item name
                <span class="wd-required" aria-hidden="true">*</span></span
              ><input
                v-model.trim="form.name"
                required
                maxlength="80"
                placeholder="e.g. White linen shirt" /></label
            ><label
              ><span class="wd-field-label"
                >Category
                <span class="wd-required" aria-hidden="true">*</span></span
              ><select v-model="form.category" required>
                <option v-for="c in categories" :value="c" :key="c">
                  {{ categoryName(c) }}
                </option>
              </select></label
            ><label
              ><span class="wd-field-label"
                >Colour
                <span class="wd-required" aria-hidden="true">*</span></span
              ><select v-model="form.colour" required>
                <option v-for="c in colours" :key="c">{{ c }}</option>
              </select></label
            ><label
              ><span class="wd-field-label"
                >Material
                <span class="wd-required" aria-hidden="true">*</span></span
              ><input
                v-model.trim="form.material"
                required
                maxlength="50"
                placeholder="e.g. Cotton, linen, denim"
            /></label>
          </div>
          <fieldset class="wd-tag-field">
            <legend>
              Style <span class="wd-required" aria-hidden="true">*</span>
              <small>Choose at least one</small>
            </legend>
            <div class="wd-check-tags">
              <label
                v-for="value in styles"
                :key="value"
                :class="{ checked: form.style.includes(value) }"
                ><input type="checkbox" v-model="form.style" :value="value" />{{
                  value
                }}</label
              >
            </div>
          </fieldset>
          <div class="wd-form-footer">
            <RouterLink :to="{ name: 'wardrobe' }">Cancel</RouterLink
            ><button class="community-btn" :disabled="busy">
              {{
                busy
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Add to my wardrobe"
              }}
            </button>
          </div>
        </fieldset>
      </div>
    </form>
  </section>
</template>
