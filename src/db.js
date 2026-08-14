const { Pool } = require('pg');

// No explicit config: node-postgres reads PGHOST, PGPORT, PGUSER,
// PGPASSWORD, PGDATABASE from the environment automatically.
const pool = new Pool();

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Schema required by connect-pg-simple for the shared session store.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      sid VARCHAR NOT NULL PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions (expire)`
  );
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  init,
  pool,
};
