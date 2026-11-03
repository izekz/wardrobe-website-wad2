<script>
import '../../assets/styles/discover.css'
import { catalogApi, money } from '../../services/catalogApi'
import { authState } from '../../services/authService'
import { isLiked, toggleLike, addToCart, shopState } from '../../services/shopService'
import CommunityIcon from '../../components/CommunityIcon.vue'
import RequestSuggestionAction from '../../components/RequestSuggestionAction.vue'
import SkipFeedback from '../../components/SkipFeedback.vue'
export default {
  components:{CommunityIcon,SkipFeedback,RequestSuggestionAction},
  data(){return{product:null,business:null,loading:true,error:'',size:'',colour:'',shoppingBusy:false,skipping:false,toast:'',loadVersion:0,activeImage:0,quantity:1}},
  computed:{saved(){return !!this.product&&isLiked(this.product.productId)},shoppingReady(){return shopState.ready&&!shopState.loading&&!shopState.pending},
    availableColours(){return this.product?.availableColours||this.product?.colours||(this.product?.colour?[this.product.colour]:[])}, isShopper(){return authState.user?.role==='consumer'}, isSuggestion(){return typeof this.$route.query.requestId==='string'&&typeof this.$route.query.responseId==='string'}, wardrobeRoute(){return this.$router.getRoutes().find(r=>['outfit-match','wardrobe-match','style-with-wardrobe'].includes(r.name))},
    gallery(){if(!this.product)return[];return[{src:this.product.imageURL,label:'Product view'},...(this.product.sizeImageURL?[{src:this.product.sizeImageURL,label:'Size guide'}]:[])]}, canCart(){return this.shoppingReady&&this.isShopper&&this.product?.stock>0&&(!this.product.sizes?.length||this.size)&&(!this.availableColours.length||this.colour)}
  },
  watch:{'$route.params.productId':{immediate:true,handler(id){if(id)this.load()}}},
  methods:{money,
    async load(){const v=++this.loadVersion;this.loading=true;this.error='';this.activeImage=0;try{const r=await catalogApi(`/products/${encodeURIComponent(this.$route.params.productId)}`);if(v!==this.loadVersion)return;this.product=r.product;this.business=r.business;this.colour=this.availableColours.length===1?this.availableColours[0]:'';if(this.product.sizes.length===1)this.size=this.product.sizes[0]}catch(e){if(v===this.loadVersion)this.error=e.message}finally{if(v===this.loadVersion)this.loading=false}},
    async save(){if(this.shoppingBusy)return;this.shoppingBusy=true;try{const liked=await toggleLike(this.product.productId);this.flash(liked?'Added to Likes.':'Removed from Likes.')}catch(e){if(e.code!=='ACCOUNT_CHANGED')this.flash(e.message)}finally{this.shoppingBusy=false}},
    async addCart(){if(this.shoppingBusy||!this.canCart)return;this.shoppingBusy=true;try{await addToCart(this.product,{size:this.size,colour:this.colour,quantity:this.quantity});this.flash('Added to cart.')}catch(e){if(e.code!=='ACCOUNT_CHANGED')this.flash(e.message)}finally{this.shoppingBusy=false}},
    styleWithWardrobe(){if(this.availableColours.length&&!this.colour){this.flash('Choose a colour first.');return}this.$router.push({name:this.wardrobeRoute.name,query:{productId:this.product.productId,...(this.colour?{colour:this.colour}:{})}})},
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
  <div v-if="isSuggestion" class="disc-option-block"><p v-if="availableColours.length" class="community-muted mb-1">Available colours: {{ availableColours.join(', ') }}</p><p class="community-muted small mb-0">Choose your size and colour once at checkout if you accept this suggestion.</p></div>
  <div v-else-if="availableColours.length" class="disc-option-block"><div class="disc-option-label"><label for="detail-colour">Colour</label><span>{{colour||'Choose one'}}</span></div><select id="detail-colour" v-model="colour" class="form-select"><option disabled value="">Choose a colour</option><option v-for="c in availableColours" :key="c">{{c}}</option></select></div>
  <fieldset v-if="!isSuggestion&&product.sizes?.length" class="disc-option-block"><div class="disc-option-label"><legend>Size</legend><button v-if="product.sizeImageURL" type="button" class="disc-size-link" @click="activeImage=1"><span class="disc-info-dot" aria-hidden="true">i</span><span>Size guide</span></button></div><div class="disc-sizes"><button v-for="item in product.sizes" :key="item" type="button" :class="{selected:size===item}" @click="size=item">{{item}}</button></div></fieldset>
  <div class="disc-stock-line"><span v-if="product.stock===0" class="disc-out-stock">Out of stock</span><span v-else-if="product.stock<=3">Only {{product.stock}} left</span><span v-else>In stock</span></div>
  <RequestSuggestionAction :product="product"/>
  <div v-if="isShopper&&!isSuggestion" class="disc-buy-row"><select v-model.number="quantity" aria-label="Quantity"><option v-for="n in Math.min(product.stock,10)" :key="n" :value="n">Qty {{n}}</option></select><button class="community-btn disc-add-cart" :disabled="!canCart||shoppingBusy" @click="addCart">Add to cart</button></div>
  <div class="disc-actions"><button v-if="wardrobeRoute&&!isSuggestion" class="community-btn community-btn-outline" @click="styleWithWardrobe"><CommunityIcon name="hanger" :size="21"/>Style with my wardrobe</button><button class="community-btn community-btn-outline" :aria-pressed="saved" :disabled="!shoppingReady||shoppingBusy" @click="save"><svg width="20" height="20" viewBox="0 0 24 24" :fill="saved?'currentColor':'none'" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>{{saved?'Liked':'Add to Likes'}}</button></div>
  <div v-if="product.reasons?.length" class="disc-why"><h2><span>✦</span> Why this was picked for you</h2><ul><li v-for="reason in product.reasons" :key="reason"><span><CommunityIcon name="check"/></span>{{reason}}</li></ul></div>
  <div v-if="isShopper" class="disc-feedback-card"><div><strong>Not quite your style?</strong><p>Your feedback improves future recommendations and helps small labels understand demand.</p></div><button class="community-btn community-btn-outline" @click="skipping=true">Tell us why</button></div>
 </div>
</div>
<SkipFeedback v-if="skipping&&product" :product="product" @close="skipping=false" @skipped="skipped"/><div v-if="toast" class="disc-toast">{{toast}}</div>
</section></template>
