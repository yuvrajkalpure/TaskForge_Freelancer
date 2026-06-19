require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { seedAdmin } = require('./config/seed');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const bidRoutes = require('./routes/bids');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend SPA
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', bidRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler
app.use(errorHandler);

// Start server and seed database
async function startServer(port = PORT) {
  // Seed the admin user
  await seedAdmin();

  return app.listen(port, () => {
    console.log(`==================================================`);
    console.log(`🚀 TaskForge server is running on port ${port}`);
    console.log(`👉 Access frontend at http://localhost:${port}`);
    console.log(`==================================================`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
