import Elysia, { t } from "elysia";
import { checkDeliveryAvailability } from "../../services/ozon-logistics/delivery";
import { getDeliveryPrice } from "../../services/ozon-logistics/checkout";
import {
  getTildaPickupPoints,
  getAllTildaPickupPoints,
  getCacheStatus,
} from "../../services/pickup-points-cache";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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
    async ({ body, raw }) => {
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
  );
