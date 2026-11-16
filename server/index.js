const dns = require('node:dns');
const os = require('node:os');

// Force IPv4 lookup globally across the Node.js process
dns.setDefaultResultOrder('ipv4first');

// In environments without outbound IPv6 routing (e.g. Render, Docker containers, some ISPs),
// having an IPv6 interface causes libraries like Nodemailer to query AAAA records and fail
// with "connect ENETUNREACH 2607:f8b0:... - Local (:::0)". Filter out IPv6 interfaces.
const origNetworkInterfaces = os.networkInterfaces;
os.networkInterfaces = function () {
  const ifaces = origNetworkInterfaces.apply(this, arguments);
  const ipv4Only = {};
  for (const [name, addrs] of Object.entries(ifaces || {})) {
    ipv4Only[name] = (addrs || []).filter(a => a.family === 'IPv4' || a.family === 4);
  }
  return ipv4Only;
};

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { connectPostgres } = require('./db');
const { ensureDefaultAdmin, ensureDataIntegrity } = require('./utils/integrity');
const apiRoutes = require('./routes');

// Sharada School Backend API Server

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Mount central API router on both /api and /web/api for subpath hosting
app.use('/api', apiRoutes);
app.use('/web/api', apiRoutes);

// Static client assets (served if built client exists, or friendly API status if hosted separately)
const clientPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientPath)) {
  // Serve static assets on both /web and root
  app.use('/web', express.static(clientPath));
  app.use(express.static(clientPath));

  app.use((req, res, next) => {
    if (
      req.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/web/api')
    ) {
      if (req.path === '/') {
        return res.redirect('/web');
      }
      return res.sendFile(path.join(clientPath, 'index.html'));
    }
    next();
  });
} else {
  app.get('/', (_, res) => res.redirect('/web'));
  app.get('/web', (_, res) => {
    res.json({ message: 'Sharada School API Server running', status: 'healthy', version: '1.0.0' });
  });
}

const port = process.env.PORT || 4000;

let lastDbError = null;

// Start Express server immediately so endpoints are always reachable
app.listen(port, () => {
  console.log(`🚀 API server is listening on http://localhost:${port}`);
  
  // Connect to PostgreSQL in the background
  connectPostgres()
    .then(async () => {
      lastDbError = null;
      await ensureDefaultAdmin();
      await ensureDataIntegrity();
      console.log(`✅ Database fully initialized and ready!`);
    })
    .catch((error) => {
      lastDbError = error;
      console.error('❌ PostgreSQL connection failed on startup:');
      console.error('Message:', error.message);
      console.error('Code:', error.code || 'N/A');
      console.error('Hint: Please verify DATABASE_URL in Web/server/.env');
    });
});

// Attach last error to app so health check can read it
app.locals.getLastDbError = () => lastDbError;

module.exports = app;
