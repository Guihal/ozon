import { queuedOzonRequest } from "../../utils/requestQueue";
import { resolveOfferIds } from "./product";
import * as logger from "../../utils/logger";

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

    // Формируем items: Tilda sku = Ozon SKU, но offer_id нужно резолвить
    // Сначала собираем SKU для резолва offer_id
    const skusToResolve = req.items
      .filter((item) => item.sku && item.sku > 0)
      .map((item) => item.sku);

    const offerIdMap =
      skusToResolve.length > 0
        ? await resolveOfferIds(skusToResolve)
        : new Map<number, string>();

    const items = req.items
      .map((item) => {
        const obj: Record<string, any> = { quantity: item.quantity };
        if (item.sku && item.sku > 0) {
          obj.sku = item.sku;
          // Только резолвленный offer_id — НЕ используем Tilda offer_id (там SKU числом)
          const resolvedOfferId = offerIdMap.get(item.sku);
          if (resolvedOfferId) {
            obj.offer_id = resolvedOfferId;
          }
        } else if (item.offer_id && item.offer_id.trim() !== "") {
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

    // Берём первый доступный сплит
    const split = data.splits?.find(
      (s: any) => s.unavailable_reason === "UNSPECIFIED",
    );

    if (!split) {
      logger.error("❌ Доставка недоступна для этой точки");
      throw new Error("Доставка недоступна для этой точки");
    }

    const timeslot = split.delivery_method?.timeslots?.[0];

    const dateFrom =
      timeslot?.logistic_date_range?.from || timeslot?.client_date_range?.from;
    const dateTo =
      timeslot?.logistic_date_range?.to || timeslot?.client_date_range?.to;

    const priceResult = {
      price: 0, // /v2/checkout не возвращает цену — нужен /v2/order/create
      currency: "RUB",
      daysMin: dateFrom ? daysBetween(new Date(), new Date(dateFrom)) : 0,
      daysMax: dateTo ? daysBetween(new Date(), new Date(dateTo)) : 0,
    };

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
 * Формирует checkout items из запроса, резолвя offer_id через Ozon API
 */
async function buildCheckoutItems(
  items: { sku: number; quantity: number; offer_id: string }[],
): Promise<Record<string, any>[]> {
  // Собираем SKU для резолва
  const skusToResolve = items
    .filter((item) => item.sku && item.sku > 0)
    .map((item) => item.sku);

  const offerIdMap =
    skusToResolve.length > 0
      ? await resolveOfferIds(skusToResolve)
      : new Map<number, string>();

  return items
    .map((item) => {
      const obj: Record<string, any> = { quantity: item.quantity };
      if (item.sku && item.sku > 0) obj.sku = item.sku;
      // Только резолвленный offer_id — НЕ используем Tilda offer_id (там SKU числом)
      const resolvedOfferId = offerIdMap.get(item.sku);
      if (resolvedOfferId) {
        obj.offer_id = resolvedOfferId;
      }
      return obj;
    })
    .filter((item) => item.sku || item.offer_id);
}

/**
 * Извлекает сроки доставки из splits ответа checkout
 */
function extractDeliveryResult(data: any): DeliveryPriceResult {
  const split = data.splits?.find(
    (s: any) => s.unavailable_reason === "UNSPECIFIED",
  );

  if (!split) {
    throw new Error("Доставка недоступна");
  }

  const timeslot = split.delivery_method?.timeslots?.[0];
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

    const items = await buildCheckoutItems(req.items);

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
