const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

let db;

function connectionString() {
  return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/store_locator';
}

function toPgPlaceholders(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

async function query(pool, sql, params = []) {
  const text = toPgPlaceholders(sql);
  const result = await pool.query(text, params);
  return {
    rows: result.rows,
    rowCount: result.rowCount || 0
  };
}

function buildDb(pool) {
  return {
    async get(sql, params = []) {
      const result = await query(pool, sql, params);
      return result.rows[0];
    },
    async all(sql, params = []) {
      const result = await query(pool, sql, params);
      return result.rows;
    },
    async run(sql, params = []) {
      const isInsert = /^\s*insert\s+/i.test(sql) && !/\sreturning\s+/i.test(sql);
      const statement = isInsert ? `${sql} RETURNING id` : sql;
      const result = await query(pool, statement, params);
      return {
        lastID: result.rows[0] ? result.rows[0].id : undefined,
        rowCount: result.rowCount
      };
    }
  };
}

async function initSchema(pool) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      store_name TEXT NOT NULL,
      category TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      opening_hours TEXT NOT NULL,
      contact TEXT,
      google_maps_link TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS filter_applications (
      id SERIAL PRIMARY KEY,
      query TEXT,
      city TEXT,
      postal TEXT,
      category TEXT,
      radius_km INTEGER,
      center_lat DOUBLE PRECISION,
      center_lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status)',
    'CREATE INDEX IF NOT EXISTS idx_locations_city_search ON locations(address)',
    'CREATE INDEX IF NOT EXISTS idx_locations_store_name ON locations(store_name)',
    'CREATE INDEX IF NOT EXISTS idx_locations_category ON locations(category)',
    'CREATE INDEX IF NOT EXISTS idx_filter_applications_created_at ON filter_applications(created_at)'
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function ensureDefaultAdmin(database) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await database.get('SELECT id FROM admins LIMIT 1');
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await database.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, passwordHash]);

  console.log(`Default admin created: ${username}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('Using default admin password (ChangeMe123!). Set ADMIN_PASSWORD in .env for staging/production.');
  }
}

async function getDb() {
  if (db) return db;

  const sslEnabled = process.env.DATABASE_SSL === 'true';
  const pool = new Pool({
    connectionString: connectionString(),
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  });

  await waitForPostgres(pool);
  await initSchema(pool);
  db = buildDb(pool);
  await ensureDefaultAdmin(db);
  return db;
}

async function waitForPostgres(pool) {
  const retries = Number(process.env.DB_CONNECT_RETRIES || 10);
  const delayMs = Number(process.env.DB_CONNECT_DELAY_MS || 1500);

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const message = lastError && lastError.message ? lastError.message : 'Unknown database connection error';
  throw new Error(`Unable to connect to PostgreSQL after ${retries} attempts: ${message}`);
}

module.exports = { getDb };
