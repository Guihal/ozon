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
import {
  getAccessToken,
  getRefreshToken,
  fetchAccessToken,
} from "./getAccessToken";
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
async function doRequest<K extends keyof OzonApiEndpointMap>(
  endpoint: K,
  body: OzonApiEndpointMap[K]["request"] | undefined,
  token: string,
): Promise<{ data: OzonApiEndpointMap[K]["response"]; httpStatus: number }> {
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
    if (response.status !== 401) {
      logError(
        `❌ Ozon API Error (${endpoint}): ${response.status}`,
        errorData,
      );
    }
    const err: Record<string, unknown> =
      typeof errorData === "object" && errorData !== null
        ? (errorData as Record<string, unknown>)
        : {};
    err._httpStatus = response.status;
    throw err;
  }

  return {
    data: (await response.json()) as OzonApiEndpointMap[K]["response"],
    httpStatus: response.status,
  };
}

export async function ozonFetch<K extends keyof OzonApiEndpointMap>(
  endpoint: K,
  body?: OzonApiEndpointMap[K]["request"],
): Promise<ApiResult<OzonApiEndpointMap[K]["response"]>> {
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

  return useFetch(async () => {
    try {
      const { data } = await doRequest(endpoint, body, token);
      return data;
    } catch (err: unknown) {
      const httpStatus = (err as Record<string, unknown>)?._httpStatus;
      if (httpStatus === 401) {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          console.log("🔄 Access token истёк, обновляем и повторяем запрос...");
          const newTokenData = await fetchAccessToken(
            "refresh_token",
            undefined,
            refreshToken,
          );
          const { data } = await doRequest(
            endpoint,
            body,
            newTokenData.access_token,
          );
          return data;
        }
      }
      throw err;
    }
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
