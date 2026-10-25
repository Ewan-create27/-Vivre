import { Pool, type QueryResultRow } from "pg";

type DatabaseGlobal = typeof globalThis & {
  aVivrePool?: Pool;
  aVivreSchemaPromise?: Promise<void>;
};

const databaseGlobal = globalThis as DatabaseGlobal;

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL est manquant.");
  return value;
}

function pool() {
  if (!databaseGlobal.aVivrePool) {
    const connectionString = databaseUrl();
    const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
    databaseGlobal.aVivrePool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return databaseGlobal.aVivrePool;
}

async function ensureSchema() {
  if (!databaseGlobal.aVivreSchemaPromise) {
    databaseGlobal.aVivreSchemaPromise = (async () => {
      await pool().query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          avatar_color TEXT NOT NULL DEFAULT '#C98768',
          password_hash TEXT NOT NULL,
          birth_date TEXT,
          gender TEXT NOT NULL DEFAULT 'unspecified',
          lifespan_years INTEGER NOT NULL DEFAULT 83,
          avatar_url TEXT,
          avatar_key TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS wishes (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT 'À vivre',
          color TEXT NOT NULL DEFAULT 'terracotta',
          status TEXT NOT NULL DEFAULT 'dreaming',
          progress INTEGER NOT NULL DEFAULT 0,
          next_step TEXT NOT NULL DEFAULT '',
          target_date TEXT,
          completed_at TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          wish_id TEXT NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
          owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          asset_url TEXT NOT NULL,
          asset_key TEXT,
          kind TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          caption TEXT NOT NULL DEFAULT '',
          size_bytes INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS password_resets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          code_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS sessions_user_expires_idx ON sessions(user_id, expires_at);
        CREATE INDEX IF NOT EXISTS wishes_owner_sort_idx ON wishes(owner_id, sort_order);
        CREATE INDEX IF NOT EXISTS memories_wish_created_idx ON memories(wish_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id, expires_at);
      `);
    })().catch((error) => {
      databaseGlobal.aVivreSchemaPromise = undefined;
      throw error;
    });
  }
  await databaseGlobal.aVivreSchemaPromise;
}

export async function dbQuery<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  await ensureSchema();
  return pool().query<Row>(text, values);
}
