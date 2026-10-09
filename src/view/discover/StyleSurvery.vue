<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authState } from '../../services/authService'
import { getSurvey, saveSurvey } from '../../services/surveyService'

const router = useRouter()
const styles = ['Minimalist', 'Streetwear', 'Vintage', 'Y2K', 'Formal', 'Casual', 'Preppy']
const activities = ['University', 'Presentation', 'Date', 'Internship / work', 'Casual outings', 'Formal events']

const selectedStyles = ref([])
const selectedActivities = ref([])
const budget = ref(40)
const busy = ref(false)
const loading = ref(true)
const error = ref('')

const styleEmoji = {
  Minimalist: '🤍', Streetwear: '🧢', Vintage: '👜', Y2K: '🩷', Formal: '🖤', Casual: '☁️', Preppy: '🎀'
}

const previewStyles = computed(() => selectedStyles.value.length ? selectedStyles.value.slice(0, 2) : ['Your style'])
const activitySummary = computed(() => {
  if (!selectedActivities.value.length) return 'Choose what you usually dress for'
  return selectedActivities.value.slice(0, 2).join(' & ')
})

function toggleStyle(style) {
  if (selectedStyles.value.includes(style)) {
    selectedStyles.value = selectedStyles.value.filter(item => item !== style)
    return
  }
  if (selectedStyles.value.length < 2) selectedStyles.value.push(style)
}

function toggleActivity(activity) {
  selectedActivities.value = selectedActivities.value.includes(activity)
    ? selectedActivities.value.filter(item => item !== activity)
    : [...selectedActivities.value, activity]
}

