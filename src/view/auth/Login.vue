<script setup>

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { login, authState } from '../../services/authService'
import CommunityFloral from '../../components/CommunityFloral.vue'

const router = useRouter()
const email = ref(''), password = ref(''), remember = ref(false), showPassword = ref(false)
const busy = ref(false), error = ref(''), notice = ref('')
const registrationRoute = computed(() => router.getRoutes().find(r => r.name === 'register'))

async function submit() {
  if (busy.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    await login(email.value, password.value, remember.value)
    password.value = ''
    await router.push({ name: 'community-marketplace' })
  } catch (err) { error.value = err.message }
  finally { busy.value = false }
}

</script>

<template>

  <section class="auth-login">

    <div class="login-visual">
      <RouterLink to="/community" class="login-brand">Dripped <span aria-hidden="true">✿</span></RouterLink>
      <div class="login-visual-heading"><h1>Welcome back<br>to your wardrobe.</h1><span class="login-stroke" aria-hidden="true"></span></div>
    </div>

    <div class="login-side">
      <div class="login-toplink">New here? <RouterLink v-if="registrationRoute" :to="{ name: 'register' }">Create account</RouterLink><span v-else>Registration coming soon</span></div>
      <CommunityFloral class="login-flower login-flower-top" aria-hidden="true" />
      <div class="login-form-wrap">
        <h2>Welcome back</h2><p class="login-subtitle">Your next favourite outfit is waiting.</p>
        <form @submit.prevent="submit" :aria-busy="busy">
          <label for="login-email">Email address</label>
          <div class="login-input"><span aria-hidden="true">✉</span><input id="login-email" v-model.trim="email" type="email" autocomplete="username" placeholder="you@example.com" required maxlength="254" :disabled="busy" /></div>
          <label for="login-password">Password</label>
          <div class="login-input"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></svg><input id="login-password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Enter your password" required :disabled="busy" :aria-describedby="error ? 'login-error' : undefined" /><button type="button" class="login-eye" @click="showPassword = !showPassword" :aria-label="showPassword ? 'Hide password' : 'Show password'" :aria-pressed="showPassword"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
          <div class="login-options"><label class="login-remember"><input v-model="remember" type="checkbox" :disabled="busy" /> Remember me</label><button type="button" class="login-link-button" @click="notice = 'Password reset is not available yet. Ask your team administrator for help.'">Forgot password?</button></div>
          <p v-if="error || authState.error" id="login-error" class="login-message login-error" role="alert">{{ error || authState.error }}</p>
          <p v-if="notice" class="login-message" role="status">{{ notice }}</p>
          <button class="login-submit" type="submit" :disabled="busy">{{ busy ? 'Logging in…' : 'Log in' }} <span v-if="!busy" aria-hidden="true">→</span></button>
        </form>
        <template v-if="registrationRoute"><div class="login-divider"><span>or</span></div><p class="login-register">New to Wardrobe? <RouterLink :to="{ name: 'register' }">Create account</RouterLink></p></template>
        <p v-else class="login-register">Use the account provided by your project team.</p>
        <div class="login-tagline"><span aria-hidden="true">✿</span><p>Made for your style, your budget, your everyday.</p></div>
      </div>
      <CommunityFloral variant="sprig" class="login-flower login-flower-bottom" aria-hidden="true" />
    </div>
  </section>

</template>

<style scoped>

