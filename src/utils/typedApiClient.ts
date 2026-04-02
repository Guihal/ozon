import { rateLimitedFetch } from "./rateLimiter";
import { useFetch, type ApiResult } from "./useFetch";
import type {
  CheckDeliveryRequest,
  CheckDeliveryResponse,
  PickupPointsListResponse,
  PickupPointsInfoResponse,
  PickupPointInfoRequest,
} from "../services/ozon-logistics/types";
import type { TokenData } from "./getAccessToken";
import { log, error as logError } from "./logger";

/**
 * Маппинг endpoint-ов на их request/response типы
 * Автокомплит и type-safety для всех методов API
 */
type OzonApiEndpointMap = {
  "/v1/delivery/check": {
    request: CheckDeliveryRequest;
    response: CheckDeliveryResponse;
  };
  "/v1/delivery/point/list": {
    request: Record<string, never>;
    response: PickupPointsListResponse;
  };
  "/v1/delivery/point/info": {
    request: PickupPointInfoRequest;
    response: PickupPointsInfoResponse;
  };
};

/**
 * Маппинг OAuth endpoint-ов
 */
type OzonOAuthEndpointMap = {
  oauth_token: {
    request: Record<string, string>;
    response: TokenData;
  };
};

/**
 * Типизированный клиент для API Ozon Logistics
 * Предоставляет автокомплит и type-safety для всех методов
 *
 * @example
 * const client = new OzonApiClient(baseUrl, token);
 * const result = await client.call("/v1/delivery/check", { client_phone: "79991234567" });
 * // result имеет тип CheckDeliveryResponse
 */
export class OzonApiClient {
  constructor(
    private baseUrl: string,
    private token: string,
    private timeoutMs: number = 10000,
  ) {}

  /**
   * Выполняет типизированный запрос к API Ozon
   * @param endpoint - endpoint из маппинга (с автокомплитом)
   * @param body - тело запроса (типизировано)
   * @returns типизированный response
   */
  async call<K extends keyof OzonApiEndpointMap>(
    endpoint: K,
    body?: OzonApiEndpointMap[K]["request"],
  ): Promise<OzonApiEndpointMap[K]["response"]> {
    const url = new URL(endpoint, this.baseUrl);

    try {
      const response = await rateLimitedFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          `❌ Ozon API Error (${endpoint}):`,
          response.status,
          errorData,
        );
        throw new Error(
          `Ozon API Error: ${response.status} ${response.statusText}`,
        );
      }

      return response.json() as Promise<OzonApiEndpointMap[K]["response"]>;
    } catch (error) {
      console.error(`❌ Error calling ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Безопасный типизированный запрос к API Ozon с обработкой ошибок
   * Оборачивает результат в { status: 'ok' | 'error', response: T | OzonErrorType }
   * Автоматически логирует ошибки, сервер не падет
   *
   * @param endpoint - endpoint из маппинга (с автокомплитом)
   * @param body - тело запроса (типизировано)
   * @returns результат вида { status: 'ok'; response: T } | { status: 'error'; response: OzonErrorType }
   *
   * @example
   * const result = await client.callSafe("/v1/delivery/check", { client_phone: "..." });
   * if (result.status === "ok") {
   *   console.log(result.response.is_possible); // TypeScript знает тип!
   * }
   */
  async callSafe<K extends keyof OzonApiEndpointMap>(
    endpoint: K,
    body?: OzonApiEndpointMap[K]["request"],
  ): Promise<ApiResult<OzonApiEndpointMap[K]["response"]>> {
    return useFetch(() => this.call(endpoint, body));
  }
}

/**
 * Типизированный клиент для OAuth методов Ozon
 * Используется для получения и обновления токенов
 */
export class OzonOAuthClient {
  constructor(
    private tokenUrl: string,
    private timeoutMs: number = 10000,
  ) {}

  /**
   * Выполняет OAuth запрос
   * @param body - тело запроса (должно содержать grant_type и credentials)
   * @returns типизированный response с токеном
   */
  async call(
    body: OzonOAuthEndpointMap["oauth_token"]["request"],
  ): Promise<OzonOAuthEndpointMap["oauth_token"]["response"]> {
    try {
      const response = await rateLimitedFetch(this.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ OAuth Error:", response.status, errorData);
        throw new Error(
          `OAuth Error: ${response.status} ${response.statusText}`,
        );
      }

      return response.json() as Promise<
        OzonOAuthEndpointMap["oauth_token"]["response"]
      >;
    } catch (error) {
      console.error("❌ Error in OAuth call:", error);
      throw error;
    }
  }
}

export type { OzonApiEndpointMap, OzonOAuthEndpointMap };
