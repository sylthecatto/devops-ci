require('dotenv').config();

const os = require('os');
const path = require('path');
const express = require('express');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const db = require('./db');

const app = express();

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 },
  })
);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Surfaces what Jenkins/K8s injected at build/deploy time, so the running
// app can be visually confirmed as the right image on the right environment.
app.get('/api/meta', (req, res) => {
  res.json({
    buildVersion: process.env.APP_VERSION || 'unknown',
    environment: process.env.ENVIRONMENT || 'local',
    hostname: process.env.HOSTNAME || os.hostname(),
  });
});

app.use('/api', authRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  db.init()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database schema', err);
      process.exit(1);
    });
}

module.exports = app;
