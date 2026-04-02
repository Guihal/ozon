import { Database } from "bun:sqlite";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

// Путь к файлу базы данных
const DB_DIR = join(__dirname, "..", "cache");
const DB_FILE = join(DB_DIR, "ozon.db");

/**
 * Инициализация базы данных
 */
function initDatabase(): Database {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_FILE, { create: true, strict: true });

  // Включаем WAL для производительности
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA synchronous = NORMAL;");
  db.run("PRAGMA cache_size = -64000;"); // 64MB cache
  db.run("PRAGMA temp_store = MEMORY;");

  // Создаём таблицы
  db.run(`
    CREATE TABLE IF NOT EXISTS pickup_points (
      map_point_id INTEGER PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      street TEXT NOT NULL DEFAULT '',
      house TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 0,
      long REAL NOT NULL DEFAULT 0,
      location_id TEXT NOT NULL DEFAULT '',
      delivery_type_id INTEGER NOT NULL DEFAULT 0,
      delivery_type_name TEXT NOT NULL DEFAULT '',
      fitting_rooms_count INTEGER NOT NULL DEFAULT 0,
      pvz_rating REAL NOT NULL DEFAULT 0,
      storage_period INTEGER NOT NULL DEFAULT 0,
      working_hours TEXT NOT NULL DEFAULT '[]',
      properties TEXT NOT NULL DEFAULT '[]',
      images TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Индексы для быстрого поиска
  db.run("CREATE INDEX IF NOT EXISTS idx_pp_city ON pickup_points(city)");
  db.run("CREATE INDEX IF NOT EXISTS idx_pp_enabled ON pickup_points(enabled)");
  db.run("CREATE INDEX IF NOT EXISTS idx_pp_region ON pickup_points(region)");

  console.log("✅ SQLite база данных инициализирована:", DB_FILE);

  return db;
}

// Синглтон базы данных
export const db = initDatabase();
