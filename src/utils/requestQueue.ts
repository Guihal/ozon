import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import PQueue from "p-queue";
import { sendAuthRequiredEmail } from "./mailer";
import {
  getAccessToken,
  fetchAccessToken,
  getRefreshToken,
} from "./getAccessToken";
import { ozonConfig } from "../config/env";
import { rateLimitedFetch } from "./rateLimiter";
import * as logger from "./logger";

/**
 * Очередь запросов к Ozon API.
 * При 401 (и неудачном refresh) запрос сохраняется в очередь,
 * а клиенту отправляется email. После повторной авторизации
 * очередь воспроизводится.
 */

export interface QueuedRequest {
  endpoint: string;
  method: string;
  body: unknown;
  timestamp: number;
}

const QUEUE_FILE = join(__dirname, "request_queue.json");

// Endpoints, которые НЕ ставим в очередь (карта — эфемерные данные)
const EXCLUDED_ENDPOINTS = ["/v1/delivery/map"];

let queue: QueuedRequest[] = [];

// Загружаем очередь из файла при старте
function loadQueue(): void {
  try {
    if (existsSync(QUEUE_FILE)) {
      queue = JSON.parse(readFileSync(QUEUE_FILE, "utf-8"));
      if (queue.length > 0) {
        logger.log(`📋 Загружена очередь: ${queue.length} запрос(ов)`);
      }
    }
  } catch {
    queue = [];
  }
}

function saveQueue(): void {
  try {
    writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf-8");
  } catch (error) {
    logger.error("❌ Не удалось сохранить очередь:", error);
  }
}

/**
 * Добавляет запрос в очередь и уведомляет по email (с дебаунсом)
 */
function enqueue(endpoint: string, method: string, body: unknown): void {
  queue.push({ endpoint, method, body, timestamp: Date.now() });
  saveQueue();
  logger.log(
    `📋 Запрос поставлен в очередь: ${method} ${endpoint} (всего: ${queue.length})`,
  );

  // Отправляем email (дебаунсится внутри)
  sendAuthRequiredEmail(queue.length).catch((err) => {
    logger.error("❌ Ошибка при отправке email:", err);
  });
}

/**
 * Проверяет, нужно ли ставить endpoint в очередь
 */
function shouldQueue(endpoint: string): boolean {
  return !EXCLUDED_ENDPOINTS.some((ex) => endpoint.includes(ex));
}

/**
 * Выполняет один HTTP-запрос к Ozon API с токеном.
 * Возвращает { data, status }.
 */
async function executeRequest(
  endpoint: string,
  method: string,
  body: unknown,
  token: string,
): Promise<{ data: unknown; httpStatus: number }> {
  const url = new URL(endpoint, ozonConfig.apiUrl);

  const response = await rateLimitedFetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(ozonConfig.timeoutMs),
  });

  const data = await response.json().catch(() => ({}));
  return { data, httpStatus: response.status };
}

/**
 * Оборачивает запрос к Ozon API с логикой:
 * 1. Делаем запрос с текущим токеном
 * 2. При 401 — пытаемся refresh
 * 3. Если refresh удался — повторяем запрос
 * 4. Если refresh не удался — ставим в очередь + email
 *
 * @returns данные ответа или null если запрос поставлен в очередь
 */
export async function queuedOzonRequest(
  endpoint: string,
  method: string,
  body: unknown,
): Promise<{ data: unknown; queued: boolean }> {
  const token = getAccessToken();

  if (!token) {
    // Нет токена вообще — сразу в очередь
    if (shouldQueue(endpoint)) {
      enqueue(endpoint, method, body);
      return { data: null, queued: true };
    }
    throw new Error("Требуется авторизация");
  }

  const result = await executeRequest(endpoint, method, body, token);

  if (result.httpStatus !== 401) {
    if (result.httpStatus >= 400) {
      throw result.data;
    }
    return { data: result.data, queued: false };
  }

  // 401 — пробуем refresh
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      logger.log("🔄 Токен истёк, обновляем...");
      const newTokenData = await fetchAccessToken(
        "refresh_token",
        undefined,
        refreshToken,
      );
      const retryResult = await executeRequest(
        endpoint,
        method,
        body,
        newTokenData.access_token,
      );

      if (retryResult.httpStatus >= 400) {
        throw retryResult.data;
      }
      return { data: retryResult.data, queued: false };
    } catch (refreshError) {
      logger.critical(
        "Refresh token не работает",
        "Токен истёк и refresh не удался. Требуется повторная авторизация.",
        refreshError,
      );
    }
  }

  // Refresh не помог — в очередь
  if (shouldQueue(endpoint)) {
    enqueue(endpoint, method, body);
    return { data: null, queued: true };
  }

  throw new Error("Требуется авторизация");
}

/**
 * Воспроизводит все запросы из очереди после успешной авторизации.
 * Вызывать из auth callback.
 */
export async function replayQueue(): Promise<{
  total: number;
  success: number;
  failed: number;
}> {
  if (queue.length === 0) {
    return { total: 0, success: 0, failed: 0 };
  }

  const token = getAccessToken();
  if (!token) {
    logger.error("❌ Нет токена для воспроизведения очереди");
    return { total: queue.length, success: 0, failed: queue.length };
  }

  logger.log(`🔄 Воспроизведение очереди: ${queue.length} запрос(ов)...`);

  const items = [...queue];
  queue = [];
  saveQueue();

  let success = 0;
  let failed = 0;

  const pq = new PQueue({ concurrency: 3 });

  for (const item of items) {
    pq.add(async () => {
      try {
        const result = await executeRequest(
          item.endpoint,
          item.method,
          item.body,
          token,
        );
        if (result.httpStatus < 400) {
          success++;
          logger.log(`   ✅ ${item.method} ${item.endpoint}`);
        } else {
          failed++;
          logger.error(
            `   ❌ ${item.method} ${item.endpoint}: ${result.httpStatus}`,
          );
        }
      } catch (error) {
        failed++;
        logger.error(`   ❌ ${item.method} ${item.endpoint}:`, error);
      }
    });
  }

  await pq.onIdle();

  logger.log(
    `📋 Очередь обработана: ${success} успешн., ${failed} ошибок из ${items.length}`,
  );
  return { total: items.length, success, failed };
}

/**
 * Возвращает текущее количество запросов в очереди
 */
export function getQueueSize(): number {
  return queue.length;
}

// Загружаем очередь при старте модуля
loadQueue();
