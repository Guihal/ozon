import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  getPickupPointsList,
  getPickupPointsInfo,
} from "./ozon-logistics/delivery";
import { ozonConfig } from "../config/env";
import type {
  PickupPointItem,
  PickupPointInfoItem,
} from "./ozon-logistics/types";

// Пути к файлам кэша
const CACHE_DIR = join(__dirname, "..", "cache");
const POINTS_LIST_FILE = join(CACHE_DIR, "pickup-points-list.json");
const POINTS_INFO_FILE = join(CACHE_DIR, "pickup-points-info.json");

// Настройки обновления
const UPDATE_HOUR = 14; // Обновление в 14:00 (вторая половина дня)
const BATCH_SIZE = 100; // Размер пачки для запросов

// Таймер для ежедневного обновления
let dailyUpdateTimer: NodeJS.Timeout | null = null;

/**
 * Создаёт директорию для кэша, если не существует
 */
function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
    console.log("📁 Создана директория кэша:", CACHE_DIR);
  }
}

/**
 * Сохраняет базовый список точек в файл
 */
function savePointsList(points: PickupPointItem[]): void {
  ensureCacheDir();
  try {
    writeFileSync(
      POINTS_LIST_FILE,
      JSON.stringify(
        {
          last_update: new Date().toISOString(),
          count: points.length,
          points: points,
        },
        null,
        2,
      ),
      "utf-8",
    );
    console.log(`💾 Сохранён список точек: ${points.length} шт.`);
  } catch (error) {
    console.error("❌ Ошибка сохранения списка точек:", error);
    throw error;
  }
}

/**
 * Загружает базовый список точек из файла
 */
function loadPointsList(): {
  points: PickupPointItem[];
  last_update?: string;
  count?: number;
} | null {
  try {
    if (!existsSync(POINTS_LIST_FILE)) {
      return null;
    }
    const data = JSON.parse(readFileSync(POINTS_LIST_FILE, "utf-8"));
    console.log(`📂 Загружен список точек из кэша: ${data.points.length} шт.`);
    return data;
  } catch (error) {
    console.error("❌ Ошибка загрузки списка точек:", error);
    return null;
  }
}

/**
 * Сохраняет детальную информацию о точках в файл
 */
function savePointsInfo(points: PickupPointInfoItem[]): void {
  ensureCacheDir();
  try {
    writeFileSync(
      POINTS_INFO_FILE,
      JSON.stringify(
        {
          last_update: new Date().toISOString(),
          count: points.length,
          points: points,
        },
        null,
        2,
      ),
      "utf-8",
    );
    console.log(`💾 Сохранена детальная информация: ${points.length} шт.`);
  } catch (error) {
    console.error("❌ Ошибка сохранения детальной информации:", error);
    throw error;
  }
}

/**
 * Загружает детальную информацию о точках из файла
 */
export function loadPointsInfo(): { points: PickupPointInfoItem[] } | null {
  try {
    if (!existsSync(POINTS_INFO_FILE)) {
      return null;
    }
    const data = JSON.parse(readFileSync(POINTS_INFO_FILE, "utf-8"));
    return data;
  } catch (error) {
    console.error("❌ Ошибка загрузки детальной информации:", error);
    return null;
  }
}

/**
 * Получает детальную информацию о всех точках пачками
 * @param points - базовый список точек
 * @returns массив детальной информации
 */
async function fetchAllPointsInfo(
  points: PickupPointItem[],
): Promise<PickupPointInfoItem[]> {
  const allInfo: PickupPointInfoItem[] = [];
  const totalPoints = points.length;
  const batches = Math.ceil(totalPoints / BATCH_SIZE);

  console.log(
    `🔄 Начинаем получение детальной информации: ${totalPoints} точек, ${batches} пачек`,
  );

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, totalPoints);
    const batchIds = points
      .slice(start, end)
      .map((p) => p.map_point_id.toString());

    try {
      console.log(
        `📦 Обработка пачки ${i + 1}/${batches} (точки ${start + 1}-${end})`,
      );

      const response = await getPickupPointsInfo(batchIds);
      allInfo.push(...response.points);

      // Небольшая пауза между запросами, чтобы не перегрузить API
      if (i < batches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(
        `❌ Ошибка при обработке пачки ${i + 1}/${batches}:`,
        error,
      );
      // Продолжаем с следующей пачкой
    }
  }

  console.log(
    `✅ Получена детальная информация о ${allInfo.length} из ${totalPoints} точек`,
  );
  return allInfo;
}

