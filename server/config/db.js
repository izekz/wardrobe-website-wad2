const mongoose = require("mongoose");

async function connectDB() {
  if (!process.env.DB) {
    throw new Error("MONGODB_URI is missing from server/.env");
  }

  await mongoose.connect(process.env.DB, {
    serverSelectionTimeoutMS: 10000
  });

  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}

module.exports = connectDB;