async function load() {
  try {
    const data = await getSurvey()
    selectedStyles.value = data.survey.preferredStyles || []
    selectedActivities.value = data.survey.activities || []
    budget.value = data.survey.budget || 40
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function submit() {
  error.value = ''
  if (!selectedStyles.value.length) {
    error.value = 'Choose at least one style that feels like you.'
    return
  }
  if (!selectedActivities.value.length) {
    error.value = 'Choose at least one occasion you usually dress for.'
    return
  }
  busy.value = true
  try {
    const result = await saveSurvey({
      preferredStyles: selectedStyles.value,
      activities: selectedActivities.value,
      budget: Number(budget.value),
    })
    authState.user = result.user
    await router.push({ name: 'community-marketplace' })
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

function skipForNow() {
  router.push({ name: 'community-marketplace' })
}

load()
</script>

<template>
  <section class="survey-page">
    <header class="survey-header">
      <RouterLink to="/community" class="survey-brand">Wardrobe <span aria-hidden="true">✿</span></RouterLink>
      <nav aria-label="Main navigation">
        <span class="active">Discover</span>
        <span>My wardrobe</span>
        <span>Outfit planner</span>
        <span>Community</span>
      </nav>
      <div class="survey-account" :title="authState.user?.name || 'Account'">{{ (authState.user?.name || 'A').charAt(0).toUpperCase() }}</div>
    </header>

    <main class="survey-shell">
      <section class="survey-form-panel">
        <p class="eyebrow">PERSONALISE YOUR DISCOVER PAGE</p>
        <h1>Let’s find your style</h1>
        <p class="lead">A few details help us find pieces you will actually wear.</p>

        <div v-if="loading" class="survey-loading">Loading your preferences…</div>
        <form v-else @submit.prevent="submit">
          <fieldset :disabled="busy">
            <legend>Which styles feel like you?</legend>
            <p class="field-note">Select up to 2 styles.</p>
            <div class="style-grid">
              <button
                v-for="style in styles"
                :key="style"
                type="button"
                class="style-card"
                :class="{ selected: selectedStyles.includes(style) }"
                :aria-pressed="selectedStyles.includes(style)"
                @click="toggleStyle(style)"
              >
                <span v-if="selectedStyles.includes(style)" class="check">✓</span>
                <span class="style-art" aria-hidden="true">{{ styleEmoji[style] }}</span>
                <strong>{{ style }}</strong>
              </button>
            </div>
          </fieldset>

          <fieldset :disabled="busy">
            <legend>What are you dressing for?</legend>
            <p class="field-note">Select one or more options.</p>
            <div class="pill-row">
              <button
                v-for="activity in activities"
                :key="activity"
                type="button"
                class="choice-pill"
                :class="{ selected: selectedActivities.includes(activity) }"
                :aria-pressed="selectedActivities.includes(activity)"
                @click="toggleActivity(activity)"
              >
                <span v-if="selectedActivities.includes(activity)" aria-hidden="true">✓</span>
                {{ activity }}
              </button>
            </div>
          </fieldset>

          <fieldset :disabled="busy" class="budget-fieldset">
            <legend>Your budget per item</legend>
            <p class="field-note">Set a budget range for better recommendations.</p>
            <div class="budget-row">
              <div class="budget-control">
                <input v-model.number="budget" type="range" min="10" max="100" step="5" aria-label="Budget per item" />
                <div class="range-labels"><span>S$10</span><span>S$100</span></div>
              </div>
              <strong>Up to S${{ budget }}</strong>
            </div>
          </fieldset>

          <p v-if="error" class="survey-error" role="alert">{{ error }}</p>
          <button class="save-button" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save my style' }} <span aria-hidden="true">→</span></button>
          <button class="skip-button" type="button" :disabled="busy" @click="skipForNow">Skip for now</button>
        </form>
      </section>

      <aside class="preview-card" aria-label="Style preview">
        <div>
          <p class="preview-kicker">YOUR STYLE PREVIEW</p>
          <h2>Your style preview <span aria-hidden="true">✦</span></h2>
          <p>A glimpse of pieces we think you’ll love.</p>
        </div>
        <div class="preview-look" aria-hidden="true">
          <div class="preview-top">▱</div>
          <div class="preview-jeans">▥</div>
          <div class="preview-bag">◒</div>
          <div class="preview-shoes">◡◡</div>
          <span class="preview-flower">✿</span>
        </div>
        <div class="preview-tags"><span v-for="style in previewStyles" :key="style">{{ style }}</span></div>
        <hr />
        <div class="preview-detail"><span aria-hidden="true">🎓</span><div><small>Dressing for</small><strong>{{ activitySummary }}</strong></div></div>
        <div class="preview-detail"><span aria-hidden="true">🏷</span><div><small>Your budget</small><strong>Up to S${{ budget }}</strong></div></div>
      </aside>
    </main>
  </section>
</template>

<style scoped>
.survey-page{min-height:100vh;background:#fffdfa;color:#2f2932;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.survey-header{height:76px;border-bottom:1px solid #ece4e8;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 5vw;background:rgba(255,253,250,.96);position:sticky;top:0;z-index:10}.survey-brand{font:700 34px Georgia,serif;color:#4c1748;text-decoration:none}.survey-brand span{color:#efb9c7;font-size:30px}.survey-header nav{display:flex;align-items:center;gap:44px;font-size:14px}.survey-header nav span{padding:29px 0 20px;white-space:nowrap}.survey-header nav .active{font-weight:700;color:#4c1748;border-bottom:3px solid #6c3a68}.survey-account{justify-self:end;width:44px;height:44px;border-radius:50%;background:#f4dce7;color:#5b2d58;display:grid;place-items:center;font-weight:700}.survey-shell{max-width:1420px;margin:0 auto;padding:48px 5vw 70px;display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:54px;position:relative}.survey-shell:before,.survey-shell:after{content:'✿';position:absolute;color:#efc3ce;font-size:86px;opacity:.55;pointer-events:none}.survey-shell:before{left:-18px;top:58px;transform:rotate(-25deg)}.survey-shell:after{left:15px;bottom:15px;transform:rotate(15deg)}.eyebrow,.preview-kicker{font-size:11px;letter-spacing:.16em;font-weight:800;color:#8d6d88}.survey-form-panel h1{font:600 clamp(46px,5vw,72px)/1.02 Georgia,serif;color:#4a1746;letter-spacing:-2px;margin:5px 0 10px}.lead{font-size:20px;color:#615866;margin-bottom:40px}.survey-form-panel fieldset{border:0;padding:0;margin:0 0 32px;min-width:0}.survey-form-panel legend{font-size:20px;font-weight:750;margin-bottom:3px}.field-note{color:#746b78;font-size:14px;margin-bottom:14px}.style-grid{display:grid;grid-template-columns:repeat(7,minmax(92px,1fr));gap:12px}.style-card{height:174px;border:1px solid #ded6dc;border-radius:12px;background:#fff;position:relative;padding:10px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:11px;color:#2e2930;transition:.15s ease}.style-card:hover{transform:translateY(-2px);border-color:#aa819f}.style-card.selected{border:2px solid #673762;box-shadow:0 0 0 2px #f2e5ef}.style-art{width:100%;height:106px;border-radius:8px;background:linear-gradient(145deg,#f6eee8,#eee6f6);display:grid;place-items:center;font-size:44px;filter:saturate(.75)}.style-card:nth-child(2) .style-art{background:linear-gradient(145deg,#dbdbe0,#c7ced6)}.style-card:nth-child(3) .style-art{background:linear-gradient(145deg,#e8d5c3,#ddd0bd)}.style-card:nth-child(4) .style-art{background:linear-gradient(145deg,#f0cad7,#efafc5)}.style-card:nth-child(5) .style-art{background:linear-gradient(145deg,#d5d6da,#bbc0ca)}.style-card:nth-child(6) .style-art{background:linear-gradient(145deg,#ece7d6,#ddd3bd)}.style-card:nth-child(7) .style-art{background:linear-gradient(145deg,#f7dfe4,#f0cbd6)}.check{position:absolute;top:8px;right:8px;width:27px;height:27px;border-radius:50%;background:#6a3a67;color:white;display:grid;place-items:center;font-weight:800;z-index:1}.pill-row{display:flex;flex-wrap:wrap;gap:10px}.choice-pill{border:1px solid #ded6dc;background:#fff;border-radius:999px;padding:11px 18px;min-width:120px;color:#463b47;font-size:14px}.choice-pill.selected{background:#673762;border-color:#673762;color:#fff}.choice-pill span{margin-right:7px}.budget-fieldset{margin-top:6px!important}.budget-row{display:flex;align-items:center;gap:28px}.budget-control{flex:1}.budget-control input{width:100%;accent-color:#6a3a67}.range-labels{display:flex;justify-content:space-between;color:#756c78;font-size:12px}.budget-row>strong{font:600 22px Georgia,serif;color:#4a1746;white-space:nowrap}.survey-error{background:#fff0ef;color:#922929;border-radius:9px;padding:12px 14px;margin:0 0 14px;max-width:740px}.save-button{display:block;width:min(100%,620px);margin:18px auto 0;border:0;border-radius:12px;background:#673762;color:#fff;padding:16px 22px;font-size:15px;font-weight:700}.save-button:hover{background:#51254e}.save-button:disabled{opacity:.65;cursor:wait}.skip-button{display:block;margin:13px auto 0;border:0;background:none;color:#7b6f7d;padding:8px 16px}.preview-card{align-self:start;position:sticky;top:110px;border-radius:22px;background:linear-gradient(150deg,#efe7ff 0%,#f7eaf7 52%,#f8e0df 100%);padding:34px 30px 30px;min-height:680px;box-shadow:0 10px 30px rgba(85,42,83,.05)}.preview-card h2{font:600 34px/1.08 Georgia,serif;color:#4a1746;margin:5px 0 8px}.preview-card h2 span{color:#e6ad6d}.preview-card>div:first-child>p:last-child{color:#6d626f}.preview-look{height:330px;margin:25px 0 20px;position:relative;background:rgba(255,255,255,.35);border-radius:18px;overflow:hidden}.preview-top,.preview-jeans,.preview-bag,.preview-shoes{position:absolute;display:grid;place-items:center;color:#70506b;text-shadow:0 3px 10px rgba(74,23,70,.08)}.preview-top{left:30px;top:25px;width:150px;height:120px;border-radius:20px;background:#fffaf4;font-size:80px}.preview-jeans{left:115px;top:130px;width:115px;height:160px;border-radius:16px;background:#c8d9e8;font-size:78px}.preview-bag{right:22px;top:105px;width:88px;height:100px;border-radius:35px 35px 20px 20px;background:#765849;color:#f6ede8;font-size:44px}.preview-shoes{right:28px;bottom:20px;width:105px;height:60px;border-radius:50%;background:#f4eee5;font-size:34px}.preview-flower{position:absolute;left:24px;bottom:28px;font-size:44px;color:#f3d1bb}.preview-tags{display:flex;flex-wrap:wrap;gap:8px}.preview-tags span{padding:8px 15px;border-radius:999px;background:#f8dce7;font-size:13px}.preview-card hr{border:0;border-top:1px solid rgba(101,65,99,.16);margin:26px 0 20px}.preview-detail{display:flex;gap:13px;align-items:center;margin:16px 0}.preview-detail>span{font-size:22px}.preview-detail div{display:flex;flex-direction:column}.preview-detail small{color:#7b6d7d;font-size:11px}.preview-detail strong{font-size:14px}.survey-loading{padding:22px;border-radius:12px;background:#f6eef7;color:#624b63;max-width:640px}
@media(max-width:1150px){.survey-header nav{gap:22px}.survey-shell{grid-template-columns:1fr}.preview-card{position:relative;top:auto;max-width:620px;width:100%;justify-self:center;min-height:0}.style-grid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:760px){.survey-header{grid-template-columns:1fr auto;padding:0 20px}.survey-header nav{display:none}.survey-brand{font-size:29px}.survey-shell{padding:34px 20px 50px}.survey-form-panel h1{font-size:43px}.lead{font-size:16px}.style-grid{grid-template-columns:repeat(2,1fr)}.style-card{height:150px}.style-art{height:88px}.budget-row{align-items:flex-start;flex-direction:column;gap:8px}.preview-card{padding:26px 22px}.survey-shell:before,.survey-shell:after{display:none}}
</style>
