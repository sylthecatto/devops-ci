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
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  init,
  pool,
};
