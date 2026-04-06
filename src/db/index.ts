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
  db.run("PRAGMA cache_size = -16000;"); // 16MB cache
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

  // Составной индекс для быстрого поиска по координатам
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_pp_coords ON pickup_points(lat, long)",
  );

  // Виртуальная FTS5 таблица для полнотекстового поиска
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS pickup_points_fts
    USING fts5(
      map_point_id UNINDEXED,
      name,
      address,
      city,
      region,
      content='pickup_points',
      content_rowid='map_point_id'
    )
  `);

  // Триггеры для синхронизации FTS при INSERT/UPDATE/DELETE
  db.run(`
    CREATE TRIGGER IF NOT EXISTS pp_fts_insert
    AFTER INSERT ON pickup_points BEGIN
      INSERT INTO pickup_points_fts(rowid, map_point_id, name, address, city, region)
      VALUES (new.map_point_id, new.map_point_id, new.name, new.address, new.city, new.region);
    END
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS pp_fts_update
    AFTER UPDATE ON pickup_points BEGIN
      INSERT INTO pickup_points_fts(pickup_points_fts, rowid, map_point_id, name, address, city, region)
      VALUES ('delete', old.map_point_id, old.map_point_id, old.name, old.address, old.city, old.region);
      INSERT INTO pickup_points_fts(rowid, map_point_id, name, address, city, region)
      VALUES (new.map_point_id, new.map_point_id, new.name, new.address, new.city, new.region);
    END
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS pp_fts_delete
    AFTER DELETE ON pickup_points BEGIN
      INSERT INTO pickup_points_fts(pickup_points_fts, rowid, map_point_id, name, address, city, region)
      VALUES ('delete', old.map_point_id, old.map_point_id, old.name, old.address, old.city, old.region);
    END
  `);

  console.log("✅ SQLite база данных инициализирована:", DB_FILE);

  // Таблица маппинга SKU: Tilda externalid → Ozon sku + offer_id
  db.run(`
    CREATE TABLE IF NOT EXISTS sku_mapping (
      tilda_externalid TEXT PRIMARY KEY,
      ozon_sku INTEGER NOT NULL,
      ozon_offer_id TEXT NOT NULL,
      product_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Таблица заказов для отслеживания
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tilda_order_id TEXT NOT NULL,
      ozon_order_number TEXT,
      ozon_postings TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      buyer_name TEXT,
      buyer_phone TEXT,
      buyer_email TEXT,
      delivery_type TEXT,
      delivery_address TEXT,
      items_json TEXT,
      webhook_body TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_orders_tilda ON orders(tilda_order_id)",
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_orders_ozon ON orders(ozon_order_number)",
  );

  return db;
}

// Синглтон базы данных
export const db = initDatabase();
