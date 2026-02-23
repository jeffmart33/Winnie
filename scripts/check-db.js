require('dotenv').config();

const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/store_locator';
  const sslEnabled = process.env.DATABASE_SSL === 'true';

  const pool = new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  });

  try {
    const result = await pool.query('SELECT current_database() AS db, now() AS now');
    const row = result.rows[0];
    console.log(`PostgreSQL reachable: db=${row.db}, now=${row.now.toISOString()}`);
    process.exit(0);
  } catch (error) {
    console.error('PostgreSQL not reachable.');
    console.error(`DATABASE_URL=${connectionString}`);
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
