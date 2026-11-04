<script>
import { money } from '../services/catalogApi'
import { isLiked, toggleLike, shopState } from '../services/shopService'
import '../assets/styles/discover.css'
import CommunityIcon from './CommunityIcon.vue'
import ReportDialog from './ReportDialog.vue'
export default {
  components: { CommunityIcon, ReportDialog },
props: {
  product: { type: Object, required: true },
  destination: { type: Object, default: null },
  reportable: { type: Boolean, default: false },
},
  data() {
  return {
    savingLike: false,
    likeError: '',
    reportOpen: false,
  }
},
  computed:{saved(){return isLiked(this.product.productId)},canLike(){return !!shopState.ownerId},shopBusy(){return shopState.loading||shopState.pending>0||!shopState.ready},promoted(){return this.product.premium||this.product.boosted},sizes(){return this.product.sizes.slice(0,4).join(' · ')+(this.product.sizes.length>4?' …':'')}},
  methods:{money,async toggle(){if(this.savingLike)return;this.savingLike=true;this.likeError='';try{await toggleLike(this.product.productId)}catch(e){if(e.code!=='ACCOUNT_CHANGED')this.likeError=e.message}finally{this.savingLike=false}}}
}
</script>
<template>
  <article class="disc-card">
    <RouterLink :to="destination||{name:'discover-product',params:{productId:product.productId}}">
      <div class="disc-card-image"><img :src="product.imageURL" :alt="product.name" loading="lazy"/>
        <span v-if="product.stock===0" class="disc-card-label disc-card-soldout">OUT OF STOCK</span>
        <span v-else-if="promoted" class="community-tag yellow disc-card-label">PROMOTED</span>
      </div>
      <div class="disc-card-body">
        <p class="disc-store">{{product.businessName}}</p>
        <h2>{{product.name}}</h2>
        <div class="disc-card-price-row">
          <p class="disc-price">{{money(product.price)}}</p>
          <span v-if="product.stock>0&&product.stock<=3" class="disc-low-stock disc-low-stock-alert">{{product.stock}} left</span>
        </div>
        <p v-if="product.reasons?.length" class="disc-reason mb-2">
          <CommunityIcon name="check" :size="14"/>
           {{product.reasons[0]}}
          </p>
           <div class="disc-card-tags">
            <span class="community-tag pink">{{product.style}}</span>
            <span class="community-tag lilac">{{product.category}}</span>
            <span class="community-tag">{{sizes}}</span>
          </div>
        </div>
      </RouterLink>
      <button v-if="canLike" type="button" class="disc-heart" :disabled="savingLike||shopBusy" :class="{saved}" :aria-pressed="saved" :aria-label="saved?`Remove ${product.name} from liked items`:`Like ${product.name}`" @click="toggle">
        <svg width="22" height="22" viewBox="0 0 24 24" :fill="saved?'currentColor':'none'" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>
      </button>
      <p v-if="likeError" class="community-error small m-2" role="alert">
        {{likeError}}
      </p>
      <button
        v-if="reportable"
        type="button"
        class="product-report-button"
        title="Report listing"
        :aria-label="`Report listing: ${product.name}`"
        @click="reportOpen = true">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" />
        </svg>
      </button>

  <ReportDialog
    v-if="reportOpen"
    :listing-id="product.productId"
    :listing-name="product.name"
    target-type="listing"
    @close="reportOpen = false"
  />
</article>
</template>

<style scoped>
.product-report-button {
  position: absolute;
  top: 60px;
  right: 10px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #fffdfaee;
  color: #6b3a55;
  box-shadow: 0 2px 8px #0001;
  cursor: pointer;
}

.product-report-button:hover {
  background: #f6e8ef;
}

.product-report-button:focus-visible {
  outline: 2px solid #683760;
  outline-offset: 3px;
}
</style>