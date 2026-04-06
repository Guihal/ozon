import { getAccessToken } from "../../utils/getAccessToken";
import { ozonConfig } from "../../config/env";

export interface DeliveryPriceRequest {
  mapPointId: number;
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
  const token = getAccessToken();
  if (!token) {
    console.error("❌ Токен авторизации не найден");
    throw new Error("Требуется авторизация");
  }

  try {
    console.log(`🔄 Получение цены доставки для точки ${req.mapPointId}...`);

    // /v2/delivery/checkout — проверяем доступность и получаем цену

    // Формируем items: Ozon требует хотя бы одно из sku (>0) или offer_id (непустая строка)
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

    const response = await fetch(`${ozonConfig.apiUrl}/v2/delivery/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        delivery_schema: "MIX",
        delivery_type: {
          pick_up: { map_point_id: req.mapPointId },
        },
        items,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("❌ Ошибка Ozon checkout:", err);
      throw new Error(`Ozon checkout error: ${JSON.stringify(err)}`);
    }

    const data = await response.json();

    // Берём первый доступный сплит
    const split = data.splits?.find(
      (s: any) => s.unavailable_reason === "UNSPECIFIED",
    );

    if (!split) {
      console.error("❌ Доставка недоступна для этой точки");
      throw new Error("Доставка недоступна для этой точки");
    }

    const timeslot = split.delivery_method?.timeslots?.[0];

    const result = {
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
      `✅ Цена доставки получена: ${result.daysMin}-${result.daysMax} дней`,
    );
    return result;
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