/**
 * Инициализирует кэш точек самовывоза
 * Вызывается при запуске сервера
 */
export async function initializePickupPointsCache(): Promise<void> {
  if (!ozonConfig.isConfigured) {
    console.warn(
      "⚠️  Кэш точек самовывоза не инициализирован: конфигурация не завершена",
    );
    return;
  }

  console.log("🚀 Инициализация кэша точек самовывоза...");

  try {
    // 1. Получаем базовый список точек
    console.log("📍 Шаг 1: Получение базового списка точек...");
    const listResponse = await getPickupPointsList();
    savePointsList(listResponse.points);

    // 2. Получаем детальную информацию для всех точек
    console.log("📍 Шаг 2: Получение детальной информации...");
    const infoData = await fetchAllPointsInfo(listResponse.points);
    savePointsInfo(infoData);

    console.log("✅ Кэш точек самовывоза успешно инициализирован");

    // 3. Запускаем ежедневное обновление
    scheduleDailyUpdate();
  } catch (error) {
    console.error("❌ Ошибка инициализации кэша:", error);
    console.warn(
      "⚠️  Сервер продолжит работу без кэша. Кэш будет заполнен при первом запросе с токеном авторизации",
    );
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

  console.log("🔄 Обновление кэша точек самовывоза...");

  try {
    // 1. Получаем базовый список точек
    const listResponse = await getPickupPointsList();
    savePointsList(listResponse.points);

    // 2. Получаем детальную информацию
    const infoData = await fetchAllPointsInfo(listResponse.points);
    savePointsInfo(infoData);

    console.log("✅ Кэш точек самовывоза успешно обновлён");
  } catch (error) {
    console.error("❌ Ошибка обновления кэша:", error);
  }
}

/**
 * Планирует ежедневное обновление кэша
 * Запускается в UPDATE_HOUR часов (14:00 по умолчанию)
 */
function scheduleDailyUpdate(): void {
  // Очищаем предыдущий таймер
  if (dailyUpdateTimer) {
    clearTimeout(dailyUpdateTimer);
    dailyUpdateTimer = null;
  }

  const now = new Date();
  const nextUpdate = new Date();
  nextUpdate.setHours(UPDATE_HOUR, 0, 0, 0);

  // Если время обновления уже прошло сегодня, планируем на завтра
  if (now >= nextUpdate) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
  }

  const timeUntilUpdate = nextUpdate.getTime() - now.getTime();
  const hoursUntilUpdate = Math.floor(timeUntilUpdate / (1000 * 60 * 60));
  const minutesUntilUpdate = Math.floor(
    (timeUntilUpdate % (1000 * 60 * 60)) / (1000 * 60),
  );

  console.log(
    `⏰ Следующее обновление кэша: ${nextUpdate.toLocaleString("ru-RU")} (через ${hoursUntilUpdate}ч ${minutesUntilUpdate}мин)`,
  );

  dailyUpdateTimer = setTimeout(async () => {
    await refreshPickupPointsCache();
    // Планируем следующее обновление
    scheduleDailyUpdate();
  }, timeUntilUpdate);

  // Не блокируем выход из процесса
  dailyUpdateTimer.unref();
}

/**
 * Получает статус кэша
 */
export function getCacheStatus(): {
  listExists: boolean;
  infoExists: boolean;
  lastUpdate: string | null;
  pointsCount: number;
} {
  const listData = loadPointsList();
  const infoData = loadPointsInfo();

  return {
    listExists: existsSync(POINTS_LIST_FILE),
    infoExists: existsSync(POINTS_INFO_FILE),
    lastUpdate: listData?.last_update || null,
    pointsCount: listData?.count || 0,
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
