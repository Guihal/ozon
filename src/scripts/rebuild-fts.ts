/**
 * Ручная перестройка FTS индекса
 * Запуск: bun run db:rebuild-fts
 */
import { Database } from "bun:sqlite";
import { join } from "path";

const DB_FILE = join(__dirname, "..", "cache", "ozon.db");

const db = new Database(DB_FILE, { strict: true });

console.log("🔄 Перестройка FTS индекса...");

db.run(`
  INSERT INTO pickup_points_fts(pickup_points_fts)
  VALUES ('rebuild')
`);

const count = (
  db.prepare("SELECT COUNT(*) as count FROM pickup_points_fts").get() as {
    count: number;
  }
).count;

console.log(`✅ FTS индекс перестроен (${count} записей)`);

db.close();
