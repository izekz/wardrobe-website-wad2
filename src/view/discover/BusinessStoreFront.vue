<script>
import '../../assets/styles/discover.css'
import { catalogApi } from '../../services/catalogApi'
import ProductCard from '../../components/ProductCard.vue'

export default {
  components: { ProductCard },

  data() {
    return {
      business: null,
      products: [],
      total: 0,
      page: 1,
      pageSize: 12,
      loading: true,
      error: '',
      loadVersion: 0,
    }
  },

  watch: {
    '$route.params.businessId': {
      immediate: true,
      handler() {
        this.page = 1
        this.load()
      },
    },
  },

  methods: {
    async load() {
      const version = ++this.loadVersion
      this.loading = true
      this.error = ''
      this.business = null
      this.products = []

      const id = encodeURIComponent(this.$route.params.businessId)

      try {
        const [profile, listings] = await Promise.all([
          catalogApi(`/businesses/${id}`),
          catalogApi(`/products?businessId=${id}&page=${this.page}`),
        ])

        if (version !== this.loadVersion) return

        this.business = profile.business
        this.products = listings.products
        this.total = listings.total
        this.pageSize = listings.pageSize
      } catch (error) {
        if (version === this.loadVersion) {
          this.error = error.message
        }
      } finally {
        if (version === this.loadVersion) {
          this.loading = false
        }
      }
    },

    changePage(page) {
      this.page = page
      this.load()
    },
  },

  beforeUnmount() {
    this.loadVersion++
  },
}
</script>

<template>
  <section class="storefront">
    <nav class="disc-breadcrumb" aria-label="Breadcrumb">
      <RouterLink :to="{ name: 'discover' }">Discover</RouterLink>
      <span aria-hidden="true">/</span>
      <span aria-current="page">
        {{ business?.businessName || 'Business profile' }}
      </span>
    </nav>

    <p v-if="loading" class="community-loading" role="status">
      Loading business and listings…
    </p>

    <div v-else-if="error" class="community-error" role="alert">
      {{ error }}
      <button
        type="button"
        class="community-btn community-btn-outline"
        @click="load"
      >
        Try again
      </button>
    </div>

    <template v-else-if="business">
      <header class="storefront-header">
        <div class="storefront-logo">
          <img
            v-if="business.logoURL"
            :src="business.logoURL"
            :alt="`${business.businessName} logo`"
          />
          <span v-else>
            {{ business.businessName.charAt(0).toUpperCase() }}
          </span>
        </div>

        <div>
          <p class="storefront-eyebrow">BUSINESS PROFILE</p>
          <h1>{{ business.businessName }}</h1>

          <p class="storefront-description">
            {{ business.description }}
          </p>

          <div class="d-flex flex-wrap gap-2">
            <span
              v-for="style in business.styles"
              :key="style"
              class="community-tag pink"
            >
              {{ style }}
            </span>
          </div>

          <p v-if="business.contact" class="storefront-contact">
            <strong>Contact:</strong> {{ business.contact }}
          </p>
        </div>
      </header>

      <div class="storefront-listings">
        <h2>Shop {{ business.businessName }}</h2>
        <p>{{ total }} {{ total === 1 ? 'listing' : 'listings' }}</p>
      </div>

      <div v-if="products.length" class="storefront-grid">
        <ProductCard
          v-for="product in products"
          :key="product.productId"
          :product="product"
        />
      </div>

      <p v-else class="storefront-empty">
        No listings yet. Check back soon for new pieces from this business.
      </p>

      <nav
        v-if="total > pageSize"
        class="storefront-pages"
        aria-label="Listings pages"
      >
        <button
          type="button"
          class="community-btn community-btn-outline"
          :disabled="page <= 1"
          @click="changePage(page - 1)"
        >
          Previous
        </button>

        <span>Page {{ page }} of {{ Math.ceil(total / pageSize) }}</span>

        <button
          type="button"
          class="community-btn community-btn-outline"
          :disabled="page * pageSize >= total"
          @click="changePage(page + 1)"
        >
          Next
        </button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.storefront-header {
  display: flex;
  align-items: flex-start;
  gap: 28px;
  padding: 36px;
  margin-bottom: 36px;
  border: 1px solid #eadfe7;
  border-radius: 24px;
  background: #faf1f5;
}

.storefront-logo {
  flex: 0 0 100px;
  width: 100px;
  height: 100px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: #eadbe9;
  color: #542044;
  font: 48px Georgia, serif;
}

.storefront-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

h1,
h2 {
  color: #542044;
  font-family: Georgia, serif;
  overflow-wrap: anywhere;
}

h1 {
  margin: 0 0 16px;
  font-size: clamp(32px, 5vw, 56px);
}

h2 {
  font-size: 30px;
}

.storefront-eyebrow {
  margin-bottom: 8px;
  color: #79576e;
  font-size: 12px;
  letter-spacing: 0.14em;
}

.storefront-description {
  max-width: 760px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.storefront-contact {
  margin: 20px 0 0;
  overflow-wrap: anywhere;
}

.storefront-listings {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.storefront-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.storefront-empty {
  padding: 40px;
  border-radius: 16px;
  background: #faf5f8;
  text-align: center;
}

.storefront-pages {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin: 32px 0;
}

@media (max-width: 900px) {
  .storefront-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .storefront-header {
    flex-direction: column;
    padding: 24px;
  }

  .storefront-grid {
    grid-template-columns: 1fr;
  }
}
</style>