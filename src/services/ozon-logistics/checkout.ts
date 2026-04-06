import { queuedOzonRequest } from "../../utils/requestQueue";

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
    console.log(`🔄 Получение цены доставки для точки ${req.mapPointId}...`);
    console.log(`   Items from request:`, JSON.stringify(req.items));

    // /v2/delivery/checkout — проверяем доступность и получаем цену

    // Формируем items: Ozon требует хотя бы одно из sku (>0) или offer_id (непустая строка)
    const items = req.items
      .map((item) => {
        const obj: Record<string, any> = { quantity: item.quantity };
        // Ozon принимает sku (число) ИЛИ offer_id (строка-артикул)
        // SKU из Тильды — числовой Ozon SKU, передаём как sku
        if (item.sku && item.sku > 0) {
          obj.sku = item.sku;
        }
        // offer_id — артикул продавца (может совпадать с SKU, может отличаться)
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
    console.log(`   Ozon checkout body:`, JSON.stringify(checkoutBody));

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
      console.error("❌ Доставка недоступна для этой точки");
      throw new Error("Доставка недоступна для этой точки");
    }

    const timeslot = split.delivery_method?.timeslots?.[0];

    const priceResult = {
      price: 0, // /v2/checkout не возвращает цену — нужен /v2/order/create
      currency: "RUB",
      daysMin: timeslot
        ? daysBetween(new Date(), new Date(timeslot.client_date_range.from))
        : 0,
      daysMax: timeslot
        ? daysBetween(new Date(), new Date(timeslot.client_date_range.to))
        : 0,
    };

    console.log(
      `✅ Цена доставки получена: ${priceResult.daysMin}-${priceResult.daysMax} дней`,
    );
    return priceResult;
  } catch (error) {
    console.error("❌ Ошибка при получении цены доставки:", error);
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
 */
function buildCheckoutItems(
  items: { sku: number; quantity: number; offer_id: string }[],
): Record<string, any>[] {
  return items
    .map((item) => {
      const obj: Record<string, any> = { quantity: item.quantity };
      if (item.sku && item.sku > 0) obj.sku = item.sku;
      if (item.offer_id && item.offer_id.trim() !== "") obj.offer_id = item.offer_id;
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

  return {
    price: 0,
    currency: "RUB",
    daysMin: timeslot
      ? daysBetween(new Date(), new Date(timeslot.client_date_range.from))
      : 0,
    daysMax: timeslot
      ? daysBetween(new Date(), new Date(timeslot.client_date_range.to))
      : 0,
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
    console.log(
      `🔄 Получение цены курьерской доставки (${req.latitude}, ${req.longitude})...`,
    );

    const items = buildCheckoutItems(req.items);

    if (items.length === 0) {
      console.warn(
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
    console.log(`   Ozon courier checkout body:`, JSON.stringify(checkoutBody));

    const result = await queuedOzonRequest(
      "/v2/delivery/checkout",
      "POST",
      checkoutBody,
    );

    if (result.queued) {
      throw new Error("Запрос поставлен в очередь — требуется авторизация");
    }

    const priceResult = extractDeliveryResult(result.data);
    console.log(
      `✅ Курьерская доставка: ${priceResult.daysMin}-${priceResult.daysMax} дней`,
    );
    return priceResult;
  } catch (error) {
    console.error("❌ Ошибка при получении цены курьерской доставки:", error);
    throw error;
  }
}
