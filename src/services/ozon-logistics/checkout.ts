import { queuedOzonRequest } from "../../utils/requestQueue";
import * as logger from "../../utils/logger";

/**
 * Бизнес-ошибка: доставка недоступна
 */
export class DeliveryUnavailableError extends Error {
  reasons: string[];
  constructor(message: string, reasons: string[] = []) {
    super(message);
    this.name = "DeliveryUnavailableError";
    this.reasons = reasons;
  }
}

export interface DeliveryPriceRequest {
  mapPointId: number;
  items: { sku: number; quantity: number; offer_id: string }[];
  buyerPhone?: string;
}

export interface CourierDeliveryPriceRequest {
  latitude: number;
  longitude: number;
  items: { sku: number; quantity: number; offer_id: string }[];
  buyerPhone?: string;
}

export interface DeliveryPriceResult {
  price: number;
  currency: string;
  daysMin: number;
  daysMax: number;
}

/**
 * Получает цену и сроки доставки до точки самовывоза
 * @param req - параметры заказа (точка, товары)
 * @returns объект с ценой, валютой и сроками доставки
 */
export async function getDeliveryPrice(
  req: DeliveryPriceRequest,
): Promise<DeliveryPriceResult> {
  try {
    logger.log(`🔄 Получение цены доставки для точки ${req.mapPointId}...`);
    logger.log(`   Items from request:`, JSON.stringify(req.items));

    // /v2/delivery/checkout — проверяем доступность и получаем цену
    // Отправляем только sku — нет прав на /v3/product/info/list для резолва offer_id
    const items = req.items
      .map((item) => {
        const obj: Record<string, any> = { quantity: item.quantity };
        if (item.sku && item.sku > 0) {
          obj.sku = item.sku;
        }
        if (item.offer_id && item.offer_id.trim() !== "") {
          obj.offer_id = item.offer_id;
        }
        return obj;
      })
      .filter((item) => item.sku || item.offer_id);

    if (items.length === 0) {
      console.warn(
        "⚠️ Нет товаров с валидным SKU или offer_id — возвращаем дефолтную цену",
      );
      return {
        price: 0,
        currency: "RUB",
        daysMin: 3,
        daysMax: 7,
      };
    }

    const checkoutBody = {
      delivery_schema: "MIX",
      delivery_type: {
        pick_up: { map_point_id: req.mapPointId },
      },
      items,
    };
    logger.log(`   Ozon checkout body:`, JSON.stringify(checkoutBody));

    const result = await queuedOzonRequest(
      "/v2/delivery/checkout",
      "POST",
      checkoutBody,
    );

    if (result.queued) {
      throw new Error("Запрос поставлен в очередь — требуется авторизация");
    }

    const data = result.data as any;

    const priceResult = extractDeliveryResult(data);

    logger.log(
      `✅ Цена доставки получена: ${priceResult.daysMin}-${priceResult.daysMax} дней`,
    );
    return priceResult;
  } catch (error) {
    logger.error("❌ Ошибка при получении цены доставки:", error);
    throw error;
  }
}

/**
 * Вычисляет количество дней между двумя датами
 */
function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Формирует checkout items из запроса
 * Отправляем только sku — нет прав на /v3/product/info/list для резолва offer_id
 */
function buildCheckoutItems(
  items: { sku: number; quantity: number; offer_id: string }[],
): Record<string, any>[] {
  return items
    .map((item) => {
      const obj: Record<string, any> = { quantity: item.quantity };
      if (item.sku && item.sku > 0) obj.sku = item.sku;
      if (item.offer_id && item.offer_id.trim() !== "") {
        obj.offer_id = item.offer_id;
      }
      return obj;
    })
    .filter((item) => item.sku || item.offer_id);
}

/**
 * Извлекает сроки доставки из splits ответа checkout
 */
function extractDeliveryResult(data: any): DeliveryPriceResult {
  const splits = data.splits || [];
  const availableSplit = splits.find(
    (s: any) => s.unavailable_reason === "UNSPECIFIED",
  );

  if (!availableSplit) {
    // Собираем причины недоступности для понятного сообщения
    const reasons = splits
      .filter(
        (s: any) =>
          s.unavailable_reason && s.unavailable_reason !== "UNSPECIFIED",
      )
      .map((s: any) => s.unavailable_reason);
    const uniqueReasons = [...new Set(reasons)];
    const reasonMsg =
      uniqueReasons.length > 0 ? `Причина: ${uniqueReasons.join(", ")}` : "";
    logger.warn(
      `⚠️ Доставка недоступна. ${reasonMsg}. Splits:`,
      JSON.stringify(splits),
    );
    throw new DeliveryUnavailableError(
      `Доставка недоступна для выбранных товаров`,
      uniqueReasons,
    );
  }

  const timeslot = availableSplit.delivery_method?.timeslots?.[0];
  const dateFrom =
    timeslot?.logistic_date_range?.from || timeslot?.client_date_range?.from;
  const dateTo =
    timeslot?.logistic_date_range?.to || timeslot?.client_date_range?.to;

  return {
    price: 0,
    currency: "RUB",
    daysMin: dateFrom ? daysBetween(new Date(), new Date(dateFrom)) : 0,
    daysMax: dateTo ? daysBetween(new Date(), new Date(dateTo)) : 0,
  };
}

/**
 * Получает цену и сроки курьерской доставки по координатам
 * @param req - координаты и товары
 * @returns объект с ценой, валютой и сроками доставки
 */
export async function getCourierDeliveryPrice(
  req: CourierDeliveryPriceRequest,
): Promise<DeliveryPriceResult> {
  try {
    logger.log(
      `🔄 Получение цены курьерской доставки (${req.latitude}, ${req.longitude})...`,
    );

    const items = buildCheckoutItems(req.items);

    if (items.length === 0) {
      logger.warn(
        "⚠️ Нет товаров с валидным SKU или offer_id — возвращаем дефолтную цену",
      );
      return { price: 0, currency: "RUB", daysMin: 3, daysMax: 7 };
    }

    const checkoutBody = {
      delivery_schema: "MIX",
      delivery_type: {
        courier: {
          coordinates: {
            latitude: req.latitude,
            longitude: req.longitude,
          },
        },
      },
      items,
    };
    logger.log(`   Ozon courier checkout body:`, JSON.stringify(checkoutBody));

    const result = await queuedOzonRequest(
      "/v2/delivery/checkout",
      "POST",
      checkoutBody,
    );

    if (result.queued) {
      throw new Error("Запрос поставлен в очередь — требуется авторизация");
    }

    const priceResult = extractDeliveryResult(result.data);
    logger.log(
      `✅ Курьерская доставка: ${priceResult.daysMin}-${priceResult.daysMax} дней`,
    );
    return priceResult;
  } catch (error) {
    logger.error("❌ Ошибка при получении цены курьерской доставки:", error);
    throw error;
  }
}
