/**
 * ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ useFetch
 *
 * Файл с примерами показывает различные сценарии использования
 * функции-обертки useFetch для работы с Ozon API
 */

import { OzonApiClient, OzonOAuthClient } from "./typedApiClient";
import { useFetch, isSuccess, isError } from "./useFetch";
import { getAccessToken } from "./getAccessToken";
import { ozonConfig } from "../config/env";
import { log, error as logError } from "./logger";

// ============================================================================
// ПРИМЕР 1: Базовое использование с OzonApiClient
// ============================================================================

export async function example1_BasicApiCall() {
  const token = getAccessToken();
  if (!token) {
    logError("❌ Токен не найден");
    return;
  }

  const client = new OzonApiClient(ozonConfig.apiUrl, token);

  // Простой вызов с обработкой результата
  const result = await useFetch(() =>
    client.call("/v1/delivery/check", { client_phone: "79991234567" }),
  );

  if (result.status === "ok") {
    log(`✅ Доставка возможна: ${result.response.is_possible}`);
  } else {
    const err = result.response;
    if (err.type === "api_error") {
      logError(`❌ Ошибка: ${err.message}`);
    } else {
      logError(`❌ Инцидент: ${err.incidentId}`);
    }
  }
}

// ============================================================================
// ПРИМЕР 2: Использование helper функций isSuccess и isError
// ============================================================================

export async function example2_UsingHelpers() {
  const token = getAccessToken();
  if (!token) return;

  const client = new OzonApiClient(ozonConfig.apiUrl, token);

  const result = await useFetch(() =>
    client.call("/v1/delivery/point/list", {}),
  );

  // Используем isSuccess для проверки успеха
  if (isSuccess(result)) {
    log(`✅ Получено ${result.response.points.length} точек самовывоза`);
    // TypeScript знает, что result.response имеет тип PickupPointsListResponse
    result.response.points.forEach((point) => {
      log(`   - Точка ID: ${point.map_point_id}`);
    });
  }

  // Используем isError для проверки ошибки
  if (isError(result)) {
    const err = result.response;

    if (err.type === "api_error") {
      logError(
        `❌ API Error (${err.code}): ${err.message}`,
        err.details ? JSON.stringify(err.details) : "",
      );
    } else {
      logError(
        `❌ Incident Error (ID: ${err.incidentId})`,
        `Support: ${err.supportURL}`,
      );
    }
  }
}

// ============================================================================
// ПРИМЕР 3: Обработка разных типов ошибок
// ============================================================================

export async function example3_ErrorHandling() {
  const token = getAccessToken();
  if (!token) return;

  const client = new OzonApiClient(ozonConfig.apiUrl, token);

  const result = await useFetch(() =>
    client.call("/v1/delivery/point/info", {
      map_point_ids: ["123", "456"],
    }),
  );

  // Полная обработка обоих типов ошибок
  if (result.status === "error") {
    const error = result.response;

    switch (error.type) {
      case "api_error":
        // Стандартная ошибка API
        logError(`API Error (${error.code}): ${error.message}`);
        if (error.details && error.details.length > 0) {
          log("Детали ошибки:");
          error.details.forEach((detail, index) => {
            log(`  ${index + 1}. ${JSON.stringify(detail)}`);
          });
        }
        break;

      case "incident_error":
        // Ошибка с инцидентом
        logError(
          `Incident ID: ${error.incidentId}`,
          `Please contact support: ${error.supportURL}`,
        );
        break;
    }
  } else {
    log(`✅ Данные получены успешно`);
    log(`   Точек: ${result.response.points.length}`);
  }
}

// ============================================================================
// ПРИМЕР 4: Использование с OzonOAuthClient
// ============================================================================

export async function example4_OAuthClient() {
  const oauthClient = new OzonOAuthClient(
    ozonConfig.oauthTokenUrl,
    ozonConfig.timeoutMs,
  );

  // Получение токена через OAuth
  const tokenResult = await useFetch(() =>
    oauthClient.call({
      grant_type: "authorization_code",
      code: "auth_code_from_callback",
      client_id: ozonConfig.clientId,
      client_secret: ozonConfig.clientSecret,
    }),
  );

  if (isSuccess(tokenResult)) {
    const token = tokenResult.response;
    log("✅ Токен успешно получен");
    log(`   Access Token: ${token.access_token.substring(0, 20)}...`);
    log(`   Expires In: ${token.expires_in} секунд`);
    log(`   Token Type: ${token.token_type}`);

    // Сохраняем токен в файл или БД
    // await saveToken(token);
  } else {
    const err = tokenResult.response;
    logError("❌ Ошибка получения токена");
    if (err.type === "api_error") {
      logError(`   ${err.message}`);
    } else {
      logError(`   Incident: ${err.incidentId}`);
    }
  }
}

// ============================================================================
// ПРИМЕР 5: Последовательные API вызовы с обработкой ошибок на каждом
// ============================================================================

export async function example5_ChainedCalls() {
  const token = getAccessToken();
  if (!token) return;

  const client = new OzonApiClient(ozonConfig.apiUrl, token);

  // Первый вызов: получить список точек
  const listResult = await useFetch(() =>
    client.call("/v1/delivery/point/list", {}),
  );

  if (!isSuccess(listResult)) {
    logError("❌ Ошибка получения списка точек");
    return;
  }

  log(`✅ Получено ${listResult.response.points.length} точек`);

  // Второй вызов: получить информацию о точках
  const mapPointIds = listResult.response.points
    .slice(0, 5) // берем первые 5
    .map((p) => String(p.map_point_id));

  const infoResult = await useFetch(() =>
    client.call("/v1/delivery/point/info", {
      map_point_ids: mapPointIds,
    }),
  );

  if (!isSuccess(infoResult)) {
    logError("❌ Ошибка получения информации о точках");
    return;
  }

  log(`✅ Получена информация о ${infoResult.response.points.length} точках`);
  infoResult.response.points.forEach((point) => {
    const pm = point.delivery_method;
    log(`   - ${pm.name} (ID: ${pm.map_point_id})`);
    log(`     Адрес: ${pm.address}`);
    log(`     Рейтинг: ${pm.pvz_rating}`);
  });
}

