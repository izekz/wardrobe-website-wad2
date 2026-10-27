import AdminDashboard from '../view/admin/AdminDashboard.vue'
import Users from '../view/admin/Users.vue'
import Listings from '../view/admin/Listings.vue'
import Reports from '../view/admin/Reports.vue'

export default [
    {
        path: '/admin',
        name: 'admin-dashboard',
        component: AdminDashboard,
        meta: { roles: ['admin'] },
    },
    {
        path: '/admin/users',
        name: 'admin-users',
        component: Users,
        meta: { roles: ['admin'] },
    },
    {
        path: '/admin/listings',
        name: 'admin-listings',
        component: Listings,
        meta: { roles: ['admin'] },
    },
    {
        path: '/admin/reports',
        name: 'admin-reports',
        component: Reports,
        meta: { roles: ['admin'] },
    },
]