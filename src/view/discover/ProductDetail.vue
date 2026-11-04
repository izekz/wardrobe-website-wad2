<script>
import '../../assets/styles/discover.css'
import { catalogApi, money } from '../../services/catalogApi'
import { authState } from '../../services/authService'
import { isLiked, toggleLike, addToCart, shopState } from '../../services/shopService'
import { plannerProductsState, hydratePlannerProducts, addPlannerProduct, storeVariantKey } from '../../services/wardrobeService'
import CommunityIcon from '../../components/CommunityIcon.vue'
import RequestSuggestionAction from '../../components/RequestSuggestionAction.vue'
import SkipFeedback from '../../components/SkipFeedback.vue'
import ReportDialog from '../../components/ReportDialog.vue'
export default {
  components:{CommunityIcon,SkipFeedback,RequestSuggestionAction,ReportDialog},
  data(){return{reportOpen:false,product:null,business:null,loading:true,error:'',size:'',colour:'',shoppingBusy:false,skipping:false,toast:'',cartSelectionNotice:'',plannerBusy:false,plannerMessage:'',plannerError:'',loadVersion:0,activeImage:0,quantity:1}},
  computed:{plannerState(){return plannerProductsState},
    plannerAdded(){return !!this.product&&plannerProductsState.products.some(piece=>piece.available&&storeVariantKey(piece)===storeVariantKey({productId:this.product.productId,colour:this.colour,size:this.size}))},
    canPlan(){return this.isShopper&&this.selectedStock>0&&(!this.product.sizes?.length||this.size)&&(!this.availableColours.length||this.colour)},
    saved(){return !!this.product&&isLiked(this.product.productId)},shoppingReady(){return shopState.ready&&!shopState.loading&&!shopState.pending},
    availableColours(){return this.product?.availableColours||this.product?.colours||(this.product?.colour?[this.product.colour]:[])}, isShopper(){return authState.user?.role==='consumer'}, isSuggestion(){return typeof this.$route.query.requestId==='string'&&typeof this.$route.query.responseId==='string'}, wardrobeRoute(){return this.$router.getRoutes().find(r=>['outfit-match','wardrobe-match','style-with-wardrobe'].includes(r.name))},
    gallery(){if(!this.product)return[];return[{src:this.product.imageURL,label:'Product view'},...(this.product.sizeImageURL?[{src:this.product.sizeImageURL,label:'Size guide'}]:[])]}, sizeLeft(){return s=>this.product?.sizeStock?(this.product.sizeStock[s]||0):(this.product?.stock||0)}, selectedStock(){if(!this.product)return 0;return this.size?this.sizeLeft(this.size):this.product.stock},
    canCart(){return this.shoppingReady&&this.isShopper&&this.selectedStock>0&&(!this.product.sizes?.length||this.size)&&(!this.availableColours.length||this.colour)}
  },
watch: {
  '$route.params.productId': {
    immediate: true,
    handler(id) {
      this.reportOpen = false
      if (id) this.load()
    },
  },
  '$route.query': {
    deep: true,
    handler() {
      if (!this.loading && this.product?.productId === this.$route.params.productId) this.restoreSelections()
    },
  },
  size() {
    this.quantity = Math.max(
      1,
      Math.min(this.quantity, this.selectedStock, 10)
    )
  },
},
  methods:{money,
    async load(){const v=++this.loadVersion;this.loading=true;this.error='';this.activeImage=0;this.cartSelectionNotice='';this.plannerMessage='';this.plannerError='';try{const r=await catalogApi(`/products/${encodeURIComponent(this.$route.params.productId)}`);if(v!==this.loadVersion)return;this.product=r.product;this.business=r.business;this.restoreSelections();if(this.isShopper)void hydratePlannerProducts().catch(()=>{})}catch(e){if(v===this.loadVersion)this.error=e.message}finally{if(v===this.loadVersion)this.loading=false}},
    restoreSelections() {
      const sizes = this.product.sizes || []
      this.colour = this.availableColours.length === 1 ? this.availableColours[0] : ''
      this.size = sizes.length === 1 && this.sizeLeft(sizes[0]) > 0 ? sizes[0] : ''
      this.quantity = 1
      this.cartSelectionNotice = ''
      if (this.isSuggestion || this.$route.query.fromCart !== '1') return

      // URL values are only form defaults; current catalogue options and stock take priority.
      const { colour, size, quantity } = this.$route.query, notices = []
      if (colour) {
        if (typeof colour === 'string' && this.availableColours.includes(colour)) this.colour = colour
        else {
          this.colour = ''
          notices.push(`Your saved colour is no longer available.${this.availableColours.length ? ' Choose another colour.' : ''}`)
        }
      }
      if (size) {
        if (typeof size === 'string' && sizes.includes(size) && this.sizeLeft(size) > 0) this.size = size
        else {
          this.size = ''
          notices.push(`Your saved size is no longer available.${sizes.length ? ' Choose another size.' : ''}`)
        }
      }
      if (quantity != null) {
        const requested = typeof quantity === 'string' && quantity.trim() ? Number(quantity) : NaN
        if (Number.isSafeInteger(requested) && requested > 0) {
          this.quantity = Math.max(1, Math.min(requested, this.selectedStock, 10))
          if (this.quantity !== requested) notices.push('Quantity has been adjusted to the current stock limit.')
        } else notices.push('Your saved quantity could not be used. Please review the quantity.')
      }
      this.cartSelectionNotice = notices.join(' ')
    },
    async save(){if(this.shoppingBusy)return;this.shoppingBusy=true;try{const liked=await toggleLike(this.product.productId);this.flash(liked?'Added to Likes.':'Removed from Likes.')}catch(e){if(e.code!=='ACCOUNT_CHANGED')this.flash(e.message)}finally{this.shoppingBusy=false}},
    async addCart(){if(this.shoppingBusy||!this.canCart)return;this.shoppingBusy=true;try{await addToCart(this.product,{size:this.size,colour:this.colour,quantity:this.quantity});this.flash('Added to cart.')}catch(e){if(e.code!=='ACCOUNT_CHANGED')this.flash(e.message)}finally{this.shoppingBusy=false}},
    async addToPlanner(){
      if(this.plannerBusy||!this.canPlan)return;
      const version=this.loadVersion,productId=this.product.productId,colour=this.colour,size=this.size;
      this.plannerBusy=true;this.plannerMessage='';this.plannerError='';
      try{
        await addPlannerProduct(this.product,{colour,size});
        if(version===this.loadVersion&&this.product?.productId===productId&&this.colour===colour&&this.size===size)this.plannerMessage='Added to your planner.';
      }catch(error){if(version===this.loadVersion&&error.code!=='ACCOUNT_CHANGED')this.plannerError=error.message}
      finally{this.plannerBusy=false}
    },
    flash(m){this.toast=m;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toast='',2600)},
    async skipped(){this.skipping=false;try{const next=(await catalogApi('/products?forYou=true')).products.find(p=>p.productId!==this.product.productId);if(next){await this.$router.push({name:'discover-product',params:{productId:next.productId}});this.flash('Thanks! We will adjust your recommendations!');return}}catch{}await this.$router.push({name:'discover'})}
  },beforeUnmount(){clearTimeout(this.toastTimer)}
}
</script>
<template><section>
<nav class="disc-breadcrumb"><RouterLink :to="{name:'discover'}">Discover</RouterLink><span>/</span><template v-if="product"><span>{{product.businessName}}</span><span>/</span><span>{{product.name}}</span></template></nav>
<p v-if="loading" class="community-loading">Loading this piece…</p><div v-else-if="error" class="community-error">{{error}}</div>
<div v-else-if="product" class="disc-detail">
 <div class="disc-gallery"><div class="disc-gallery-stage"><img :src="gallery[activeImage].src" :alt="activeImage===1?`${product.name} size guide`:product.name"/><span v-if="gallery.length>1&&activeImage===0" class="disc-size-hint"><strong>Size guide included</strong><small>View image 2 for measurements</small></span></div><div v-if="gallery.length>1" class="disc-gallery-thumbs"><button v-for="(img,i) in gallery" :key="img.src" :class="{active:activeImage===i}" @click="activeImage=i"><img :src="img.src" :alt="img.label"/><span>{{img.label}}</span></button></div></div>
 <div class="disc-detail-copy">
  <RouterLink class="disc-store-link" :to="{name:'discover-business',params:{businessId:product.businessId}}">{{product.businessName}}</RouterLink><h1>{{product.name}}</h1><p class="disc-detail-price">{{money(product.price)}}</p>
  <div class="disc-detail-tags"><span class="community-tag pink">{{product.style}}</span><span v-for="o in product.occasions" :key="o" class="community-tag lilac">{{o}}</span></div><p class="disc-detail-desc">{{product.description}}</p>

  <p v-if="cartSelectionNotice" class="checkout-demo-note" role="status">{{ cartSelectionNotice }}</p>
  <div v-if="isSuggestion" class="disc-option-block"><p v-if="availableColours.length" class="community-muted mb-1">Available colours: {{ availableColours.join(', ') }}</p><p class="community-muted small mb-0">Choose your size and colour once at checkout if you accept this suggestion.</p></div>
  <div v-else-if="availableColours.length" class="disc-option-block"><div class="disc-option-label"><label for="detail-colour">Colour</label><span>{{colour||'Choose one'}}</span></div><select id="detail-colour" v-model="colour" class="form-select"><option disabled value="">Choose a colour</option><option v-for="c in availableColours" :key="c">{{c}}</option></select></div>
  <fieldset v-if="!isSuggestion&&product.sizes?.length" class="disc-option-block"><div class="disc-option-label"><legend>Size</legend><button v-if="product.sizeImageURL" type="button" class="disc-size-link" @click="activeImage=1"><span class="disc-info-dot" aria-hidden="true">i</span><span>Size guide</span></button></div><div class="disc-sizes"><button v-for="item in product.sizes" :key="item" type="button" :class="{selected:size===item,'size-sold-out':sizeLeft(item)===0}" :disabled="sizeLeft(item)===0" :aria-label="sizeLeft(item)===0?`${item}, sold out`:item" @click="size=item">{{item}}<small v-if="sizeLeft(item)===0">Sold out</small></button></div></fieldset>
  <div class="disc-stock-line"><span v-if="product.stock===0" class="disc-out-stock">Out of stock</span><span v-else-if="size&&selectedStock===0" class="disc-out-stock">Size {{size}} is sold out</span><span v-else-if="selectedStock<=3">Only {{selectedStock}} left{{size?` in size ${size}`:''}}</span><span v-else>In stock</span></div>
  <RequestSuggestionAction :product="product"/>

