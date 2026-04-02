import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { delivery } from "./modules/delivery/delivery";
import { auth } from "./modules/auth/auth";
import { ozonConfig } from "./config/env";
import { initializePickupPointsCache } from "./services/pickup-points-cache";

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

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

// Инициализация кэша точек самовывоза при запуске

setTimeout(() => {
  initializePickupPointsCache().catch((error) => {
    console.error("❌ Ошибка инициализации кэша точек самовывоза:", error);
  });
}, 1000);

export type App = typeof app;
