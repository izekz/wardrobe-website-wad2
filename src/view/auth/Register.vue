<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '../../services/authService'
import CommunityFloral from '../../components/CommunityFloral.vue'
const router = useRouter()
const form = ref({ name: '', email: '', password: '', confirmPassword: '', role: 'consumer' })
const showPassword = ref(false), showConfirm = ref(false), busy = ref(false), error = ref('')
async function submit() {
  if (busy.value) return
  error.value = ''
  if (form.value.password !== form.value.confirmPassword) { error.value = 'Your passwords do not match.'; return }
  busy.value = true
  try {
    await register(form.value)
    form.value.password = ''; form.value.confirmPassword = ''
    await router.push({ name: 'community-marketplace' })
  } catch (err) { error.value = err.message }
  finally { busy.value = false }
}
</script>
<template>
  <section class="registration-page">
    <header class="registration-header"><RouterLink to="/login" class="registration-brand">Dripped <span aria-hidden="true">✿</span></RouterLink><span>Already a member? <RouterLink to="/login">Log in</RouterLink></span></header>
    <div class="registration-layout">
      <aside class="registration-story"><h1>Find your<br>kind of style.</h1><p>Pre-loved, new and unique fashion<br>from your university community.</p><img src="../../assets/images/register-style.png" alt="A relaxed everyday look in soft lilac and cream" /><CommunityFloral class="registration-flower" aria-hidden="true" /></aside>
      <div class="registration-card">
        <h2>Create your account</h2><p class="registration-subtitle">A little more you, every day.</p>
        <form @submit.prevent="submit" :aria-busy="busy">
          <fieldset :disabled="busy" class="registration-fields">
            <legend class="visually-hidden">Your account details</legend>
            <div class="registration-types" role="group" aria-label="Account type"><button type="button" :class="{ selected: form.role === 'consumer' }" :aria-pressed="form.role === 'consumer'" @click="form.role = 'consumer'"><span aria-hidden="true">♙</span> Customer</button><button type="button" :class="{ selected: form.role === 'business' }" :aria-pressed="form.role === 'business'" @click="form.role = 'business'"><span aria-hidden="true">⌂</span> Business</button></div>
            <label for="register-name">Full name</label><input id="register-name" v-model.trim="form.name" autocomplete="name" required maxlength="100" placeholder="Your name" />
            <label for="register-email">Email address</label><input id="register-email" v-model.trim="form.email" type="email" autocomplete="username" required maxlength="254" placeholder="you@example.com" />
            <label for="register-password">Password</label><div class="registration-password"><input id="register-password" v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required minlength="12" aria-describedby="password-help" placeholder="Create a password" /><button type="button" @click="showPassword = !showPassword" :aria-label="showPassword ? 'Hide password' : 'Show password'" :aria-pressed="showPassword"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><p id="password-help" class="registration-help">Use at least 12 characters.</p>
            <label for="register-confirm">Confirm password</label><div class="registration-password"><input id="register-confirm" v-model="form.confirmPassword" :type="showConfirm ? 'text' : 'password'" autocomplete="new-password" required minlength="12" placeholder="Enter your password again" /><button type="button" @click="showConfirm = !showConfirm" :aria-label="showConfirm ? 'Hide confirmation password' : 'Show confirmation password'" :aria-pressed="showConfirm"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
            <p v-if="error" class="registration-error" role="alert">{{ error }}</p>
            <button class="registration-submit" type="submit">{{ busy ? 'Creating your account…' : 'Create account' }}</button>
          </fieldset>
        </form>
        <p class="registration-login">Already have an account? <RouterLink to="/login">Log in</RouterLink></p>
      </div>
    </div>
    <CommunityFloral variant="sprig" class="registration-edge" aria-hidden="true" />
  </section>
