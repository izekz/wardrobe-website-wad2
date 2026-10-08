import Login from '../view/auth/Login.vue'
import Register from '../view/auth/Register.vue'
export default [
  { path: '/login', name: 'login', component: Login, meta: { authLayout: true, public: true } },
  { path: '/register', name: 'register', component: Register, meta: { authLayout: true, public: true } },
]
