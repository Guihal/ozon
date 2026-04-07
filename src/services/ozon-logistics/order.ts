import { queuedOzonRequest } from "../../utils/requestQueue";
import { geocodeAddress } from "../../utils/geocode";
import { sendOrderErrorEmail } from "../../utils/mailer";
import { db } from "../../db";
import * as logger from "../../utils/logger";
import { resolveOfferIds } from "./product";
import type {
  TildaWebhookBody,
  OzonOrderCreateRequest,
  OzonOrderCreateResponse,
  OzonOrderSplit,
} from "./types";

interface SkuMappingRow {
  ozon_sku: number;
  ozon_offer_id: string;
}

/**
 * Создаёт заказ в Ozon из данных Tilda webhook
 *
 * Алгоритм:
 * 1. Парсит данные покупателя из webhook
 * 2. Резолвит SKU через таблицу sku_mapping (или напрямую из webhook.sku)
 * 3. Вызывает /v2/delivery/checkout для получения splits
 * 4. Для курьерской доставки — геокодирует адрес
 * 5. Вызывает /v2/order/create
 * 6. Сохраняет результат в таблицу orders
 */
export async function createOzonOrder(webhook: TildaWebhookBody): Promise<{
  success: boolean;
  orderNumber?: string;
  postings?: string[];
  error?: string;
}> {
  const payment = webhook.payment;
  const tildaOrderId = payment.orderid;

  // Проверка дубля
  const existingOrder = db
    .query(
      "SELECT id, ozon_order_number, status FROM orders WHERE tilda_order_id = ?",
    )
    .get(tildaOrderId) as {
    id: number;
    ozon_order_number: string;
    status: string;
  } | null;

  if (existingOrder) {
    logger.warn(
      `⚠️ Дубль webhook: заказ ${tildaOrderId} уже существует (status: ${existingOrder.status})`,
    );
    if (existingOrder.ozon_order_number) {
      return {
        success: true,
        orderNumber: existingOrder.ozon_order_number,
      };
    }
    // Если предыдущая попытка была с ошибкой — пробуем снова
    if (existingOrder.status !== "error") {
      return { success: true, orderNumber: "processing" };
    }
  }

  // Парсинг покупателя
  const { firstName, lastName } = parseName(
    payment.delivery_fio || webhook.Name,
  );
  const phone = normalizePhone(webhook.Phone);

  // Определяем тип доставки
  const deliveryType = webhook.ozon_delivery_type || "pickup";
  const mapPointId = webhook.ozon_map_point_id
    ? parseInt(webhook.ozon_map_point_id, 10)
    : 0;

  // Резолвим товары
  const items = await resolveItems(payment.products);
  if (items.length === 0) {
    const error = "Нет товаров с валидным SKU/offer_id для Ozon";
    await handleOrderError(
      error,
      webhook,
      firstName,
      lastName,
      phone,
      deliveryType,
      payment,
    );
    return { success: false, error };
  }

  // Сохраняем заказ как pending
  const insertStmt = db.query(`
    INSERT INTO orders (tilda_order_id, status, buyer_name, buyer_phone, buyer_email, delivery_type, delivery_address, items_json, webhook_body)
    VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?)
  `);

  if (!existingOrder) {
    insertStmt.run(
      tildaOrderId,
      `${firstName} ${lastName}`,
      phone,
      webhook.Email || "",
      deliveryType,
      payment.delivery_address,
      JSON.stringify(items),
      JSON.stringify(webhook),
    );
  }

  try {
    // Шаг 1: Для курьера — геокодирование адреса (нужно и для checkout, и для order/create)
    let courierCoords: { lat: number; lon: number } | null = null;
    if (deliveryType === "courier") {
      courierCoords = await geocodeAddress(payment.delivery_address);
      if (!courierCoords) {
        throw new Error(
          `Не удалось геокодировать адрес: "${payment.delivery_address}"`,
        );
      }
    }

    // Шаг 2: /v2/delivery/checkout для получения splits
    const checkoutBody = buildCheckoutBody(
      deliveryType,
      mapPointId,
      items,
      courierCoords,
    );
    logger.log(`🔄 Checkout для заказа ${tildaOrderId}...`);
    logger.log(`   Checkout body: ${JSON.stringify(checkoutBody)}`);

    const checkoutResult = await queuedOzonRequest(
      "/v2/delivery/checkout",
      "POST",
      checkoutBody,
    );

    if (checkoutResult.queued) {
      throw new Error("Запрос поставлен в очередь — требуется авторизация");
    }

    const checkoutData = checkoutResult.data as any;
    logger.log(`   Checkout response: ${JSON.stringify(checkoutData)}`);
    const splits: OzonOrderSplit[] = [];

    if (!checkoutData.splits || checkoutData.splits.length === 0) {
      throw new Error("Ozon checkout не вернул доступных splits");
    }

    for (const split of checkoutData.splits) {
      if (
        split.unavailable_reason &&
        split.unavailable_reason !== "UNSPECIFIED"
      ) {
        logger.warn(`⚠️ Split недоступен: ${split.unavailable_reason}`);
        continue;
      }

      const timeslot = split.delivery_method?.timeslots?.[0];
      if (!timeslot) {
        logger.warn("⚠️ Нет доступного timeslot в split");
        continue;
      }

      splits.push({
        delivery_method: {
          delivery_method_id: split.delivery_method.delivery_method_id || 0,
          delivery_type: deliveryType === "courier" ? "COURIER" : "PICKUP",
          logistic_date_range: {
            from:
              timeslot.logistic_date_range?.from ||
              timeslot.client_date_range?.from ||
              "",
            to:
              timeslot.logistic_date_range?.to ||
              timeslot.client_date_range?.to ||
              "",
          },
          timeslot_id: timeslot.timeslot_id || 0,
        },
        items: (split.items && split.items.length > 0
          ? split.items.map((i: any) => {
              // Берём sku/offer_id из checkout ответа, фоллбэк на наши items
              const matchedItem = items.find(
                (it) =>
                  (i.sku && it.sku === i.sku) ||
                  (i.offer_id && it.offer_id === i.offer_id),
              );
              return {
                offer_id: i.offer_id || matchedItem?.offer_id || "",
                quantity: i.quantity || matchedItem?.quantity || 1,
                sku: i.sku || matchedItem?.sku || 0,
              };
            })
          : items.map((i) => ({
              offer_id: i.offer_id,
              quantity: i.quantity,
              sku: i.sku,
            }))
        ).filter((i: any) => i.sku > 0 || (i.offer_id && i.offer_id !== "")),
        warehouse_id: split.warehouse_id || 0,
      });
    }

    if (splits.length === 0) {
      throw new Error("Нет доступных splits для доставки");
    }

    // Шаг 3: Формируем delivery
    let delivery: OzonOrderCreateRequest["delivery"];

    if (deliveryType === "courier") {
      delivery = {
        address: {
          coordinates: { lat: courierCoords!.lat, long: courierCoords!.lon },
        },
      };
    } else {
      if (!mapPointId) {
        throw new Error("Не указан map_point_id для ПВЗ доставки");
      }
      delivery = {
        pick_up: { map_point_id: mapPointId },
      };
    }

    // Шаг 3: /v2/order/create
    const orderBody: OzonOrderCreateRequest = {
      buyer: {
        first_name: firstName,
        last_name: lastName,
        phone,
      },
      delivery,
      delivery_schema: "MIX",
      recipient: {
        recipient_first_name: firstName,
        recipient_last_name: lastName,
        recipient_phone: phone,
      },
      splits,
    };

    logger.log(`🔄 Создание заказа ${tildaOrderId} в Ozon...`);
    logger.log(`   Order body: ${JSON.stringify(orderBody)}`);

    const orderResult = await queuedOzonRequest(
      "/v2/order/create",
      "POST",
      orderBody,
    );

    if (orderResult.queued) {
      throw new Error("Запрос поставлен в очередь — требуется авторизация");
    }

    const orderData = orderResult.data as OzonOrderCreateResponse;

    // Обновляем заказ в БД
    db.query(
      `
      UPDATE orders SET
        ozon_order_number = ?,
        ozon_postings = ?,
        status = 'created',
        updated_at = datetime('now')
      WHERE tilda_order_id = ?
    `,
    ).run(
      orderData.order_number,
      JSON.stringify(orderData.postings),
      tildaOrderId,
    );

    logger.log(`✅ Заказ создан: ${orderData.order_number}`);
    logger.log(`   Postings: ${orderData.postings.join(", ")}`);

    return {
      success: true,
      orderNumber: orderData.order_number,
      postings: orderData.postings,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : JSON.stringify(error);

    logger.critical(`Ошибка создания заказа ${tildaOrderId}`, errorMsg);

    // Обновляем статус в БД
    db.query(
      `
      UPDATE orders SET
        status = 'error',
        error_message = ?,
        updated_at = datetime('now')
      WHERE tilda_order_id = ?
    `,
    ).run(errorMsg, tildaOrderId);

    await handleOrderError(
      errorMsg,
      webhook,
      firstName,
      lastName,
      phone,
      deliveryType,
      payment,
    );

    return { success: false, error: errorMsg };
  }
}

/**
 * Разбирает ФИО на имя и фамилию
 */
function parseName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { firstName: parts.slice(1).join(" "), lastName: parts[0] };
  }
  return { firstName: parts[0] || "", lastName: "" };
}