// ============================================================================
// ПРИМЕР 6: Параллельные API вызовы
// ============================================================================

export async function example6_ParallelCalls() {
  const token = getAccessToken();
  if (!token) return;

  const client = new OzonApiClient(ozonConfig.apiUrl, token);

  // Выполняем несколько запросов параллельно
  const [deliveryCheck, pointsList] = await Promise.all([
    useFetch(() =>
      client.call("/v1/delivery/check", { client_phone: "79991234567" }),
    ),
    useFetch(() => client.call("/v1/delivery/point/list", {})),
  ]);

  // Проверяем результаты
  if (isSuccess(deliveryCheck)) {
    log(
      `✅ Доставка возможна: ${deliveryCheck.response.is_possible ? "Да" : "Нет"}`,
    );
  } else {
    logError("❌ Ошибка проверки доставки");
  }

  if (isSuccess(pointsList)) {
    log(`✅ Получено ${pointsList.response.points.length} точек`);
  } else {
    logError("❌ Ошибка получения списка точек");
  }
}

// ============================================================================
// ПРИМЕР 7: Обработка ошибок с логированием
// ============================================================================

export async function example7_ErrorLogging() {
  const token = getAccessToken();
  if (!token) return;

  const client = new OzonApiClient(ozonConfig.apiUrl, token);

  const result = await useFetch(() =>
    client.call("/v1/delivery/check", { client_phone: "invalid_phone" }),
  );

  // useFetch уже залогировал ошибку автоматически!
  // Нам остается только обработать результат

  if (isError(result)) {
    const error = result.response;

    // Логирование уже произошло в useFetch, но мы можем добавить свое
    log("Дополнительная информация об ошибке:");
    log(`   Тип: ${error.type}`);

    if (error.type === "api_error") {
      log(`   Код: ${error.code}`);
      log(`   Сообщение: ${error.message}`);
    }
  }
}

// ============================================================================
// ПРИМЕР 8: Обработка ошибок сети и таймаутов
// ============================================================================

export async function example8_NetworkErrors() {
  // Эта функция демонстрирует, как useFetch справляется с сетевыми ошибками
  const client = new OzonApiClient("https://invalid-url.example.com", "token");

  const result = await useFetch(() =>
    client.call("/v1/delivery/check", { client_phone: "79991234567" }),
  );

  // Даже если произойдет сетевая ошибка, useFetch её поймает и вернет
  // { status: 'error', response: OzonErrorType }
  // Сервер не упадет!

  if (isError(result)) {
    logError("❌ Ошибка сети или таймаут");
    const err = result.response;
    if (err.type === "api_error") {
      logError(`   ${err.message}`);
    } else {
      logError(`   Incident: ${err.incidentId}`);
    }

    // Здесь можно реализовать retry логику
    // await sleep(1000);
    // return example8_NetworkErrors(); // retry
  }
}

// ============================================================================
// ПРИМЕР 9: Использование в Express/Elysia обработчик
// ============================================================================

import { Elysia } from "elysia";

// Этот пример показывает, как использовать useFetch в Elysia роут-обработчике
export function example9_ElysiaRoute(app: InstanceType<typeof Elysia>) {
  return app.post("/api/check-delivery", async (context) => {
    const { phone } = context.body as { phone: string };

    const token = getAccessToken();
    if (!token) {
      return {
        success: false,
        error: "No authorization token",
      };
    }

    const client = new OzonApiClient(ozonConfig.apiUrl, token);

    const result = await useFetch(() =>
      client.call("/v1/delivery/check", { client_phone: phone }),
    );

    // Благодаря useFetch разработчик не беспокоится об исключениях
    // Они уже обработаны и залогированы

    if (isSuccess(result)) {
      return {
        success: true,
        is_possible: result.response.is_possible,
      };
    } else {
      return {
        success: false,
        error:
          result.response.type === "api_error"
            ? result.response.message
            : `Incident: ${result.response.incidentId}`,
      };
    }
  });
}

// ============================================================================
// ПРИМЕР 10: Кастомная обработка ошибок
// ============================================================================

interface ErrorHandler {
  onApiError(code: number, message: string): void;
  onIncidentError(incidentId: string): void;
}

export async function example10_CustomErrorHandler(handler: ErrorHandler) {
  const token = getAccessToken();
  if (!token) return;

  const client = new OzonApiClient(ozonConfig.apiUrl, token);

  const result = await useFetch(() =>
    client.call("/v1/delivery/point/list", {}),
  );

  if (isError(result)) {
    const error = result.response;

    switch (error.type) {
      case "api_error":
        handler.onApiError(error.code, error.message);
        break;
      case "incident_error":
        handler.onIncidentError(error.incidentId);
        break;
    }
  }
}

// Использование:
// example10_CustomErrorHandler({
//   onApiError: (code, message) => {
//     console.error(`API Error: ${code} - ${message}`);
//     // отправить метрику, уведомление и т.д.
//   },
//   onIncidentError: (incidentId) => {
//     console.error(`Incident reported: ${incidentId}`);
//     // созвать саппорт, создать тикет и т.д.
//   }
// });