.auth-login{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;background:#fffdfa;color:#342b36}.login-visual{position:relative;min-height:100vh;background:#e9ddd7 url('../../assets/images/login-wardrobe.png') center center/cover no-repeat;padding:32px 48px}.login-brand{position:relative;z-index:1;font-family:Georgia,serif;font-size:36px;font-weight:700;color:#4b204b;text-decoration:none}.login-brand span{color:#e9b8c2;font-size:38px}.login-visual-heading{position:relative;z-index:1;margin-top:68px}.login-visual-heading h1{font-family:Georgia,serif;color:#4b204b;font-size:clamp(36px,3.6vw,58px);line-height:1.08;letter-spacing:-2px;font-weight:600}.login-stroke{display:block;width:110px;height:14px;margin:18px 0 0 50px;border-top:3px solid #dbaeb7;border-radius:50%;transform:rotate(-5deg)}.login-side{position:relative;padding:32px 48px;display:flex;align-items:center;justify-content:center;overflow:hidden}.login-toplink{position:absolute;top:34px;right:42px;font-size:14px;color:#4f3750;z-index:2}.login-toplink a,.login-register a{color:#4b204b;font-weight:600;text-underline-offset:4px}.login-toplink span{margin-left:8px;color:#8f7a8e}.login-form-wrap{width:100%;max-width:460px;position:relative;z-index:1;padding:100px 0 30px}.login-form-wrap h2{font-family:Georgia,serif;font-size:clamp(40px,4vw,60px);color:#4b204b;letter-spacing:-2px;text-align:center;font-weight:600;margin:0 0 8px}.login-subtitle{text-align:center;font-size:18px;margin-bottom:42px}.login-form-wrap form>label{display:block;font-weight:600;font-size:14px;margin:24px 0 9px}.login-input{display:flex;align-items:center;gap:12px;border:1px solid #dfd7df;border-radius:10px;padding:0 15px;background:#fff;min-height:55px}.login-input:focus-within{outline:2px solid #a77ca0;outline-offset:2px}.login-input>span{font-size:22px;color:#978998}.login-input svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;flex-shrink:0}.login-input input{width:100%;min-width:0;border:0;outline:none;background:transparent;padding:15px 0;font-size:15px}.login-input input::placeholder{color:#958997}.login-eye{padding:5px;border:0;background:none;color:#594e5a;display:flex}.login-options{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:20px 0 25px;font-size:13px}.login-remember{display:flex;align-items:center;gap:9px}.login-remember input{accent-color:#62375f;width:17px;height:17px}.login-link-button{background:none;border:0;color:#4b204b;text-decoration:underline;text-underline-offset:4px;padding:0}.login-submit{width:100%;min-height:55px;background:#623e61;color:white;border:0;border-radius:9px;font-weight:600;font-size:16px;display:flex;justify-content:center;align-items:center;gap:30px}.login-submit:hover{background:#4d2b4c}.login-submit:disabled{opacity:.65;cursor:wait}.login-message{font-size:14px;padding:12px;border-radius:8px;background:#f2eaf4;margin-bottom:18px}.login-error{background:#fff0ef;color:#9a2929}.login-divider{display:flex;align-items:center;gap:20px;margin:30px 0;color:#a198a1;font-size:13px}.login-divider:before,.login-divider:after{content:'';height:1px;background:#ddd3db;flex:1}.login-register{text-align:center;font-size:14px;margin-top:28px;color:#6f6171}.login-tagline{text-align:center;margin-top:60px;color:#978598;font-size:13px}.login-tagline>span{font-size:28px;color:#e8bbc5}.login-tagline p{margin-top:10px}.login-flower{position:absolute;width:125px;pointer-events:none;opacity:.65}.login-flower-top{right:-35px;top:85px;transform:rotate(-15deg)}.login-flower-bottom{bottom:-10px;left:-20px;transform:rotate(20deg)}
@media(max-width:900px){.login-visual{padding:28px;}.login-side{padding:28px;}.login-toplink{right:25px;font-size:12px}.login-visual-heading h1{font-size:40px}}
@media(max-width:650px){.auth-login{grid-template-columns:1fr}.login-visual{min-height:230px;background-position:center 30%;padding:20px 24px}.login-brand{font-size:29px}.login-visual-heading{margin-top:25px}.login-visual-heading h1{font-size:32px;letter-spacing:-1px}.login-stroke{margin-top:9px}.login-side{min-height:650px;padding:28px 24px}.login-form-wrap{padding-top:65px}.login-form-wrap h2{font-size:42px}.login-subtitle{font-size:15px;margin-bottom:26px}.login-tagline{margin-top:35px}.login-flower-top{width:90px;top:65px}}

</style>