/**
 * Нормализует телефон в формат 7XXXXXXXXXX
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8") && digits.length === 11) {
    return "7" + digits.slice(1);
  }
  if (digits.startsWith("+7")) {
    return digits.slice(1);
  }
  if (digits.startsWith("7") && digits.length === 11) {
    return digits;
  }
  return digits;
}

/**
 * Резолвит товары из Tilda в формат Ozon
 * Сначала пробует SKU из webhook, затем таблицу sku_mapping.
 * Для товаров с SKU — резолвит offer_id через /v3/product/info/list.
 */
async function resolveItems(
  products: TildaWebhookBody["payment"]["products"],
): Promise<{ sku: number; quantity: number; offer_id: string }[]> {
  const items: { sku: number; quantity: number; offer_id: string }[] = [];
  const skusToResolve: number[] = [];
  const skuItemIndices: { index: number; sku: number }[] = [];

  for (const product of products) {
    // Пробуем SKU напрямую из webhook (Тильда передаёт Ozon SKU в поле sku)
    const directSku = parseInt(product.sku, 10);

    if (directSku > 0) {
      const idx = items.length;
      items.push({
        sku: directSku,
        quantity: product.quantity,
        offer_id: "", // будет заполнен после резолва
      });
      skusToResolve.push(directSku);
      skuItemIndices.push({ index: idx, sku: directSku });
      continue;
    }

    // Фоллбэк: ищем в таблице маппинга
    const mapping = db
      .query(
        "SELECT ozon_sku, ozon_offer_id FROM sku_mapping WHERE tilda_externalid = ?",
      )
      .get(product.externalid) as SkuMappingRow | null;

    if (mapping) {
      items.push({
        sku: mapping.ozon_sku,
        quantity: product.quantity,
        offer_id: mapping.ozon_offer_id,
      });
    } else {
      logger.warn(
        `⚠️ Нет маппинга для товара: ${product.externalid} (${product.name}), SKU: ${product.sku}`,
      );
    }
  }

  // Резолвим offer_id для товаров с SKU через Ozon API
  if (skusToResolve.length > 0) {
    const offerIdMap = await resolveOfferIds(skusToResolve);
    for (const { index, sku } of skuItemIndices) {
      const offerId = offerIdMap.get(sku);
      if (offerId) {
        items[index].offer_id = offerId;
      } else {
        logger.warn(
          `⚠️ Не удалось получить offer_id для SKU ${sku} — оставляем пустым, отправим только sku`,
        );
      }
    }
  }

  return items;
}

