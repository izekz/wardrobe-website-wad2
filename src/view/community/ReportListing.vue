<script>
import { createReport } from '../../services/reportService'

export default {
  data() {
    return {
      reason: '',
      explanation: '',
      saving: false,
      submitted: false,
      error: '',
      reasons: [
        'Misleading information',
        'Inappropriate content',
        'Suspected scam',
        'Other',
      ],
    }
  },

  methods: {
    async submitReport() {
      this.saving = true
      this.error = ''

      try {
        await createReport({
          listingId: this.$route.params.listingId,
          reason: this.reason,
          explanation: this.explanation,
        })

        this.submitted = true
      } catch (error) {
        this.error = error.message
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<template>
  <section class="report-page">
    <h1>Report a listing</h1>

    <RouterLink
      :to="{
        name: 'community-listing',
        params: { listingId: $route.params.listingId },
      }"
    >
      ← Back to listing
    </RouterLink>

    <div v-if="submitted" class="success-message" role="status">
        <h2>Report submitted</h2>
        <p>Your report has been submitted for review.</p>
    </div>

    <form v-else @submit.prevent="submitReport">
      <label for="report-reason">Reason</label>

      <select
        id="report-reason"
        v-model="reason"
        required
        :disabled="saving"
      >
        <option disabled value="">Choose a reason</option>

        <option
          v-for="item in reasons"
          :key="item"
          :value="item"
        >
          {{ item }}
        </option>
      </select>

      <label for="report-explanation">Explanation</label>

      <textarea
        id="report-explanation"
        v-model="explanation"
        maxlength="1000"
        rows="5"
        :required="reason === 'Other'"
        :disabled="saving"
      ></textarea>

      <p v-if="error" class="error-message" role="alert">
        {{ error }}
      </p>

      <button type="submit" :disabled="saving">
        {{ saving ? 'Submitting…' : 'Submit report' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.report-page {
  max-width: 600px;
  padding: 24px 0;
  color: #44213f;
}

h1 {
  font-family: Georgia, serif;
}

a {
  color: #683760;
}

form {
  margin-top: 24px;
}

label {
  display: block;
  margin: 16px 0 8px;
  font-weight: bold;
}

select,
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #ddd5df;
  border-radius: 8px;
}

button {
  margin-top: 16px;
  padding: 10px 18px;
  background: #683760;
  color: white;
  border: none;
  border-radius: 8px;
}

button:disabled {
  opacity: 0.6;
}

.error-message {
  color: #a0273f;
}

.success-message {
  margin-top: 24px;
  padding: 24px;
  background: #f7f1fa;
  border: 1px solid #e5dfe3;
  border-radius: 12px;
  text-align: center;
}

.success-message h2 {
  color: #683760;
  font-size: 24px;
  margin: 0 0 8px;
}

.success-message p {
  color: #6d6870;
  margin: 0;
}
</style>