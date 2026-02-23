import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

type QueryResult<T = Record<string, unknown>> = {
  rows: T[];
  rowCount: number;
};

type DatabaseLike = {
  get: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T | undefined>;
  all: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  run: (sql: string, params?: unknown[]) => Promise<{ lastID?: number; rowCount: number }>;
};

let database: DatabaseLike | null = null;

function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return 'postgresql://postgres:postgres@localhost:5432/store_locator';
}

function toPgPlaceholders(sql: string) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

async function query<T = Record<string, unknown>>(pool: Pool, sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const text = toPgPlaceholders(sql);
  const result = await pool.query(text, params);
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

function buildDb(pool: Pool): DatabaseLike {
  return {
    async get<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await query<T>(pool, sql, params);
      return result.rows[0];
    },
    async all<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await query<T>(pool, sql, params);
      return result.rows;
    },
    async run(sql: string, params: unknown[] = []) {
      const isInsert = /^\s*insert\s+/i.test(sql) && !/\sreturning\s+/i.test(sql);
      const statement = isInsert ? `${sql} RETURNING id` : sql;
      const result = await query<{ id?: number }>(pool, statement, params);
      return {
        lastID: result.rows[0]?.id,
        rowCount: result.rowCount
      };
    }
  };
}

async function initSchema(pool: Pool) {
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
    'CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status)',
    'CREATE INDEX IF NOT EXISTS idx_locations_city_search ON locations(address)',
    'CREATE INDEX IF NOT EXISTS idx_locations_store_name ON locations(store_name)',
    'CREATE INDEX IF NOT EXISTS idx_locations_category ON locations(category)'
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }
}

export async function getDb() {
  if (database) return database;

  const sslEnabled = process.env.DATABASE_SSL === 'true';
  const pool = new Pool({
    connectionString: connectionString(),
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  });

  await initSchema(pool);
  database = buildDb(pool);
  await ensureDefaultAdmin(database);
  return database;
}

async function ensureDefaultAdmin(db: DatabaseLike) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await db.get('SELECT id FROM admins LIMIT 1');
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
}
