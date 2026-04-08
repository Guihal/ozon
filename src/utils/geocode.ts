/**
 * Геокодирование адресов через Яндекс Геокодер API с fallback на Nominatim
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
 * Геокодирует через Яндекс Геокодер
 */
async function geocodeYandex(
  cleaned: string,
  apiKey: string,
): Promise<GeocoderResult | null> {
  const url = `https://geocode-maps.yandex.ru/v1/?${new URLSearchParams({
    apikey: apiKey,
    geocode: cleaned,
    format: "json",
    lang: "ru_RU",
    results: "1",
  })}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!res.ok) {
    logger.warn(`⚠️ Yandex Geocode HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();
  const members = data?.response?.GeoObjectCollection?.featureMember;

  if (!Array.isArray(members) || members.length === 0) return null;

  const pos = members[0].GeoObject?.Point?.pos;
  if (!pos) return null;

  // Яндекс возвращает "lon lat" (долгота пробел широта)
  const [lonStr, latStr] = pos.split(" ");
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
}

/**
 * Геокодирует через Nominatim (fallback)
 */
async function geocodeNominatim(
  cleaned: string,
): Promise<GeocoderResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams(
    {
      q: cleaned,
      format: "json",
      countrycodes: "ru",
      limit: "1",
    },
  )}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "OzonLogisticsIntegration/1.0" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
  };
}

/**
 * Геокодирует адрес: Яндекс → fallback Nominatim
 * @param address - текстовый адрес
 * @returns координаты или null если не найден
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocoderResult | null> {
  const cleaned = cleanAddress(address);
  logger.log(`🔍 Геокодирование: "${address}" → очищено: "${cleaned}"`);

  // 1. Попытка через Яндекс
  const apiKey = ozonConfig.yandexGeocoderApiKey;
  if (apiKey) {
    try {
      const result = await geocodeYandex(cleaned, apiKey);
      if (result) {
        logger.log(`✅ Яндекс: "${cleaned}" → ${result.lat}, ${result.lon}`);
        return result;
      }
      logger.warn(`⚠️ Яндекс не нашёл: "${cleaned}", пробуем Nominatim...`);
    } catch (error) {
      logger.warn(`⚠️ Яндекс ошибка, пробуем Nominatim:`, error);
    }
  }

  // 2. Fallback — Nominatim
  try {
    const result = await geocodeNominatim(cleaned);
    if (result) {
      logger.log(`✅ Nominatim: "${cleaned}" → ${result.lat}, ${result.lon}`);
      return result;
    }
    logger.warn(`⚠️ Геокодирование: адрес не найден — "${cleaned}"`);
    return null;
  } catch (error) {
    logger.error("❌ Ошибка геокодирования:", error);
    return null;
  }
}
