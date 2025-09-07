require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { orkesConductorClient } = require('@io-orkes/conductor-javascript');
const connectDB = require('./config/db');
const startWorkers = require('./worker');
const routes = require('./routes');

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Connect DB
connectDB();

// Initialize Orkes client and pass to routes
const initializeServer = async () => {
  try {
    const orkesClient = await orkesConductorClient({
      keyId: process.env.ORKES_KEY_ID,
      keySecret: process.env.ORKES_KEY_SECRET,
      serverUrl: process.env.ORKES_SERVER_URL,
    });
    console.log('✅ Orkes Conductor Client connected');

    // Make orkesClient available in routes
    app.use((req, res, next) => {
      req.orkesClient = orkesClient;
      next();
    });

    // Routes
    app.use('/', routes);

    // Start server
    app.listen(port, () => {
      console.log(`🚀 ChainCV backend running on http://localhost:${port}`);
      startWorkers(orkesClient);
    });
  } catch (err) {
    console.error('❌ Failed to initialize server:', err);
    process.exit(1);
  }
};

initializeServer();
