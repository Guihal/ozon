/**
 * Обертка над Ozon API запросами с унифицированной обработкой ошибок
 * Функция-обертка useFetch оборачивает каждый API запрос в объект:
 * { status: 'ok' | 'error', response: T | OzonErrorType }
 */

import { error as logError } from "./logger";

// === ТИПЫ ОШИБОК ===

/**
 * Формат ошибки API Ozon (стандартный)
 * Структура: { code, message, details }
 */
export interface OzonApiError {
  type: "api_error";
  code: number;
  message: string;
  details?: Array<Record<string, unknown>>;
}

/**
 * Формат ошибки с инцидентом (альтернативный)
 * Структура: { incidentId, supportURL }
 */
export interface OzonIncidentError {
  type: "incident_error";
  incidentId: string;
  supportURL: string;
}

/**
 * Union type всех возможных ошибок Ozона
 */
export type OzonErrorType = OzonApiError | OzonIncidentError;

/**
 * Результат выполнения API запроса
 * Никогда не выбрасывает исключение, всегда возвращает результат
 */
export type ApiResult<T> =
  | { status: "ok"; response: T }
  | { status: "error"; response: OzonErrorType };

// === УТИНАЯ ТИПИЗАЦИЯ (TYPE GUARDS) ===

/**
 * Проверяет, является ли объект ошибкой API Ozона
 * Ищет поля: code (число) и message (строка)
 */
function isOzonApiError(obj: unknown): obj is OzonApiError {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).code === "number" &&
    typeof (obj as Record<string, unknown>).message === "string"
  );
}

/**
 * Проверяет, является ли объект ошибкой инцидента
 * Ищет поля: incidentId (строка) и supportURL (строка)
 */
function isOzonIncidentError(obj: unknown): obj is OzonIncidentError {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).incidentId === "string" &&
    typeof (obj as Record<string, unknown>).supportURL === "string"
  );
}

// === ПАРСИНГ ОШИБОК ===

/**
 * Парсит неизвестную ошибку в один из поддерживаемых форматов Ozона
 * @param error - неизвестный объект ошибки
 * @returns нормализованный объект ошибки OzonErrorType
 */
function parseOzonError(error: unknown): OzonErrorType {
  // Проверяем первый формат ошибки
  if (isOzonApiError(error)) {
    return {
      type: "api_error",
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  // Проверяем второй формат ошибки
  if (isOzonIncidentError(error)) {
    return {
      type: "incident_error",
      incidentId: error.incidentId,
      supportURL: error.supportURL,
    };
  }

  // Если это Error объект
  if (error instanceof Error) {
    // Пытаемся распарсить JSON из сообщения
    try {
      const parsed = JSON.parse(error.message);
      if (isOzonApiError(parsed) || isOzonIncidentError(parsed)) {
        return parseOzonError(parsed);
      }
    } catch {
      // Не JSON, продолжаем
    }

    return {
      type: "api_error",
      code: 500,
      message: error.message || "Unknown error",
    };
  }

  // Последняя попытка - конвертируем в строку
  return {
    type: "api_error",
    code: 500,
    message: String(error) || "Unknown error",
  };
}

// === ОСНОВНАЯ ФУНКЦИЯ ===

/**
 * Функция-обертка для API запросов Ozона
 * Похожа на useFetch в React hook, но для backend
 *
 * Характеристики:
 * ✅ Оборачивает результат в { status: 'ok' | 'error', response }
 * ✅ Использует утиную типизацию для детектирования ошибок по двум форматам
 * ✅ Автоматически логирует ошибки через logger
 * ✅ Никогда не выбрасывает исключения (сервер не упадет)
 * ✅ Полная типизация: если ok → тип из T, если error → OzonErrorType
 *
 * @template T - тип успешного ответа
 * @param fn - async функция, результат которой нужно обернуть
 * @returns Promise<{ status: 'ok' | 'error', response: T | OzonErrorType }>
 *
 * @example
 * // С OzonApiClient
 * const result = await useFetch(() =>
 *   client.call("/v1/delivery/check", { client_phone: "79991234567" })
 * );
 *
 * if (result.status === "ok") {
 *   console.log("✅ Доставка возможна:", result.response.is_possible);
 * } else if (result.status === "error") {
 *   const err = result.response;
 *   if (err.type === "api_error") {
 *     console.error(`❌ API Error (${err.code}): ${err.message}`);
 *   } else {
 *     console.error(`❌ Incident (${err.incidentId}): ${err.supportURL}`);
 *   }
 * }
 *
 * @example
 * // С OzonOAuthClient
 * const tokenResult = await useFetch(() =>
 *   oauthClient.call({
 *     grant_type: "authorization_code",
 *     code: "...",
 *     client_id: "...",
 *     client_secret: "..."
 *   })
 * );
 *
 * if (tokenResult.status === "ok") {
 *   saveToken(tokenResult.response.access_token);
 * } else {
 *   // Ошибка уже залогирована автоматически
 *   handleError(tokenResult.response);
 * }
 */
export async function useFetch<T>(fn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    const response = await fn();

    // Проверяем, может ли ответ сам являться ошибкой
    // (для случаев когда API возвращает ошибку в body с кодом 200)
    if (isOzonApiError(response) || isOzonIncidentError(response)) {
      const parsedError = parseOzonError(response);
      logError(`❌ API вернул ошибку в теле ответа`, parsedError);
      return {
        status: "error",
        response: parsedError,
      };
    }

    return {
      status: "ok",
      response,
    };
  } catch (error) {
    const parsedError = parseOzonError(error);
    logError(`❌ Ошибка при выполнении API запроса`, parsedError);

    return {
      status: "error",
      response: parsedError,
    };
  }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

/**
 * Проверяет, был ли результат успешным
 * @example
 * const result = await useFetch(() => client.call(...));
 * if (isSuccess(result)) {
 *   console.log(result.response.field); // автокомплит работает!
 * }
 */
export function isSuccess<T>(result: ApiResult<T>): result is {
  status: "ok";
  response: T;
} {
  return result.status === "ok";
}

/**
 * Проверяет, была ли ошибка
 * @example
 * const result = await useFetch(() => client.call(...));
 * if (isError(result)) {
 *   if (result.response.type === "api_error") {
 *     console.error(result.response.code, result.response.message);
 *   }
 * }
 */
export function isError<T>(result: ApiResult<T>): result is {
  status: "error";
  response: OzonErrorType;
} {
  return result.status === "error";
}

// === ЭКСПОРТЫ ===

export default {
  useFetch,
  isSuccess,
  isError,
};
