<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { createReport } from '../services/reportService'

const props = defineProps({
  listingId: {
    type: String,
    required: true,
  },
  listingName: {
    type: String,
    required: true,
  },
  targetType: {
    type: String,
    required: true,
    validator: value => ['listing', 'request', 'video'].includes(value),
  },
})

const emit = defineEmits(['close', 'submitted'])

const dialog = ref(null)
const reason = ref('')
const explanation = ref('')
const busy = ref(false)
const error = ref('')
const submitted = ref(false)
const alreadyReported = ref(false)
let disposed = false

const reasons = [
  'Misleading information',
  'Inappropriate content',
  'Suspected scam',
  'Other',
]

onMounted(() => {
  dialog.value.showModal()
})

onBeforeUnmount(() => {
  disposed = true
  dialog.value?.close()
})

watch(
  () => [props.listingId, props.targetType],
  () => {
    dialog.value?.close()
    emit('close')
  }
)

function close() {
  if (!busy.value) emit('close')
}

async function submit() {
  if (busy.value || submitted.value) return

  error.value = ''

  if (!reason.value) {
    error.value = 'Please select a reason.'
    return
  }

  if (reason.value === 'Other' && !explanation.value.trim()) {
    error.value = 'Please explain your report.'
    return
  }

  busy.value = true

  try {
    await createReport({
      listingId: props.listingId,
      targetType: props.targetType,
      reason: reason.value,
      explanation: explanation.value.trim(),
    })

    if (disposed) return

    submitted.value = true
    emit('submitted')
  } catch (err) {
    if (disposed) return

    if (err.status === 409) {
      alreadyReported.value = true
      submitted.value = true
    } else {
      error.value = err.message || 'Unable to submit your report.'
    }
  } finally {
    if (!disposed) busy.value = false
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="report-dialog"
    aria-labelledby="report-title"
    :aria-describedby="submitted ? 'report-confirmation' : 'report-description'"
    @cancel.prevent="close"
  >
    <header class="dialog-header">
      <h2 id="report-title">
        {{
          alreadyReported
            ? 'Already reported'
            : submitted
              ? 'Report submitted'
              : 'Report post'
        }}
      </h2>

      <button
        type="button"
        class="close-button"
        aria-label="Close report form"
        :disabled="busy"
        @click="close"
      >
        ×
      </button>
    </header>

    <template v-if="submitted">
      <p id="report-confirmation" role="status">
        {{
          alreadyReported
            ? 'You have already reported this post. No duplicate report was created.'
            : 'Thank you. Your report has been submitted for administrator review.'
        }}
      </p>

      <div class="dialog-actions">
        <button type="button" class="primary-button" @click="close">
          Done
        </button>
      </div>
    </template>

    <form v-else :aria-busy="busy" @submit.prevent="submit">
      <p id="report-description" class="description">
        Reporting: <strong>{{ listingName }}</strong>
      </p>

      <fieldset :disabled="busy">
        <legend>Why are you reporting this post?</legend>

        <label
          v-for="option in reasons"
          :key="option"
          class="reason-option"
        >
          <input
            v-model="reason"
            type="radio"
            name="report-reason"
            :value="option"
            required
          />
          <span>{{ option }}</span>
        </label>

        <label for="report-details" class="details-label">
          Additional details
          {{ reason === 'Other' ? '(required)' : '(optional)' }}
        </label>

        <textarea
          id="report-details"
          v-model="explanation"
          rows="4"
          maxlength="1000"
          :required="reason === 'Other'"
          placeholder="Tell us what happened."
          aria-describedby="report-details-count"
        ></textarea>

        <p id="report-details-count" class="character-count">
          {{ explanation.length }}/1,000
        </p>
      </fieldset>

      <p v-if="error" class="error-message" role="alert">
        {{ error }}
      </p>

      <div class="dialog-actions">
        <button
          type="button"
          class="secondary-button"
          :disabled="busy"
          @click="close"
        >
          Cancel
        </button>

        <button
          type="submit"
          class="primary-button"
          :disabled="busy"
        >
          {{ busy ? 'Submitting…' : 'Submit report' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.report-dialog {
  width: min(480px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  box-sizing: border-box;
  margin: auto;
  padding: 28px;
  overflow-y: auto;
  border: 1px solid #e5dfe3;
  border-radius: 16px;
  background: #fffdfa;
  color: #44213f;
  box-shadow: 0 16px 60px rgb(68 33 63 / 18%);
}

.report-dialog::backdrop {
  background: rgb(30 20 30 / 45%);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

h2 {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 28px;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #f3edf5;
  color: #683760;
  font-size: 26px;
  cursor: pointer;
}

.description {
  margin: 0 0 24px;
  color: #6d6870;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

fieldset {
  min-width: 0;
  padding: 0;
  margin: 0;
  border: none;
}

legend {
  margin-bottom: 12px;
  font-weight: bold;
}

.reason-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid #eee5ec;
  cursor: pointer;
}

.reason-option input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: #683760;
}

.details-label {
  display: block;
  margin: 24px 0 8px;
  font-weight: bold;
}

textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #ddd5df;
  border-radius: 8px;
  background: white;
  color: #44213f;
  font: inherit;
  resize: vertical;
}

.character-count {
  margin: 6px 0 0;
  color: #6d6870;
  font-size: 12px;
  text-align: right;
}

.dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.primary-button,
.secondary-button {
  padding: 10px 18px;
  border: 1px solid #683760;
  border-radius: 8px;
  font: inherit;
  cursor: pointer;
}

.primary-button {
  background: #683760;
  color: white;
}

.primary-button:hover:not(:disabled) {
  background: #542c4e;
}

.secondary-button {
  background: white;
  color: #683760;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid #683760;
  outline-offset: 3px;
}

.error-message {
  color: #a0273f;
  line-height: 1.5;
}
</style>