import Wardrobe from "../view/wardrobe/Wardrobe.vue";
import ClothingForm from "../view/wardrobe/ClothingForm.vue";
import OutfitMatch from "../view/wardrobe/OutfitMatch.vue";
export default [
  { path: "/wardrobe", name: "wardrobe", component: Wardrobe },
  { path: "/wardrobe/saved", name: "saved-outfits", component: Wardrobe },
  { path: "/wardrobe/new", name: "wardrobe-new", component: ClothingForm },
  {
    path: "/wardrobe/items/:id/edit",
    name: "wardrobe-edit",
    component: ClothingForm,
  },
  { path: "/outfit-planner", name: "outfit-match", component: OutfitMatch },
  { path: "/wardrobe/planner", redirect: "/outfit-planner" },
];
