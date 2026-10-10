<script>
import {
  getListings,
  updateListingStatus,
} from '../../services/adminService'

export default {
  data() {
    return {
      listings: [],
      search: '',
      loading: true,
      updatingId: null,
      loadError: '',
      actionError: '',
      message: '',
    }
  },

  computed: {
    filteredListings() {
      const search = this.search.trim().toLowerCase()

      return this.listings.filter(listing =>
        `${listing.name} ${listing.ownerName} ${listing.category}`
          .toLowerCase()
          .includes(search)
      )
    },
  },

  async mounted() {
    try {
      const data = await getListings()
      this.listings = data.listings
    } catch (error) {
      this.loadError = error.message || 'Unable to load listings.'
    } finally {
      this.loading = false
    }
  },

  methods: {
    formatPrice(listing) {
      const amount = listing.listingType === 'rent'
        ? listing.rentalPrice
        : listing.price

      return amount == null
        ? '—'
        : `S$${Number(amount).toFixed(2)}`
    },

    async changeStatus(listing) {
      const status = listing.status === 'available'
        ? 'unavailable'
        : 'available'

      if (!window.confirm(`Mark "${listing.name}" as ${status}?`)) {
        return
      }

      this.updatingId = listing.id
      this.actionError = ''
      this.message = ''

      try {
        const data = await updateListingStatus(listing.id, status)

        this.listings = this.listings.map(item =>
          item.id === listing.id ? data.listing : item
        )

        this.message = `"${listing.name}" is now ${status}.`
      } catch (error) {
        this.actionError = error.message || 'Unable to update the listing.'
      } finally {
        this.updatingId = null
      }
    },
  },
}
</script>

<template>
  <section class="admin-page">
    <h1>Manage listings</h1>
    <p>Search community listings and manage their availability.</p>

    <RouterLink :to="{ name: 'admin-dashboard' }">
      ← Back to dashboard
    </RouterLink>

    <p v-if="loading" role="status">Loading listings…</p>

    <p v-else-if="loadError" class="error-message" role="alert">
      {{ loadError }}
    </p>

    <div v-else>
      <div class="search-field">
        <label for="listing-search">Search listings</label>
        <input
          id="listing-search"
          v-model="search"
          type="search"
          placeholder="Search by item, owner or category"
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
              <th scope="col">Item</th>
              <th scope="col">Owner</th>
              <th scope="col">Category</th>
              <th scope="col">Type</th>
              <th scope="col">Price</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="listing in filteredListings"
              :key="listing.id"
            >
              <td>{{ listing.name }}</td>
              <td>{{ listing.ownerName }}</td>
              <td>{{ listing.category }}</td>
              <td>
                {{ listing.listingType === 'rent' ? 'Rent' : 'Sale' }}
              </td>
              <td>{{ formatPrice(listing) }}</td>
              <td>{{ listing.status }}</td>
              <td>
                <button
                  type="button"
                  :disabled="updatingId !== null"
                  :aria-label="`Change availability of ${listing.name}`"
                  @click="changeStatus(listing)"
                >
                  {{
                    updatingId === listing.id
                      ? 'Updating…'
                      : listing.status === 'available'
                        ? 'Mark unavailable'
                        : 'Mark available'
                  }}
                </button>
              </td>
            </tr>

            <tr v-if="filteredListings.length === 0">
              <td colspan="7">No listings found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-listings-page {
  color: #44213f;
  padding-bottom: 32px;
}

h1 {
  font-family: Georgia, serif;
}

.search-field {
  display: grid;
  gap: 8px;
  margin: 24px 0;
  max-width: 440px;
}

.search-field input {
  padding: 12px;
  border: 1px solid #ddd5df;
  border-radius: 10px;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 850px;
  border-collapse: collapse;
  background: white;
}

th,
td {
  padding: 14px;
  text-align: left;
  border-bottom: 1px solid #e5dfe3;
}

th {
  background: #f7f1fa;
}

button {
  background: #683760;
  color: white;
  padding: 8px 14px;
  border: 0;
  border-radius: 8px;
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