const mongoose = require("mongoose");
const piece = new mongoose.Schema(
  {
    itemId: String,
    productId: String,
    name: String,
    category: String,
    colour: String,
    style: [String],
    occasions: [String],
    source: { type: String, enum: ["wardrobe", "store"] },
    price: Number,
  },
  { _id: false },
);
const schema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 80 },
    occasion: { type: String, required: true },
    eventDate: String,
    pieces: [piece],
  },
  { timestamps: true, collection: "saved_outfits" },
);
schema.index({ userId: 1, createdAt: -1 });
module.exports =
  mongoose.models.SavedOutfit || mongoose.model("SavedOutfit", schema);
