import Elysia, { t } from "elysia";
import { checkDeliveryAvailability } from "../../services/ozon-logistics/delivery";
import { getDeliveryPrice } from "../../services/ozon-logistics/checkout";
import {
  getTildaPickupPoints,
  getAllTildaPickupPoints,
  getCacheStatus,
  getTildaPickupPointsByViewport,
} from "../../services/pickup-points-cache";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { ozonConfig } from "../../config/env";

export const delivery = new Elysia({ prefix: "/v1" })
  .post(
    "/delivery/check",
    async ({ body }) => {
      try {
        const result = await checkDeliveryAvailability(body.client_phone);
        return result;
      } catch (error) {
        console.error("❌ Ошибка в endpoint /delivery/check:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        client_phone: t.String({ pattern: "^7\\d{10}$" }),
      }),
    },
  )
  // Endpoint для приёма callback'а от Tilda после оплаты (success)
  .post(
    "/delivery/tilda/success",
    async ({ body }) => {
      try {
        console.log("🔔 Получен callback от Tilda /delivery/tilda/success");
        console.log(JSON.stringify(body));

        const LOG_DIR = join(__dirname, "..", "..", "cache");
        if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
        const file = join(LOG_DIR, "tilda-callbacks.log");
        const entry = JSON.stringify({
          received_at: new Date().toISOString(),
          body: body,
        });
        appendFileSync(file, entry + "\n", "utf-8");

        return { success: true };
      } catch (error) {
        console.error("❌ Ошибка в /delivery/tilda/success:", error);
        throw error;
      }
    },
    { body: t.Any() },
  )
  // Endpoint для создания заказа — пока логируем входящий запрос целиком
  .post(
    "/order/create",
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

        // Проверка API-ключа от Тильды
        const apiKey =
          headers["api-key"] || request.headers.get("api-key") || "";
        const expectedKey = ozonConfig.tildaWebhookApiKey;

        if (expectedKey && apiKey !== expectedKey) {
          console.warn(`⚠️  /order/create — неверный API-ключ от ${sourceIp}`);
          set.status = 403;
          return { success: false, error: "Forbidden" };
        }

        console.log("🛒 Получен запрос на создание заказа /order/create");
        console.log(`   Source IP: ${sourceIp}`);
        console.log(`   Origin: ${origin}`);
        console.log(`   Referer: ${referer}`);
        console.log(`   Body: ${JSON.stringify(body)}`);

        const LOG_DIR = join(__dirname, "..", "..", "cache");
        if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
        const file = join(LOG_DIR, "order-create.log");
        const entry = JSON.stringify({
          received_at: new Date().toISOString(),
          source_ip: sourceIp,
          origin,
          referer,
          user_agent: userAgent,
          api_key_valid: !expectedKey || apiKey === expectedKey,
          headers: Object.fromEntries(
            [...request.headers.entries()].filter(
              ([k]) =>
                !k.toLowerCase().includes("authorization") &&
                !k.toLowerCase().includes("cookie"),
            ),
          ),
          body,
        });
        appendFileSync(file, entry + "\n", "utf-8");

        return { success: true, message: "Заказ принят в обработку" };
      } catch (error) {
        console.error("❌ Ошибка в /order/create:", error);
        throw error;
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
        console.error("❌ Ошибка в endpoint /delivery/pvz:", error);
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
      console.error("❌ Ошибка в endpoint /delivery/pvz/all:", error);
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
    "/delivery/price",
    async ({ body }) => {
      try {
        console.log(
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
        console.error("❌ Ошибка в endpoint /delivery/price:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        mapPointId: t.Number(),
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
    ({ body }) => {
      const { viewport, zoom } = body;

      // При маленьком zoom слишком много точек — не имеет смысла
      if (zoom < 10) {
        return [];
      }

      const points = getTildaPickupPointsByViewport({
        latMin: viewport.left_bottom.lat,
        latMax: viewport.right_top.lat,
        lngMin: viewport.left_bottom.long,
        lngMax: viewport.right_top.long,
        // Чем больше zoom — тем меньше viewport — можно больше точек
        limit: zoom >= 14 ? 500 : zoom >= 12 ? 200 : 100,
      });

      return points;
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
  );
