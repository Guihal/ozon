/**
 * Геокодирование адресов через Яндекс Геокодер API
 * https://yandex.ru/dev/geocode/doc/ru/
 */

import * as logger from "./logger";
import { ozonConfig } from "../config/env";

export interface GeocoderResult {
  lat: number;
  lon: number;
}

/**
 * Очищает сырой адрес от мусора Тильды перед геокодированием.
 * Убирает "RU:", индекс, "Адрес,", подъезд/этаж/квартиру.
 */
function cleanAddress(raw: string): string {
  return raw
    .replace(/^RU:\s*/i, "")
    .replace(/^\d{6},?\s*/, "")
    .replace(/,?\s*Адрес,?\s*/i, ", ")
    .replace(/,?\s*ent\.?:?\s*\d+/i, "")
    .replace(/,?\s*fl\.?:?\s*\d+/i, "")
    .replace(/,?\s*кв\.?\s*\d+/i, "")
    .replace(/,?\s*подъезд\.?\s*\d+/i, "")
    .replace(/,?\s*этаж\.?\s*\d+/i, "")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*$/, "")
    .replace(/^\s*,\s*/, "")
    .trim();
}

/**
 * Геокодирует адрес через Яндекс Геокодер
 * @param address - текстовый адрес
 * @returns координаты или null если не найден
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocoderResult | null> {
  const apiKey = ozonConfig.yandexGeocoderApiKey;
  if (!apiKey) {
    logger.error("❌ YANDEX_GEOCODER_API_KEY не задан");
    return null;
  }

  const cleaned = cleanAddress(address);
  logger.log(`🔍 Геокодирование: "${address}" → очищено: "${cleaned}"`);

  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?${new URLSearchParams({
      apikey: apiKey,
      geocode: cleaned,
      format: "json",
      lang: "ru_RU",
      results: "1",
    })}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      logger.error(`❌ Yandex Geocode HTTP error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const members = data?.response?.GeoObjectCollection?.featureMember;

    if (!Array.isArray(members) || members.length === 0) {
      logger.warn(`⚠️ Геокодирование: адрес не найден — "${cleaned}"`);
      return null;
    }

    const pos = members[0].GeoObject?.Point?.pos;
    if (!pos) {
      logger.warn(`⚠️ Геокодирование: нет координат в ответе`);
      return null;
    }

    // Яндекс возвращает "lon lat" (долгота пробел широта)
    const [lonStr, latStr] = pos.split(" ");
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon)) {
      logger.warn(`⚠️ Геокодирование: невалидные координаты "${pos}"`);
      return null;
    }

    logger.log(`✅ Геокодировано: "${cleaned}" → ${lat}, ${lon}`);
    return { lat, lon };
  } catch (error) {
    logger.error("❌ Ошибка геокодирования:", error);
    return null;
  }
}
