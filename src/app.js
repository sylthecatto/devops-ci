require('dotenv').config();

const os = require('os');
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const authRoutes = require('./routes/auth');
const db = require('./db');

const app = express();

app.use(express.json());

// Sessions live in Postgres, not in process memory. The app runs with more
// than one replica behind a single Service, so a login handled by one pod
// must stay valid on requests the load balancer sends to any other pod.
// Tests run in a single process against a mocked db, so they use the
// in-memory default instead of reaching for a real connection pool.
const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 },
};

if (db.pool) {
  sessionOptions.store = new pgSession({ pool: db.pool, tableName: 'user_sessions' });
}

app.use(session(sessionOptions));

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
