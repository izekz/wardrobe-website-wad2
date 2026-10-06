const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
}));

app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    await mongoose.connection.db.command({ ping: 1 });

    res.json({
      status: "ok",
      database: mongoose.connection.name
    });
  } catch {
    res.status(503).json({
      status: "error",
      message: "Database unavailable"
    });
  }
});

async function startServer() {
  try {
    await connectDB();

    const port = process.env.PORT || 3000;

    app.listen(port, () => {
      console.log(`Backend running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error(`Backend startup failed: ${error.name}`);
    process.exit(1);
  }
}

startServer();  