</template>
<style scoped>
.registration-page{min-height:100vh;background:#fffdfa;color:#352c38;position:relative;overflow:hidden;padding:24px 5vw 40px}.registration-header{display:flex;align-items:center;justify-content:space-between;gap:20px;position:relative;z-index:1}.registration-brand{font:700 38px Georgia,serif;color:#4b204b;text-decoration:none}.registration-brand span{color:#efb9c3}.registration-header>span{font-size:14px}.registration-header a:not(.registration-brand),.registration-login a{color:#4b204b;font-weight:600;text-underline-offset:4px}.registration-layout{max-width:1400px;margin:36px auto 0;display:grid;grid-template-columns:1fr 1fr;gap:50px;position:relative;z-index:1}.registration-story{position:relative;min-height:730px}.registration-story h1{font:600 clamp(40px,5vw,72px)/1.03 Georgia,serif;letter-spacing:-2px;color:#4b204b;position:relative;z-index:1;margin:20px 0 18px}.registration-story>p{font-size:18px;line-height:1.55;position:relative;z-index:1;max-width:350px}.registration-story>img{width:87%;height:500px;object-fit:cover;object-position:center 38%;display:block;margin:20px 0 0 auto;border-radius:110px 110px 65px 100px}.registration-flower{position:absolute;left:-60px;bottom:65px;width:160px;opacity:.55;pointer-events:none}.registration-card{border:1px solid #eee5e9;border-radius:24px;padding:38px 38px 20px;background:#fffdfa}.registration-card h2{font:600 clamp(35px,3.8vw,57px)/1.08 Georgia,serif;letter-spacing:-1.5px;color:#4b204b;margin-bottom:12px}.registration-subtitle{font-size:20px;margin-bottom:27px}.registration-fields{border:0;padding:0;margin:0;min-width:0}.registration-types{display:flex;border:1px solid #e5dce1;border-radius:12px;padding:4px;margin-bottom:25px;background:#faf7f5}.registration-types button{flex:1;border:0;border-radius:9px;background:none;padding:13px 8px;color:#49384b;font-size:16px}.registration-types button.selected{background:#f9dfe8;font-weight:600}.registration-types span{font-size:21px;margin-right:8px}.registration-fields>label{display:block;font-size:14px;font-weight:600;margin:20px 0 8px}.registration-fields>input,.registration-password{width:100%;border:1px solid #ddd4dc;border-radius:9px;background:#fff;min-height:50px}.registration-fields>input{padding:12px 15px;font-size:15px}.registration-password{display:flex;align-items:center;padding:0 10px 0 15px}.registration-password input{flex:1;min-width:0;border:0;background:transparent;outline:0;padding:13px 0;font-size:15px}.registration-password button{border:0;background:none;color:#615263;padding:7px;display:flex}.registration-password svg{width:21px;height:21px;stroke:currentColor;stroke-width:1.5;fill:none}.registration-fields>input:focus,.registration-password:focus-within{outline:2px solid #aa80a2;outline-offset:2px}.registration-help{font-size:12px;color:#847287;margin:7px 0 0}.registration-submit{width:100%;border:0;border-radius:10px;background:#623e61;color:#fff;font-size:16px;font-weight:600;padding:17px;margin-top:28px}.registration-submit:hover{background:#4d2b4c}.registration-fields:disabled .registration-submit{opacity:.65;cursor:wait}.registration-error{background:#fff0ef;color:#9a2929;padding:12px;border-radius:8px;font-size:14px;margin-top:16px}.registration-login{border-top:1px solid #e8dfe5;padding-top:22px;margin-top:24px;text-align:center;font-size:14px}.registration-edge{position:absolute;right:-30px;top:90px;width:125px;opacity:.5;pointer-events:none}
@media(max-width:1000px){.registration-layout{gap:28px}.registration-card{padding:30px 25px}.registration-story>img{width:100%}.registration-story h1{font-size:52px}}
@media(max-width:700px){.registration-page{padding:20px}.registration-header{align-items:flex-start}.registration-brand{font-size:29px}.registration-header>span{font-size:12px;max-width:125px;text-align:right}.registration-layout{grid-template-columns:1fr;margin-top:28px}.registration-story{min-height:0}.registration-story h1{font-size:39px}.registration-story>p{font-size:15px}.registration-story>img{height:220px;border-radius:55px;object-position:center 30%}.registration-flower{display:none}.registration-card{padding:25px 20px}.registration-card h2{font-size:37px}.registration-subtitle{font-size:17px}.registration-edge{display:none}}
</style>
