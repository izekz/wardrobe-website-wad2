<script>
import { money } from '../services/catalogApi'
import { isLiked, toggleLike } from '../services/shopService'
import '../assets/styles/discover.css'
import CommunityIcon from './CommunityIcon.vue'
export default {
  components:{CommunityIcon}, props:{product:{type:Object,required:true},destination:{type:Object,default:null}},
  data(){return{saved:isLiked(this.product.productId)}},
  computed:{promoted(){return this.product.premium||this.product.boosted},sizes(){return this.product.sizes.slice(0,4).join(' · ')+(this.product.sizes.length>4?' …':'')}},
  methods:{money,toggle(){this.saved=toggleLike(this.product.productId)}}
}
</script>
<template><article class="disc-card"><RouterLink :to="destination||{name:'discover-product',params:{productId:product.productId}}"><div class="disc-card-image"><img :src="product.imageURL" :alt="product.name" loading="lazy"/><span v-if="product.stock===0" class="disc-card-label disc-card-soldout">OUT OF STOCK</span><span v-else-if="promoted" class="community-tag yellow disc-card-label">PROMOTED</span></div><div class="disc-card-body"><p class="disc-store">{{product.businessName}}</p><h2>{{product.name}}</h2><div class="disc-card-price-row"><p class="disc-price">{{money(product.price)}}</p><span v-if="product.stock>0&&product.stock<=3" class="disc-low-stock disc-low-stock-alert">{{product.stock}} left</span></div><p v-if="product.reasons?.length" class="disc-reason mb-2"><CommunityIcon name="check" :size="14"/> {{product.reasons[0]}}</p><div class="disc-card-tags"><span class="community-tag pink">{{product.style}}</span><span class="community-tag lilac">{{product.category}}</span><span class="community-tag">{{sizes}}</span></div></div></RouterLink><button type="button" class="disc-heart" :class="{saved}" :aria-pressed="saved" :aria-label="saved?`Remove ${product.name} from liked items`:`Like ${product.name}`" @click="toggle"><svg width="22" height="22" viewBox="0 0 24 24" :fill="saved?'currentColor':'none'" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg></button></article></template>

