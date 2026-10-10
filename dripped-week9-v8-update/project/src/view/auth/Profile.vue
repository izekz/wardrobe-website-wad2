<script>
import CommunityHistory from '../../components/CommunityHistory.vue'
import { authState } from '../../services/authService'
import { getSurvey, saveSurvey } from '../../services/surveyService'

export default {
  components: { CommunityHistory },
  data() {
    return {
      styles: [
        'Minimalist', 'Casual', 'Vintage', 'Streetwear',
        'Y2K', 'Formal', 'Preppy',
      ],
      occasions: [
        'University', 'Presentation', 'Date',
        'Internship / work', 'Casual outings', 'Formal events',
      ],

      form: {
        preferredStyles: [],
        activities: [],
        budget: 40,
      },

      loading: true,
      saving: false,
      error: '',
      message: '',
    }
  },

  computed: {
    user() {
      return authState.user
    },

    initial() {
      return (this.user?.name || 'U').charAt(0).toUpperCase()
    },

    accountType() {
      const labels = {
        consumer: 'Customer',
        business: 'Business',
        admin: 'Administrator',
      }

      return labels[this.user?.role] || 'Account'
    },
  },

  async mounted() {
    await this.loadPreferences()
  },

  methods: {
    async loadPreferences() {
      this.loading = true
      this.error = ''
      this.message = ''

      try {
        const { survey } = await getSurvey()

        this.form = {
          preferredStyles: [...survey.preferredStyles],
          activities: [...survey.activities],
          budget: survey.budget,
        }
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    toggleStyle(style) {
      this.message = ''
      this.error = ''

      if (this.form.preferredStyles.includes(style)) {
        this.form.preferredStyles =
          this.form.preferredStyles.filter(item => item !== style)
      } else if (this.form.preferredStyles.length < 2) {
        this.form.preferredStyles.push(style)
      } else {
        this.error = 'Choose up to two styles.'
      }
    },

    toggleOccasion(occasion) {
      this.message = ''
      this.error = ''

      if (this.form.activities.includes(occasion)) {
        this.form.activities =
          this.form.activities.filter(item => item !== occasion)
      } else {
        this.form.activities.push(occasion)
      }
    },

    async savePreferences() {
      this.error = ''
      this.message = ''

      if (!this.form.preferredStyles.length) {
        this.error = 'Choose at least one style.'
        return
      }

      if (!this.form.activities.length) {
        this.error = 'Choose at least one occasion.'
        return
      }

      this.saving = true

      try {
        const result = await saveSurvey(this.form)
        authState.user = result.user
        this.message = 'Your preferences have been saved.'
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
  <section class="profile-page">
    <header class="page-heading">
      <h1>Your profile &amp; preferences</h1>
      <p>Keep your details and style up to date.</p>
    </header>

    <div class="profile-layout">
      <!-- Left column -->
      <aside class="profile-sidebar">
        <div class="avatar">{{ initial }}</div>
        <h2>{{ user?.name }}</h2>
        <p>{{ accountType }}</p>

        <nav aria-label="Profile sections">
          <a href="#profile-details">Profile</a>
          <a v-if="user?.role === 'consumer'" href="#community-history">Listings &amp; request history</a>
          <RouterLink v-if="user?.role === 'consumer'" :to="{ name: 'community-my-listings' }">Manage my listings</RouterLink>
          <a
            v-if="user?.role === 'consumer'"
            href="#style-preferences"
          >
            Style preferences
          </a>
        </nav>
      </aside>

      <!-- Centre column -->
      <div class="profile-content">
        <section id="profile-details" class="profile-card">
          <h2>Profile details</h2>

          <div class="details-layout">
            <div class="avatar avatar-large">{{ initial }}</div>

            <div class="account-details">
              <label for="profile-name">Full name</label>
              <input
                id="profile-name"
                :value="user?.name"
                readonly
              />

              <label for="profile-email">Email address</label>
              <input
                id="profile-email"
                type="email"
                :value="user?.email"
                readonly
              />

              <p class="hint">
                Account details are currently read-only.
              </p>
            </div>
          </div>
        </section>

        <form
          v-if="user?.role === 'consumer'"
          id="style-preferences"
          class="profile-card"
          @submit.prevent="savePreferences"
        >
          <h2>Style preferences</h2>

          <p v-if="loading" role="status">
            Loading your preferences…
          </p>

          <fieldset :disabled="loading || saving">
            <legend>Your style</legend>
            <p class="hint">Select up to two styles that best match you.</p>

            <div class="option-list">
              <button
                v-for="style in styles"
                :key="style"
                type="button"
                class="option-button"
                :class="{ selected: form.preferredStyles.includes(style) }"
                :aria-pressed="form.preferredStyles.includes(style)"
                @click="toggleStyle(style)"
              >
                {{ style }}
              </button>
            </div>
          </fieldset>

          <fieldset :disabled="loading || saving">
            <legend>Usual occasions</legend>
            <p class="hint">Choose the occasions you usually shop for.</p>

            <div class="option-list">
              <button
                v-for="occasion in occasions"
                :key="occasion"
                type="button"
                class="option-button"
                :class="{ selected: form.activities.includes(occasion) }"
                :aria-pressed="form.activities.includes(occasion)"
                @click="toggleOccasion(occasion)"
              >
                {{ occasion }}
              </button>
            </div>
          </fieldset>

          <div class="budget-section">
            <label for="profile-budget">Budget per item</label>
            <p class="hint">Set a budget that suits you.</p>

            <div class="budget-control">
              <input
                id="profile-budget"
                v-model.number="form.budget"
                type="range"
                min="10"
                max="100"
                step="1"
                :disabled="loading || saving"
              />
              <output for="profile-budget">
                S${{ form.budget }}
              </output>
            </div>

            <div class="budget-labels">
              <span>S$10</span>
              <span>S$100</span>
            </div>
          </div>

          <p v-if="error" class="error-message" role="alert">
            {{ error }}
          </p>
          <p v-if="message" class="success-message" role="status">
            {{ message }}
          </p>

          <div class="form-actions">
            <button
              type="button"
              class="cancel-button"
              :disabled="loading || saving"
              @click="loadPreferences"
            >
              Cancel
            </button>

            <button
              type="submit"
              class="save-button"
              :disabled="loading || saving"
            >
              {{ saving ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Right column -->
      <aside class="recommendation-panel" v-if="user?.role !== 'admin'">
        <h2>Recommendations grow with you</h2>
        <p>
          The more you share, the better our picks for your
          style, occasions and budget.
        </p>
        <RouterLink to="/discover">
          Explore Discover →
        </RouterLink>
      </aside>
      <aside
        v-if="user?.role === 'admin'"
        class="recommendation-panel"
      >
        <h2>Admin dashboard</h2>
        <p>Manage users, listings and reports.</p>

        <RouterLink :to="{ name: 'admin-dashboard' }">
          Open dashboard →
        </RouterLink>
      </aside>
    </div>
    <CommunityHistory v-if="user?.role === 'consumer'" :user-id="user.id" :show-header="false" class="mt-5" />
  </section>
</template>

<style scoped>
.profile-page {
  color: #44213f;
  padding-bottom: 32px;
}

.page-heading {
  margin-bottom: 28px;
}

h1,
h2 {
  font-family: Georgia, serif;
}

h1 {
  font-size: clamp(32px, 4vw, 48px);
  margin-bottom: 8px;
}

h2 {
  font-size: 28px;
  margin-bottom: 20px;
}

.page-heading p,
.hint,
.profile-sidebar p {
  color: #6d6870;
}

.profile-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  gap: 20px;
  align-items: start;
}

.profile-sidebar,
.profile-card,
.recommendation-panel {
  border-radius: 16px;
  padding: 24px;
}

.profile-sidebar {
  background: #f7f1fa;
  border: 1px solid #e8dfeb;
}

.profile-sidebar h2 {
  font-size: 23px;
  margin: 16px 0 4px;
  overflow-wrap: anywhere;
}

.profile-sidebar nav {
  display: grid;
  gap: 8px;
  border-top: 1px solid #e3d9e6;
  margin-top: 20px;
  padding-top: 20px;
}

.profile-sidebar a {
  color: #44213f;
  text-decoration: none;
  padding: 10px;
  border-radius: 8px;
}

.profile-sidebar a:hover {
  background: #eee1f1;
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #e6d5ed;
  display: grid;
  place-items: center;
  font-size: 36px;
}

.avatar-large {
  width: 120px;
  height: 120px;
  font-size: 56px;
}

.profile-content {
  display: grid;
  gap: 20px;
}

.profile-card {
  background: #fff;
  border: 1px solid #e5dfe3;
  scroll-margin-top: 24px;
}

.details-layout {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 24px;
  align-items: center;
}

.account-details {
  display: grid;
  gap: 10px;
}

label,
legend {
  font-weight: 600;
  font-size: 15px;
}

.account-details input {
  width: 100%;
  min-width: 0;
  border: 1px solid #ddd5df;
  border-radius: 10px;
  padding: 10px 12px;
  background: #faf8fb;
  color: #49414b;
}

.hint {
  font-size: 14px;
  margin: 6px 0 12px;
}

fieldset {
  border: 0;
  padding: 0;
  margin: 0 0 24px;
  min-width: 0;
}

legend {
  float: none;
  width: auto;
  margin-bottom: 0;
}

.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.option-button {
  border: 1px solid #ddd5df;
  border-radius: 24px;
  background: white;
  color: #49414b;
  padding: 8px 18px;
}

.option-button.selected,
.save-button {
  background: #683760;
  color: white;
  border-color: #683760;
}

.budget-control {
  display: flex;
  align-items: center;
  gap: 16px;
}

.budget-control input {
  flex: 1;
  min-width: 0;
  accent-color: #683760;
}

.budget-control output {
  min-width: 60px;
  font-weight: 600;
}

.budget-labels {
  display: flex;
  justify-content: space-between;
  color: #6d6870;
  font-size: 13px;
  margin-top: 6px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  border-top: 1px solid #eee8ef;
  margin-top: 24px;
  padding-top: 20px;
}

.cancel-button,
.save-button {
  border-radius: 10px;
  padding: 10px 20px;
}

.cancel-button {
  background: white;
  border: 1px solid #ddd5df;
  color: #635c65;
}

.save-button {
  border: 1px solid #683760;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #a0273f;
  margin-top: 16px;
}

.success-message {
  color: #286344;
  margin-top: 16px;
}

.recommendation-panel {
  background: #fce0d5;
  padding: 24px;
  min-width: 0;
  box-sizing: border-box;
  text-align: left;
}

.recommendation-panel h2 {
  font-size: 26px;
  line-height: 1.2;
  white-space: normal;
  overflow-wrap: anywhere;
}


.recommendation-panel p {
  color: #65534e;
  line-height: 1.6;
}

.recommendation-panel a {
  color: #683760;
}

@media (max-width: 1100px) {
  .profile-layout {
    grid-template-columns: 200px minmax(0, 1fr);
  }

  .recommendation-panel {
    grid-column: 2;
  }
}

@media (max-width: 700px) {
  .profile-layout,
  .details-layout {
    grid-template-columns: 1fr;
  }

  .recommendation-panel {
    grid-column: auto;
  }
}

.profile-sidebar a.admin-dashboard-link {
  display: block;
  margin-top: 12px;
  padding: 14px;
  background: #fce0d5;
  color: #44213f;
  border-radius: 12px;
  font-weight: bold;
  text-decoration: none;
}

.profile-sidebar a.admin-dashboard-link:hover {
  background: #f7cdbd;
}
</style>