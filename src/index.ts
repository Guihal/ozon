import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { delivery } from "./modules/delivery/delivery";
import { auth } from "./modules/auth/auth";
import { ozonConfig } from "./config/env";
import { initializePickupPointsCache } from "./services/pickup-points-cache";
import * as logger from "./utils/logger";

// Обработчики необработанных ошибок процесса
process.on("uncaughtException", (err) => {
  logger.critical("uncaughtException", err.message, { stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const details =
    reason instanceof Error ? { stack: reason.stack } : { reason };
  logger.critical("unhandledRejection", message, details);
});

process.on("SIGTERM", () => {
  logger.warn("⛔ SIGTERM получен — завершение процесса");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.warn("⛔ SIGINT получен — завершение процесса");
  process.exit(0);
});

const app = new Elysia()
  .use(
    cors({
      origin: true, // Allow all for dev, configure for production
      methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Api-Key",
      ],
      // exposedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      maxAge: 86400, // 24 hours
    }),
  )
  .use(delivery)
  .use(auth)
  .get("/", () => ({ status: "ok", service: "ozon-logistics-api" }))
  .listen(ozonConfig.port);

logger.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

// Инициализация кэша точек самовывоза при запуске

setTimeout(() => {
  initializePickupPointsCache().catch((error) => {
    logger.critical(
      "Инициализация кэша ПВЗ",
      error instanceof Error ? error.message : String(error),
      error,
    );
  });
}, 1000);

export type App = typeof app;
