import Elysia, { t } from "elysia";
import { checkDeliveryAvailability } from "../../services/ozon-logistics/delivery";
import { mapToTildaPickupPoint } from "../../services/ozon-logistics/mapper";
import { getDeliveryPrice } from "../../services/ozon-logistics/checkout";
import { loadPointsInfo } from "../../services/pickup-points-cache";
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
  .get("/delivery/pvz", async () => {
    try {
      console.log("🔄 Получение кэша ПВЗ в формате Tilda...");

      const cacheData = loadPointsInfo();
      if (!cacheData || !cacheData.points) {
        console.warn("⚠️  Кэш ПВЗ не найден");
        return {
          success: false,
          error: "Кэш точек самовывоза не инициализирован",
          pvz: [],
        };
      }

      // Преобразуем все точки в формат Tilda
      const tildaPoints = cacheData.points
        .map((point) => mapToTildaPickupPoint(point))
        .filter((point) => point !== null);

      console.log(`✅ Отправлено ${tildaPoints.length} точек в формате Tilda`);

      return {
        success: true,
        count: tildaPoints.length,
        pvz: tildaPoints,
      };
    } catch (error) {
      console.error("❌ Ошибка в endpoint /delivery/pvz:", error);
      throw error;
    }
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
