<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
const props = defineProps({ titleId: String, busy: Boolean, wide: Boolean });
const emit = defineEmits(["close"]);
const panel = ref(null);
let previous;
const focusable = () =>
  [
    ...panel.value.querySelectorAll(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex="0"]',
    ),
  ].filter((el) => el.offsetParent !== null);
function close() {
  if (!props.busy) emit("close");
}
function keyboard(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
  if (event.key !== "Tab") return;
  const elements = focusable(),
    first = elements[0],
    last = elements.at(-1);
  if (!first) {
    event.preventDefault();
    panel.value.focus();
    return;
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === panel.value)
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || document.activeElement === panel.value)
  ) {
    event.preventDefault();
    first.focus();
  }
}
onMounted(async () => {
  previous = document.activeElement;
  await nextTick();
  (focusable()[0] || panel.value).focus();
  document.addEventListener("keydown", keyboard);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", keyboard);
  previous?.focus();
});
</script>
<template>
  <Teleport to="body"
    ><div class="wd-modal-backdrop" @click.self="close">
      <section
        ref="panel"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        class="wd-modal"
        :class="{ 'wd-modal-wide': wide }"
      >
        <slot />
      </section></div
  ></Teleport>
</template>
