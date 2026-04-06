/**
 * Геокодирование адресов через Nominatim (OpenStreetMap)
 * Бесплатный сервис, без API-ключа
 * Ограничения: 1 запрос/сек, обязательный User-Agent
 */

import * as logger from "./logger";

export interface GeocoderResult {
  lat: number;
  lon: number;
}

/**
 * Геокодирует адрес через Nominatim
 * @param address - текстовый адрес
 * @returns координаты или null если не найден
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocoderResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams(
      {
        q: address,
        format: "json",
        countrycodes: "ru",
        limit: "1",
      },
    )}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "OzonLogisticsIntegration/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      logger.error(`❌ Geocode HTTP error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      logger.warn(`⚠️ Геокодирование: адрес не найден — "${address}"`);
      return null;
    }

    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (error) {
    logger.error("❌ Ошибка геокодирования:", error);
    return null;
  }
}
