<script>
import {
  getUsers,
  updateUserStatus,
} from '../../services/adminService'

export default {
  data() {
    return {
      users: [],
      search: '',
      loading: true,
      updatingId: null,
      loadError: '',
      actionError: '',
      message: '',
    }
  },

  computed: {
    filteredUsers() {
      const search = this.search.trim().toLowerCase()

      return this.users.filter(user =>
        `${user.name} ${user.email} ${user.role}`
          .toLowerCase()
          .includes(search)
      )
    },
  },

  async mounted() {
    try {
      const data = await getUsers()
      this.users = data.users
    } catch (error) {
      this.loadError = error.message || 'Unable to load users.'
    } finally {
      this.loading = false
    }
  },

  methods: {
    async changeStatus(user) {
      const suspended = !user.suspended
      const action = suspended ? 'Suspend' : 'Reactivate'

      if (!window.confirm(`${action} ${user.name}'s account?`)) {
        return
      }

      this.updatingId = user.id
      this.actionError = ''
      this.message = ''

      try {
        const data = await updateUserStatus(user.id, suspended)

        this.users = this.users.map(account =>
          account.id === user.id ? data.user : account
        )

        this.message = suspended
          ? `${user.name}'s account has been suspended.`
          : `${user.name}'s account has been reactivated.`
      } catch (error) {
        this.actionError = error.message || 'Unable to update the account.'
      } finally {
        this.updatingId = null
      }
    },
  },
}
</script>

<template>
  <section class="admin-page">
    <h1>Manage users</h1>
    <p>Search accounts and manage their access.</p>

    <RouterLink :to="{ name: 'admin-dashboard' }">
      ← Back to dashboard
    </RouterLink>

    <p v-if="loading" role="status">Loading users…</p>

    <p v-else-if="loadError" class="error-message" role="alert">
      {{ loadError }}
    </p>

    <div v-else>
      <div class="search-field">
        <label for="user-search">Search users</label>
        <input
          id="user-search"
          v-model="search"
          type="search"
          placeholder="Search by name, email or role"
        />
      </div>

      <p v-if="actionError" class="error-message" role="alert">
        {{ actionError }}
      </p>

      <p v-if="message" class="success-message" role="status">
        {{ message }}
      </p>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.role }}</td>
              <td>
                {{ user.suspended ? 'Suspended' : 'Active' }}
              </td>
              <td>
                <span v-if="user.role === 'admin'">
                  Protected
                </span>

                <button
                  v-else
                  type="button"
                  :disabled="updatingId !== null"
                  :aria-label="`${user.suspended ? 'Reactivate' : 'Suspend'} ${user.name}`"
                  @click="changeStatus(user)"
                >
                  {{
                    updatingId === user.id
                      ? 'Updating…'
                      : user.suspended
                        ? 'Reactivate'
                        : 'Suspend'
                  }}
                </button>
              </td>
            </tr>

            <tr v-if="filteredUsers.length === 0">
              <td colspan="5">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-page {
  color: #44213f;
  padding: 24px 0 40px;
}

h1 {
  font-family: Georgia, serif;
  font-size: 36px;
  margin: 0 0 8px;
}

.admin-page > p {
  color: #6d6870;
  margin: 0 0 20px;
}

a {
  display: inline-block;
  color: #683760;
  margin-bottom: 20px;
}

.search-field {
  margin: 24px 0;
  max-width: 440px;
}

.search-field label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
}

.search-field input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #ddd5df;
  border-radius: 8px;
}

.table-container {
  overflow-x: auto;
  border: 1px solid #e5dfe3;
  border-radius: 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

th,
td {
  text-align: left;
  vertical-align: middle;
  padding: 16px;
  border-bottom: 1px solid #e5dfe3;
}

th {
  background: #f7f1fa;
  white-space: nowrap;
}

tbody tr:last-child td {
  border-bottom: none;
}

button {
  background: #683760;
  color: white;
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  white-space: nowrap;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #a0273f;
}

.success-message {
  color: #286344;
}
</style>