<button
  v-if="isShopper"
  type="button"
  class="detail-report-button"
  @click="reportOpen = true"
>
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
    <path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>
  </svg>
  Report listing
</button>

<ReportDialog
  v-if="reportOpen"
  :key="product.productId"
  :listing-id="product.productId"
  :listing-name="product.name"
  target-type="listing"
  @close="reportOpen = false"
/>
  <div v-if="isShopper&&!isSuggestion" class="disc-buy-row"><select v-model.number="quantity" aria-label="Quantity"><option v-for="n in Math.min(selectedStock,10)" :key="n" :value="n">Qty {{n}}</option></select><button class="community-btn disc-add-cart" :disabled="!canCart||shoppingBusy" @click="addCart">Add to cart</button></div>
  <div class="disc-actions"><div v-if="wardrobeRoute&&isShopper&&!isSuggestion" class="disc-planner-action">
    <button type="button" class="community-btn community-btn-outline" :disabled="!canPlan||plannerBusy||plannerState.pending>0||plannerAdded" @click="addToPlanner"><CommunityIcon name="hanger" :size="21"/>{{plannerBusy?'Adding…':plannerAdded?'Added to Outfit Planner':'Add to Outfit Planner'}}</button>
    <p class="community-muted small mb-0 mt-2">See how this piece works with clothes you already own.</p>
    <p v-if="plannerMessage" role="status" class="small mt-2 mb-0">{{plannerMessage}}</p>
    <p v-if="plannerError" role="alert" class="community-error small mt-2 mb-0">{{plannerError}}</p>
    <RouterLink v-if="plannerState.products.length" :to="{name:wardrobeRoute.name}" class="disc-view-planner">View planner <CommunityIcon name="arrow" :size="15"/></RouterLink>
  </div><button class="community-btn community-btn-outline" :aria-pressed="saved" :disabled="!shoppingReady||shoppingBusy" @click="save"><svg width="20" height="20" viewBox="0 0 24 24" :fill="saved?'currentColor':'none'" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>{{saved?'Liked':'Add to Likes'}}</button></div>


  <div v-if="product.reasons?.length" class="disc-why"><h2><span>✦</span> Why this was picked for you</h2><ul><li v-for="reason in product.reasons" :key="reason"><span><CommunityIcon name="check"/></span>{{reason}}</li></ul></div>
  <div v-if="isShopper" class="disc-feedback-card"><div><strong>Not quite your style?</strong><p>Your feedback improves future recommendations and helps small labels understand demand.</p></div><button class="community-btn community-btn-outline" @click="skipping=true">Tell us why</button></div>
 </div>
</div>
<SkipFeedback v-if="skipping&&product" :product="product" @close="skipping=false" @skipped="skipped"/><div v-if="toast" class="disc-toast">{{toast}}</div>
</section></template>

<style scoped>
.disc-planner-action{min-width:0;flex:1}
.disc-planner-action>.community-btn{width:100%}
.disc-view-planner{display:inline-flex;align-items:center;gap:8px;margin-top:10px;text-decoration:underline!important;text-underline-offset:3px;font-size:13px}

.disc-sizes button.size-sold-out {
  display: inline-grid;
  place-items: center;
  line-height: 1.1;
  opacity: .5;
  text-decoration: line-through;
  cursor: not-allowed;
}

.disc-sizes button.size-sold-out small {
  font-size: 10px;
  text-decoration: none;
}

.detail-report-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 12px;
  padding: 6px 0;
  border: none;
  background: transparent;
  color: #806f78;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.detail-report-button:hover {
  color: #683760;
}

.detail-report-button:focus-visible {
  outline: 2px solid #683760;
  outline-offset: 3px;
  border-radius: 3px;
}
</style>