import Elysia, { t } from "elysia";
import * as logger from "../../utils/logger";
import {
  checkDeliveryAvailability,
  getDeliveryMapClusters,
} from "../../services/ozon-logistics/delivery";
import {
  getDeliveryPrice,
  getCourierDeliveryPrice,
} from "../../services/ozon-logistics/checkout";
import { createOzonOrder } from "../../services/ozon-logistics/order";
import { geocodeAddress } from "../../utils/geocode";
import {
  getTildaPickupPoints,
  getAllTildaPickupPoints,
  getCacheStatus,
  getTildaPickupPointsByViewport,
  getTildaPickupPointsByIds,
} from "../../services/pickup-points-cache";
import { db } from "../../db";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { ozonConfig } from "../../config/env";
import type { TildaWebhookBody } from "../../services/ozon-logistics/types";

// Rate limiter для /delivery/map — защита от спама при скролле карты
const mapRequestLog: number[] = [];

export const delivery = new Elysia({ prefix: "/v1" })
  .post(
    "/delivery/check",
    async ({ body }) => {
      try {
        const result = await checkDeliveryAvailability(body.client_phone);
        return result;
      } catch (error) {
        logger.error("❌ Ошибка в endpoint /delivery/check:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        client_phone: t.String({ pattern: "^7\\d{10}$" }),
      }),
    },
  )
  // HEAD/GET для Tilda — проверяет доступность webhook URL перед сохранением
  .head("/order/webhook", () => new Response(null, { status: 200 }))
  .get("/order/webhook", () => ({
    success: true,
    message: "Webhook endpoint is active",
  }))
  // Endpoint для создания заказа — вызывает Ozon API
  .post(
    "/order/webhook",
    async ({ body, request, headers, set }) => {
      try {
        const sourceIp =
          headers["x-forwarded-for"] ||
          headers["x-real-ip"] ||
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown";
        const origin = headers["origin"] || request.headers.get("origin") || "";
        const referer =
          headers["referer"] || request.headers.get("referer") || "";
        const userAgent =
          headers["user-agent"] || request.headers.get("user-agent") || "";

        // Проверка API-ключа от Тильды (header или POST body)
        const apiKey =
          headers["api-key"] ||
          request.headers.get("api-key") ||
          (body as any)?.["Api-Key"] ||
          (body as any)?.["api-key"] ||
          (body as any)?.["apikey"] ||
          "";
        const expectedKey = ozonConfig.tildaWebhookApiKey;

        if (expectedKey && apiKey !== expectedKey) {
          logger.warn(`⚠️  /order/webhook — неверный API-ключ от ${sourceIp}`);
          // Всегда 200 для Тильды — иначе она блочит webhook
          return { success: false, error: "Invalid API key" };
        }

        logger.log("🛒 Получен запрос на создание заказа /order/create");
        logger.log(`   Source IP: ${sourceIp}`);
        logger.log(`   Origin: ${origin}`);
        logger.log(`   Referer: ${referer}`);

        // Тестовый запрос от Тильды при проверке URL — нет данных заказа
        if (
          !body ||
          typeof body !== "object" ||
          !(body as any).payment ||
          !(body as any).payment?.orderid
        ) {
          logger.log(
            "ℹ️  Тестовый запрос (нет payment.orderid) — отвечаем 200",
          );
          return { success: true, message: "Webhook endpoint is active" };
        }

        // Логируем webhook (без sensitive данных)
        const LOG_DIR = join(__dirname, "..", "..", "cache");
        if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
        const file = join(LOG_DIR, "order-create.log");
        const payment = (body as any)?.payment;
        const entry = JSON.stringify({
          received_at: new Date().toISOString(),
          source_ip: sourceIp,
          order_id: payment?.orderid,
          delivery: payment?.delivery,
          products_count: payment?.products?.length,
        });
        appendFileSync(file, entry + "\n", "utf-8");

        // Создаём заказ в Ozon
        const webhook = body as TildaWebhookBody;
        const result = await createOzonOrder(webhook);

        if (!result.success) {
          // Всегда 200 для Тильды — иначе она блочит webhook
          return {
            success: false,
            error: result.error,
            message: "Ошибка создания заказа — уведомление отправлено",
          };
        }

        return {
          success: true,
          message: "Заказ создан в Ozon",
          orderNumber: result.orderNumber,
          postings: result.postings,
        };
      } catch (error) {
        logger.error("❌ Ошибка в /order/webhook:", error);
        // Всегда 200 для Тильды — иначе она блочит webhook
        return {
          success: false,
          error: error instanceof Error ? error.message : "Неизвестная ошибка",
        };
      }
    },
    { body: t.Any() },
  )
  .get(
    "/delivery/pvz",
    ({ query }) => {
      try {
        const { q, limit, offset } = query;

        const result = getTildaPickupPoints({
          q: q || undefined,
          limit: limit || 500,
          offset: offset || 0,
        });

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error("❌ Ошибка в endpoint /delivery/pvz:", error);
        throw error;
      }
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        limit: t.Optional(t.Number({ maximum: 5000 })),
        offset: t.Optional(t.Number()),
      }),
    },
  )
  .get("/delivery/pvz/all", () => {
    try {
      const pvz = getAllTildaPickupPoints();
      return {
        success: true,
        count: pvz.length,
        pvz,
      };
    } catch (error) {
      logger.error("❌ Ошибка в endpoint /delivery/pvz/all:", error);
      throw error;
    }
  })
  .get("/delivery/pvz/status", () => {
    return {
      success: true,
      ...getCacheStatus(),
    };
  })
  .post(
    "/delivery/geocode",
    async ({ body, set }) => {
      try {
        const result = await geocodeAddress(body.address);
        if (!result) {
          return { success: false, error: "Адрес не найден" };
        }
        return { success: true, lat: result.lat, lon: result.lon };
      } catch (error) {
        logger.error("❌ Ошибка в endpoint /delivery/geocode:", error);
        return { success: false, error: "Ошибка геокодирования" };
      }
    },
    {
      body: t.Object({
        address: t.String({ minLength: 3 }),
      }),
    },
  )
  .post(
    "/delivery/price",
    async ({ body, set }) => {
      try {
        logger.log(
          `🔄 Получение цены доставки для точки ${body.mapPointId}...`,
        );

        const result = await getDeliveryPrice({
          mapPointId: body.mapPointId,
          items: body.items,
          buyerPhone: body.buyerPhone,
        });

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error("❌ Ошибка в endpoint /delivery/price:", error);
        set.status = 500;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Доставка недоступна",
        };
      }
    },
    {
      body: t.Object({
        mapPointId: t.Number(),
        items: t.Array(
          t.Object({
            sku: t.Optional(t.Number()),
            quantity: t.Number(),
            offer_id: t.Optional(t.String()),
          }),
        ),
        buyerPhone: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/delivery/courier/price",
    async ({ body, set }) => {
      try {
        logger.log(
          `🔄 Получение цены курьерской доставки (${body.latitude}, ${body.longitude})...`,
        );

        const result = await getCourierDeliveryPrice({
          latitude: body.latitude,
          longitude: body.longitude,
          items: body.items,
          buyerPhone: body.buyerPhone,
        });

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error("❌ Ошибка в endpoint /delivery/courier/price:", error);
        set.status = 500;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Доставка недоступна",
        };
      }
    },
    {
      body: t.Object({
        latitude: t.Number(),
        longitude: t.Number(),
        items: t.Array(
          t.Object({
            sku: t.Number(),
            quantity: t.Number(),
            offer_id: t.String(),
          }),
        ),
        buyerPhone: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/delivery/map",
    async ({ body, set }) => {
      // Rate limit: макс 10 запросов в секунду
      const now = Date.now();
      mapRequestLog.push(now);
      while (mapRequestLog.length > 0 && mapRequestLog[0] < now - 1000) {
        mapRequestLog.shift();
      }
      if (mapRequestLog.length > 10) {
        set.status = 429;
        return [];
      }

      const { viewport, zoom } = body;

      // При маленьком zoom слишком много точек — не имеет смысла
      if (zoom < 10) {
        return [];
      }

      try {
        // Проксируем запрос к Ozon API — получаем кластеры
        const { clusters } = await getDeliveryMapClusters(viewport, zoom);

        // Собираем все map_point_ids из кластеров
        const allIds = clusters.flatMap((c) => c.map_point_ids);
        if (allIds.length === 0) return [];

        // Обогащаем данными из локальной БД (быстрый PK-lookup)
        const points = getTildaPickupPointsByIds(allIds);
        return points;
      } catch (error) {
        logger.error("❌ Ошибка проксирования /delivery/map:", error);
        // Fallback на локальную БД при ошибке Ozon API
        const points = getTildaPickupPointsByViewport({
          latMin: viewport.left_bottom.lat,
          latMax: viewport.right_top.lat,
          lngMin: viewport.left_bottom.long,
          lngMax: viewport.right_top.long,
          limit: zoom >= 14 ? 200 : zoom >= 12 ? 100 : 50,
        });
        return points;
      }
    },
    {
      body: t.Object({
        viewport: t.Object({
          left_bottom: t.Object({ lat: t.Number(), long: t.Number() }),
          right_top: t.Object({ lat: t.Number(), long: t.Number() }),
        }),
        zoom: t.Number(),
      }),
    },
  )
  // === Admin endpoints ===
  .post(
    "/admin/sku-mapping",
    async ({ body, set }) => {
      if (ozonConfig.isProd) {
        set.status = 403;
        return { success: false, error: "Forbidden in production" };
      }

      try {
        const stmt = db.query(`
          INSERT OR REPLACE INTO sku_mapping (tilda_externalid, ozon_sku, ozon_offer_id, product_name)
          VALUES (?, ?, ?, ?)
        `);

        for (const item of body.mappings) {
          stmt.run(
            item.tilda_externalid,
            item.ozon_sku,
            item.ozon_offer_id,
            item.product_name || null,
          );
        }

        logger.log(
          `✅ SKU mapping: добавлено/обновлено ${body.mappings.length} записей`,
        );

        return {
          success: true,
          count: body.mappings.length,
        };
      } catch (error) {
        logger.error("❌ Ошибка в /admin/sku-mapping:", error);
        set.status = 500;
        return {
          success: false,
          error: error instanceof Error ? error.message : "Неизвестная ошибка",
        };
      }
    },
    {
      body: t.Object({
        mappings: t.Array(
          t.Object({
            tilda_externalid: t.String(),
            ozon_sku: t.Number(),
            ozon_offer_id: t.String(),
            product_name: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )
  .get("/admin/sku-mapping", ({ set }) => {
    if (ozonConfig.isProd) {
      set.status = 403;
      return { success: false, error: "Forbidden in production" };
    }

    const rows = db
      .query("SELECT * FROM sku_mapping ORDER BY created_at DESC")
      .all();
    return { success: true, mappings: rows };
  })
  .get(
    "/admin/orders",
    ({ query, set }) => {
      if (ozonConfig.isProd) {
        set.status = 403;
        return { success: false, error: "Forbidden in production" };
      }

      const limit = query.limit || 50;
      const offset = query.offset || 0;

      const rows = db
        .query(
          "SELECT id, tilda_order_id, ozon_order_number, status, buyer_name, buyer_phone, delivery_type, error_message, created_at FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .all(limit, offset);
      const total = db.query("SELECT COUNT(*) as count FROM orders").get() as {
        count: number;
      };

      return { success: true, orders: rows, total: total.count };
    },
    {
      query: t.Object({
        limit: t.Optional(t.Number({ maximum: 200 })),
        offset: t.Optional(t.Number()),
      }),
    },
  );
