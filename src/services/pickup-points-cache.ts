import {
  getPickupPointsList,
  getPickupPointsInfo,
} from "./ozon-logistics/delivery";
import { ozonConfig } from "../config/env";
import { db } from "../db";
import type {
  PickupPointItem,
  PickupPointInfoItem,
  TildaPickupPoint,
} from "./ozon-logistics/types";

// Настройки обновления
const UPDATE_HOUR = 14; // Обновление в 14:00
const BATCH_SIZE = 100; // Размер пачки для запросов

// Таймер для ежедневного обновления
let dailyUpdateTimer: NodeJS.Timeout | null = null;

// Подготавливаем запросы один раз
const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO pickup_points (
    map_point_id, enabled, name, address, city, region, street, house,
    description, lat, long, location_id, delivery_type_id, delivery_type_name,
    fitting_rooms_count, pvz_rating, storage_period, working_hours, properties, images
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?
  )
`);

const countStmt = db.prepare("SELECT COUNT(*) as count FROM pickup_points");
const lastUpdateStmt = db.prepare(
  "SELECT MAX(updated_at) as last_update FROM pickup_points",
);

// Тип для строки из БД
interface PickupPointRow {
  map_point_id: number;
  enabled: number;
  name: string;
  address: string;
  city: string;
  region: string;
  street: string;
  house: string;
  description: string;
  lat: number;
  long: number;
  location_id: string;
  delivery_type_id: number;
  delivery_type_name: string;
  fitting_rooms_count: number;
  pvz_rating: number;
  storage_period: number;
  working_hours: string;
  properties: string;
  images: string;
  updated_at: string;
}

/**
 * Сохраняет одну точку в БД (для batch-by-batch записи)
 */
function insertPoint(point: PickupPointInfoItem): void {
  const dm = point.delivery_method;
  const { lat, long } = dm.coordinates;

  insertStmt.run(
    dm.map_point_id,
    point.enabled ? 1 : 0,
    dm.name,
    dm.address,
    dm.address_details.city,
    dm.address_details.region,
    dm.address_details.street,
    dm.address_details.house,
    dm.description,
    lat,
    long,
    dm.location_id,
    dm.delivery_type.id,
    dm.delivery_type.name,
    dm.fitting_rooms_count,
    dm.pvz_rating,
    dm.storage_period,
    JSON.stringify(dm.working_hours),
    JSON.stringify(dm.properties),
    JSON.stringify(dm.images),
  );
}

/**
 * Сохраняет массив точек в базу данных (транзакцией)
 * Используется только для совместимости, предпочтительнее fetchAndSaveBatch
 */
function savePointsToDb(points: PickupPointInfoItem[]): void {
  const total = points.length;
  console.log(`💾 Сохранение ${total} точек в SQLite...`);

  const insertMany = db.transaction((items: PickupPointInfoItem[]) => {
    for (const point of items) {
      insertPoint(point);
    }
  });

  insertMany(points);
  console.log(`✅ Сохранено ${total} точек в SQLite`);
}

/**
 * Получает детальную информацию о всех точках пачками
 * и СОХРАНЯЕТ В БД ПО МЕРЕ ПОЛУЧЕНИЯ (не копит в памяти)
 */
async function fetchAllPointsInfo(points: PickupPointItem[]): Promise<void> {
  const totalPoints = points.length;
  const batches = Math.ceil(totalPoints / BATCH_SIZE);
  let totalSaved = 0;

  console.log(
    `🔄 Получение детальной информации: ${totalPoints} точек, ${batches} пачек`,
  );

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, totalPoints);
    const batchIds = points
      .slice(start, end)
      .map((p) => p.map_point_id.toString());

    try {
      console.log(`📦 Пачка ${i + 1}/${batches} (точки ${start + 1}-${end})`);

      const response = await getPickupPointsInfo(batchIds);

      // Сохраняем пачку сразу в БД транзакцией — НЕ копим в памяти
      const saveBatch = db.transaction((items: PickupPointInfoItem[]) => {
        for (const point of items) {
          insertPoint(point);
        }
      });
      saveBatch(response.points);
      totalSaved += response.points.length;

      // Даём GC собрать response.points
      // Пауза между запросами
      if (i < batches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`❌ Ошибка пачки ${i + 1}/${batches}:`, error);
    }
  }

  console.log(`✅ Сохранено ${totalSaved} из ${totalPoints} точек в SQLite`);
}

/**
 * Маппинг строки БД в формат Tilda
 */
function mapRowToTilda(row: PickupPointRow): TildaPickupPoint {
  let workTime = "";
  try {
    const hours: Array<{
      periods: Array<{
        min: { hours: number; minutes: number };
        max: { hours: number; minutes: number };
      }>;
    }> = JSON.parse(row.working_hours);

    workTime =
      hours
        .slice(0, 1)
        .flatMap((wh) =>
          wh.periods.map(
            (p) =>
              `${String(p.min.hours).padStart(2, "0")}:${String(p.min.minutes).padStart(2, "0")}` +
              `–` +
              `${String(p.max.hours).padStart(2, "0")}:${String(p.max.minutes).padStart(2, "0")}`,
          ),
        )
        .join(", ") || "";
  } catch {
    workTime = "";
  }

  return {
    id: String(row.map_point_id),
    name: row.name,
    address: row.address,
    coordinates: [row.lat, row.long],
    workTime,
    phones: [],
    addressComment: row.description,
    cash: "n",
    postalCode: "",
  };
}

/**
 * Получает ПВЗ из базы с простым текстовым поиском и пагинацией
 */
export function getTildaPickupPoints(options?: {
  q?: string;
  limit?: number;
  offset?: number;
}): {
  pvz: TildaPickupPoint[];
  total: number;
  limit: number;
  offset: number;
} {
  const { q, limit = 500, offset = 0 } = options || {};

  let rows: PickupPointRow[];
  let total: number;

  if (q) {
    // 1. Очистка строки: оставляем только буквы, цифры и пробелы
    // Это удалит дефисы, скобки и прочие спецсимволы FTS5
    const sanitizedQ = q.replace(/[^\w\sа-яА-ЯёЁ]/gi, " ").trim();

    // Если после очистки что-то осталось
    if (sanitizedQ.length > 0) {
      // 2. Формируем запрос для MATCH
      // Разделяем по пробелам и добавляем * к каждому слову для поиска по префиксу
      const ftsQuery = sanitizedQ
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .map((w) => `${w}*`)
        .join(" ");

      const ftsRows = db
        .prepare(
          `
          SELECT p.*
          FROM pickup_points p
          JOIN pickup_points_fts f ON f.map_point_id = p.map_point_id
          WHERE f.pickup_points_fts MATCH ?
            AND p.enabled = 1
          ORDER BY rank
          LIMIT ? OFFSET ?
        `,
        )
        .all(ftsQuery, limit, offset) as PickupPointRow[];

      const ftsTotal = db
        .prepare(
          `
          SELECT COUNT(*) as total
          FROM pickup_points p
          JOIN pickup_points_fts f ON f.map_point_id = p.map_point_id
          WHERE f.pickup_points_fts MATCH ?
            AND p.enabled = 1
        `,
        )
        .get(ftsQuery) as { total: number };

      rows = ftsRows;
      total = ftsTotal.total;
    } else {
      // Если в строке были только спецсимволы, возвращаем пустой результат
      rows = [];
      total = 0;
    }
  } else {
    // Без поиска — обычная пагинация
    rows = db
      .prepare(
        `
      SELECT * FROM pickup_points
      WHERE enabled = 1
      ORDER BY city, name
      LIMIT ? OFFSET ?
    `,
      )
      .all(limit, offset) as PickupPointRow[];

    total = (
      db
        .prepare(
          "SELECT COUNT(*) as total FROM pickup_points WHERE enabled = 1",
        )
        .get() as { total: number }
    ).total;
  }

  return { pvz: rows.map(mapRowToTilda), total, limit, offset };
}

/**
 * Получает ВСЕ ПВЗ из базы в формате Tilda (без пагинации)
 */
export function getAllTildaPickupPoints(): TildaPickupPoint[] {
  const rows = db
    .prepare(
      "SELECT * FROM pickup_points WHERE enabled = 1 ORDER BY city, name",
    )
    .all() as PickupPointRow[];
  return rows.map(mapRowToTilda);
}

/**
 * Получает ПВЗ из базы по viewport (области видимости карты)
 * Сортировка по рейтингу — при большом количестве точек
 * сначала показываем лучшие, остальные обрезает LIMIT.
 */
export function getTildaPickupPointsByViewport(options: {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  limit?: number;
}): TildaPickupPoint[] {
  const { latMin, latMax, lngMin, lngMax, limit = 300 } = options;

  const rows = db
    .prepare(
      `
    SELECT * FROM pickup_points
    WHERE enabled = 1
      AND lat BETWEEN ? AND ?
      AND long BETWEEN ? AND ?
    ORDER BY pvz_rating DESC
    LIMIT ?
  `,
    )
    .all(latMin, latMax, lngMin, lngMax, limit) as PickupPointRow[];

  return rows.map(mapRowToTilda);
}

/**
 * Перестройка FTS индекса из существующих данных
 */
export function rebuildFts(): void {
  console.log("🔄 Перестройка FTS индекса...");
  db.run(`
    INSERT INTO pickup_points_fts(pickup_points_fts)
    VALUES ('rebuild')
  `);
  console.log("✅ FTS индекс перестроен");
}

/**
 * Инициализирует кэш точек самовывоза
 */
export async function initializePickupPointsCache(): Promise<void> {
  if (!ozonConfig.isConfigured) {
    console.warn(
      "⚠️  Кэш точек самовывоза не инициализирован: конфигурация не завершена",
    );
    return;
  }

  console.log("🚀 Инициализация кэша точек самовывоза...");

  // Проверяем что уже есть в базе
  const existingCount = (countStmt.get() as { count: number }).count;
  const lastUpdate = (lastUpdateStmt.get() as { last_update: string | null })
    .last_update;

  if (existingCount > 0) {
    console.log(
      `📂 В базе ${existingCount} точек (обновлено: ${lastUpdate || "неизвестно"})`,
    );
  } else {
    console.log("📂 База пуста, будет выполнен запрос к API");
  }

  // Запускаем ежедневное обновление
  scheduleDailyUpdate();

  // Пытаемся обновить из API
  try {
    console.log("📍 Шаг 1: Получение базового списка точек...");
    const listResponse = await getPickupPointsList();

    console.log("📍 Шаг 2: Получение и сохранение детальной информации...");
    await fetchAllPointsInfo(listResponse.points);
    rebuildFts();
    console.log("✅ Кэш точек самовывоза успешно обновлён из API");
  } catch (error) {
    console.error("❌ Ошибка обновления кэша из API:", error);
    if (existingCount > 0) {
      console.log("⚠️  Используем данные из базы как fallback");
    } else {
      console.warn(
        "⚠️  База пуста и нет доступа к API. Данные загрузятся после авторизации",
      );
    }
  }
}

/**
 * Обновляет кэш точек самовывоза
 */
export async function refreshPickupPointsCache(): Promise<void> {
  if (!ozonConfig.isConfigured) {
    console.warn("⚠️  Обновление кэша пропущено: конфигурация не завершена");
    return;
  }

  console.log("🔄 Обновление кэша точек самывоза...");

  try {
    const listResponse = await getPickupPointsList();
    await fetchAllPointsInfo(listResponse.points);
    rebuildFts();
    console.log("✅ Кэш точек самовывоза успешно обновлён");
  } catch (error) {
    console.error("❌ Ошибка обновления кэша:", error);
  }
}

/**
 * Планирует ежедневное обновление кэша
 */
function scheduleDailyUpdate(): void {
  if (dailyUpdateTimer) {
    clearTimeout(dailyUpdateTimer);
    dailyUpdateTimer = null;
  }

  const now = new Date();
  const nextUpdate = new Date();
  nextUpdate.setHours(UPDATE_HOUR, 0, 0, 0);

  if (now >= nextUpdate) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
  }

  const timeUntilUpdate = nextUpdate.getTime() - now.getTime();
  const hoursUntilUpdate = Math.floor(timeUntilUpdate / (1000 * 60 * 60));
  const minutesUntilUpdate = Math.floor(
    (timeUntilUpdate % (1000 * 60 * 60)) / (1000 * 60),
  );

  console.log(
    `⏰ Следующее обновление: ${nextUpdate.toLocaleString("ru-RU")} (через ${hoursUntilUpdate}ч ${minutesUntilUpdate}мин)`,
  );

  dailyUpdateTimer = setTimeout(async () => {
    await refreshPickupPointsCache();
    scheduleDailyUpdate();
  }, timeUntilUpdate);

  dailyUpdateTimer.unref();
}

/**
 * Получает статус кэша
 */
export function getCacheStatus(): {
  totalPoints: number;
  lastUpdate: string | null;
} {
  const count = (countStmt.get() as { count: number }).count;
  const lastUpdate = (lastUpdateStmt.get() as { last_update: string | null })
    .last_update;

  return {
    totalPoints: count,
    lastUpdate,
  };
}

/**
 * Останавливает автоматическое обновление
 */
export function stopDailyUpdate(): void {
  if (dailyUpdateTimer) {
    clearTimeout(dailyUpdateTimer);
    dailyUpdateTimer = null;
    console.log("⏹️ Автоматическое обновление кэша остановлено");
  }
}
