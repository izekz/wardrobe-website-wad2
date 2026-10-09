const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { createCommunityRouter, defaultModels } = require("./routes/community");
// Person 4: business portal + store product catalogue.
const { createBusinessRouter, createCatalogRouter, defaultModels: businessModels } = require("./routes/business");

const authRoutes = require('./routes/authRoutes');
const { createWardrobeRouter } = require('./routes/wardrobeRoutes');
const WardrobeItem = require('./models/WardrobeItem');
const SavedOutfit = require('./models/SavedOutfit');
const surveyRoutes = require('./routes/surveyRoutes');
const { loadUser, requireAuth } = require('./middleware/authentication');
const User = require('./models/User');
const AuthSession = require('./models/AuthSession');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  credentials: true
}));

// Restore verified account identity before auth and Community endpoints.
app.use('/api', loadUser);
app.use('/api/auth', express.json({ limit: '16kb' }), authRoutes);
// Every application API below this point requires a verified account.
app.use('/api', requireAuth);
app.use('/api/wardrobe', express.json({ limit: '8mb' }), createWardrobeRouter());
app.use('/api/survey', express.json({ limit: '16kb' }), surveyRoutes);
app.use("/api/community", express.json({ limit: "8mb" }), createCommunityRouter());
app.use("/api/business", express.json({ limit: "8mb" }), createBusinessRouter());
app.use("/api/catalog", express.json({ limit: "16kb" }), createCatalogRouter());
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
    if (process.env.COMMUNITY_DEMO_MODE === 'true' && process.env.NODE_ENV === 'production') {
      throw new Error('Local demo mode cannot run in production.');
    }
    await connectDB();
    await Promise.all([WardrobeItem.init(), SavedOutfit.init(), defaultModels.Listing.init(), defaultModels.Request.init(), defaultModels.Response.init(), User.init(), AuthSession.init(),
      businessModels.Business.init(), businessModels.Product.init(), businessModels.CoinTransaction.init(), businessModels.SkipFeedback.init()]);

    const port = process.env.PORT || 3000;

    const host = process.env.COMMUNITY_DEMO_MODE === 'true' ? '127.0.0.1' : undefined;
    app.listen(port, host, () => {
      console.log(`Backend running at http://localhost:${port}`);
      if (process.env.COMMUNITY_DEMO_MODE === 'true') console.log('Community demo mode is configured, but protected API access still requires login.');
    });
  } catch (error) {
    console.error(`Backend startup failed: ${error.name}`);
    process.exit(1);
  }
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Choose a photo of 5 MB or less.' });
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: 'The submitted information could not be read.' });
  console.error('Request failed:', error.name);
  res.status(500).json({ message: 'The server could not complete the request.' });
});

startServer();