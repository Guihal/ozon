import { getAccessToken } from "../../utils/getAccessToken";
import { ozonConfig } from "../../config/env";
import { OzonApiClient } from "../../utils/typedApiClient";
import type {
  CheckDeliveryResponse,
  PickupPointsListResponse,
  PickupPointsInfoResponse,
} from "./types";

/**
 * Проверяет доступность доставки Ozon для покупателя
 * @param clientPhone - номер телефона покупателя в формате 7XXXXXXXXXX
 * @returns объект с полем is_possible
 */
export async function checkDeliveryAvailability(
  clientPhone: string,
): Promise<CheckDeliveryResponse> {
  // Валидация номера телефона
  const phoneRegex = /^7\d{10}$/;
  if (!phoneRegex.test(clientPhone)) {
    console.error("❌ Неверный формат номера телефона:", clientPhone);
    throw new Error("Номер телефона должен быть в формате 7XXXXXXXXXX");
  }

  const token = getAccessToken();
  if (!token) {
    console.error("❌ Токен авторизации не найден");
    throw new Error("Требуется авторизация");
  }

  try {
    console.log(
      `🔄 Проверка доступности доставки для телефона: ${clientPhone}`,
    );

    const client = new OzonApiClient(
      ozonConfig.apiUrl,
      token,
      ozonConfig.timeoutMs,
    );
    const data = await client.call("/v1/delivery/check", {
      client_phone: clientPhone,
    });

    console.log(`✅ Результат проверки: is_possible=${data.is_possible}`);
    return data;
  } catch (error) {
    console.error("❌ Ошибка при проверке доставки:", error);
    throw error;
  }
}

/**
 * Получает список всех точек самовывоза с координатами
 * @returns объект с массивом точек самовывоза
 */
export async function getPickupPointsList(): Promise<PickupPointsListResponse> {
  const token = getAccessToken();
  if (!token) {
    console.error("❌ Токен авторизации не найден");
    throw new Error("Требуется авторизация");
  }

  try {
    console.log("🔄 Получение списка точек самовывоза...");

    const client = new OzonApiClient(
      ozonConfig.apiUrl,
      token,
      ozonConfig.timeoutMs,
    );
    const data = await client.call("/v1/delivery/point/list", {});

    console.log(`✅ Получено точек самовывоза: ${data.points.length}`);
    return data;
  } catch (error) {
    console.error("❌ Ошибка при получении точек самовывоза:", error);
    throw error;
  }
}

/**
 * Получает детальную информацию о точках самовывоза
 * @param mapPointIds - массив идентификаторов точек (максимум 100 за запрос)
 * @returns объект с массивом детальной информации о точках
 */
export async function getPickupPointsInfo(
  mapPointIds: string[],
): Promise<PickupPointsInfoResponse> {
  if (mapPointIds.length === 0) {
    return { points: [] };
  }

  if (mapPointIds.length > 100) {
    console.error("❌ Превышен лимит идентификаторов:", mapPointIds.length);
    throw new Error("Максимум 100 идентификаторов за запрос");
  }

  const token = getAccessToken();
  if (!token) {
    console.error("❌ Токен авторизации не найден");
    throw new Error("Требуется авторизация");
  }

  try {
    console.log(
      `🔄 Получение информации о ${mapPointIds.length} точках самовывоза...`,
    );

    const client = new OzonApiClient(
      ozonConfig.apiUrl,
      token,
      ozonConfig.timeoutMs,
    );
    const data = await client.call("/v1/delivery/point/info", {
      map_point_ids: mapPointIds,
    });

    console.log(`✅ Получена информация о ${data.points.length} точках`);
    return data;
  } catch (error) {
    console.error("❌ Ошибка при получении информации о точках:", error);
    throw error;
  }
}
