import { queuedOzonRequest } from "../../utils/requestQueue";
import * as logger from "../../utils/logger";

/**
 * In-memory кеш SKU → offer_id
 * Сбрасывается при перезапуске сервера
 */
const skuToOfferIdCache = new Map<number, string>();

interface ProductInfoItem {
  sku: number;
  offer_id: string;
  name: string;
  [key: string]: unknown;
}

interface ProductInfoListResponse {
  items: ProductInfoItem[];
}

/**
 * Получает offer_id для списка SKU через Ozon Seller API /v3/product/info/list
 * Результаты кешируются в памяти.
 *
 * @param skus - массив Ozon SKU
 * @returns Map<sku, offer_id>
 */
export async function resolveOfferIds(
  skus: number[],
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const uncached: number[] = [];

  for (const sku of skus) {
    const cached = skuToOfferIdCache.get(sku);
    if (cached) {
      result.set(sku, cached);
    } else {
      uncached.push(sku);
    }
  }

  if (uncached.length === 0) return result;

  try {
    logger.log(
      `🔍 Резолвим offer_id для ${uncached.length} SKU: ${uncached.join(", ")}`,
    );

    const response = await queuedOzonRequest("/v3/product/info/list", "POST", {
      sku: uncached.map(String),
    });

    if (response.queued) {
      logger.warn("⚠️ Запрос product/info/list поставлен в очередь");
      return result;
    }

    const data = response.data as ProductInfoListResponse;

    if (data.items) {
      for (const item of data.items) {
        if (item.sku && item.offer_id) {
          skuToOfferIdCache.set(item.sku, item.offer_id);
          result.set(item.sku, item.offer_id);
          logger.log(
            `   SKU ${item.sku} → offer_id "${item.offer_id}" (${item.name || ""})`,
          );
        }
      }
    }

    for (const sku of uncached) {
      if (!result.has(sku)) {
        logger.warn(`⚠️ Не найден offer_id для SKU ${sku}`);
      }
    }
  } catch (error) {
    logger.error("❌ Ошибка при получении product info:", error);
  }

  return result;
}

/**
 * Очищает кеш SKU → offer_id
 */
export function clearOfferIdCache(): void {
  skuToOfferIdCache.clear();
}
