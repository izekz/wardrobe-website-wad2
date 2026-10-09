// Start Vue and load the main page.
import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import App from './App.vue'
import router from './router'
import './assets/styles/community.css'

createApp(App).use(router).mount('#app')