const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    size: { type: String, maxlength: 20 },
    sourceProductId: String,
    purchaseId: String,
    name: { type: String, required: true, trim: true, maxlength: 80 },
    category: {
      type: String,
      enum: ["Tops", "Bottoms", "Jackets", "Dresses", "Shoes", "Accessories"],
      required: true,
    },
    colour: { type: String, required: true, maxlength: 30 },
    style: [String],
    material: { type: String, required: true, maxlength: 50 },
    occasions: [String],
    weather: [String],
    photo: {
      data: { type: Buffer, required: true, select: false },
      contentType: {
        type: String,
        enum: ["image/png", "image/jpeg", "image/webp"],
        required: true,
      },
    },
  },
  { timestamps: true, collection: "wardrobe_items" },
);
schema.index({ userId: 1, createdAt: -1 });
module.exports =
  mongoose.models.WardrobeItem || mongoose.model("WardrobeItem", schema);
