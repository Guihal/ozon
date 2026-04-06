import { ofetch, FetchError } from "ofetch";
import { useFetch, type ApiResult } from "./useFetch";
import {
  getAccessToken,
  getRefreshToken,
  fetchAccessToken,
} from "./getAccessToken";
import { ozonConfig } from "../config/env";
import { log as logInfo } from "./logger";
import { rateLimitedFetch } from "./rateLimiter";
import type {
  OzonApiEndpointMap,
  OzonOAuthEndpointMap,
} from "./typedApiClient";

// Клиент с rate limiting и базовым URL Ozon API
const apiClient = ofetch.create({
  baseURL: ozonConfig.apiUrl,
  fetch: rateLimitedFetch as typeof fetch,
});

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
      return await apiClient<OzonApiEndpointMap[K]["response"]>(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: body ?? {},
        signal: AbortSignal.timeout(ozonConfig.timeoutMs),
      });
    } catch (err) {
      if (err instanceof FetchError && err.status === 401) {
        const refresh = getRefreshToken();
        if (refresh) {
          logInfo("🔄 Access token истёк, обновляем и повторяем запрос...");
          const newTokenData = await fetchAccessToken(
            "refresh_token",
            undefined,
            refresh,
          );
          return await apiClient<OzonApiEndpointMap[K]["response"]>(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${newTokenData.access_token}`,
            },
            body: body ?? {},
            signal: AbortSignal.timeout(ozonConfig.timeoutMs),
          });
        }
      }
      throw err;
    }
  });
}

export async function ozonOAuthFetch(
  body: OzonOAuthEndpointMap["oauth_token"]["request"],
): Promise<ApiResult<OzonOAuthEndpointMap["oauth_token"]["response"]>> {
  return useFetch(() =>
    ofetch<OzonOAuthEndpointMap["oauth_token"]["response"]>(
      ozonConfig.oauthTokenUrl,
      {
        method: "POST",
        body,
        fetch: rateLimitedFetch as typeof fetch,
        signal: AbortSignal.timeout(ozonConfig.timeoutMs),
      },
    ),
  );
}

export default { ozonFetch, ozonOAuthFetch };
