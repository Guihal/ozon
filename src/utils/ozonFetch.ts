/**
 * Типизированные функции для работы с Ozon API
 * Похожи на $fetch в Nuxt - получают правильный тип ответа по endpoint-у
 *
 * Использование:
 * const result = await ozonFetch("/v1/delivery/check", { client_phone: "..." });
 * if (result.status === "ok") {
 *   // result.response имеет тип CheckDeliveryResponse
 *   console.log(result.response.is_possible);
 * }
 */

import { rateLimitedFetch } from "./rateLimiter";
import { useFetch, type ApiResult } from "./useFetch";
import { getAccessToken } from "./getAccessToken";
import { ozonConfig } from "../config/env";
import { error as logError } from "./logger";
import type {
  OzonApiEndpointMap,
  OzonOAuthEndpointMap,
} from "./typedApiClient";

/**
 * Типизированный запрос к Ozon API
 * Автоматически получает правильный тип ответа по endpoint-у
 * Использует useFetch для безопасной обработки ошибок
 *
 * @param endpoint - endpoint из маппинга (IDE подскажет варианты)
 * @param body - тело запроса (типизировано)
 * @returns { status: 'ok' | 'error', response: T | OzonErrorType }
 *
 * @example
 * const result = await ozonFetch("/v1/delivery/check", { client_phone: "..." });
 * if (result.status === "ok") {
 *   console.log(result.response.is_possible);
 * } else {
 *   console.error(result.response.message);
 * }
 *
 * @example
 * const result = await ozonFetch("/v1/delivery/point/list", {});
 * if (result.status === "ok") {
 *   console.log(result.response.points.length);
 * }
 */
export async function ozonFetch<K extends keyof OzonApiEndpointMap>(
  endpoint: K,
  body?: OzonApiEndpointMap[K]["request"],
): Promise<ApiResult<OzonApiEndpointMap[K]["response"]>> {
  // Получаем токен из кэша
  const token = getAccessToken();
  if (!token) {
    return {
      status: "error",
      response: {
        type: "api_error",
        code: 401,
        message: "Authorization token not found",
      },
    };
  }

  // Используем useFetch для безопасной обработки ошибок
  return useFetch(async () => {
    const url = new URL(endpoint, ozonConfig.apiUrl);

    const response = await rateLimitedFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(ozonConfig.timeoutMs),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logError(
        `❌ Ozon API Error (${endpoint}): ${response.status}`,
        errorData,
      );
      throw errorData;
    }

    return response.json() as Promise<OzonApiEndpointMap[K]["response"]>;
  });
}

/**
 * Типизированный OAuth запрос к Ozon
 * Используется для получения и обновления токенов
 *
 * @param body - тело OAuth запроса
 * @returns { status: 'ok' | 'error', response: TokenData | OzonErrorType }
 *
 * @example
 * const result = await ozonOAuthFetch({
 *   grant_type: "authorization_code",
 *   code: authCode,
 *   client_id: clientId,
 *   client_secret: clientSecret,
 * });
 *
 * if (result.status === "ok") {
 *   console.log(result.response.access_token);
 * }
 */
export async function ozonOAuthFetch(
  body: OzonOAuthEndpointMap["oauth_token"]["request"],
): Promise<ApiResult<OzonOAuthEndpointMap["oauth_token"]["response"]>> {
  return useFetch(async () => {
    const response = await rateLimitedFetch(ozonConfig.oauthTokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ozonConfig.timeoutMs),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logError(`❌ OAuth Error: ${response.status}`, errorData);
      throw errorData;
    }

    return response.json() as Promise<
      OzonOAuthEndpointMap["oauth_token"]["response"]
    >;
  });
}

export default {
  ozonFetch,
  ozonOAuthFetch,
};