/**
 * Формирует body для /v2/delivery/checkout
 */
function buildCheckoutBody(
  deliveryType: string,
  mapPointId: number,
  items: { sku: number; quantity: number; offer_id: string }[],
  courierCoords: { lat: number; lon: number } | null,
) {
  const checkoutItems = items.map((item) => {
    const obj: Record<string, any> = { quantity: item.quantity };
    if (item.sku > 0) obj.sku = item.sku;
    if (item.offer_id) obj.offer_id = item.offer_id;
    return obj;
  });

  if (deliveryType === "courier" && courierCoords) {
    return {
      delivery_schema: "MIX",
      delivery_type: {
        courier: {
          coordinates: {
            latitude: courierCoords.lat,
            longitude: courierCoords.lon,
          },
        },
      },
      items: checkoutItems,
    };
  }

  return {
    delivery_schema: "MIX",
    delivery_type: {
      pick_up: { map_point_id: mapPointId },
    },
    items: checkoutItems,
  };
}

/**
 * Обработка ошибки: email-уведомление
 */
async function handleOrderError(
  error: string,
  webhook: TildaWebhookBody,
  firstName: string,
  lastName: string,
  phone: string,
  deliveryType: string,
  payment: TildaWebhookBody["payment"],
): Promise<void> {
  try {
    await sendOrderErrorEmail({
      error,
      buyer: {
        name: `${firstName} ${lastName}`.trim(),
        phone,
        email: webhook.Email || "",
      },
      items: payment.products.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        sku: p.sku,
      })),
      delivery: {
        type: deliveryType,
        address: payment.delivery_address,
      },
      webhookBody: webhook,
    });
  } catch (emailError) {
    logger.error("❌ Не удалось отправить email об ошибке:", emailError);
  }
}
