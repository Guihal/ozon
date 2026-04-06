import Bottleneck from "bottleneck";
import * as logger from "./logger";

// 10 запросов/секунду, очередь до 1000
const limiter = new Bottleneck({
  minTime: Math.ceil(1000 / 10),
  maxConcurrent: 10,
  highWater: 1000,
  strategy: Bottleneck.strategy.OVERFLOW,
});

limiter.on("error", (error: unknown) => {
  logger.error("❌ Rate limiter: ошибка", error);
});

limiter.on("dropped", () => {
  logger.critical(
    "Rate limiter: запрос отклонён (очередь переполнена)",
    "highWater=1000 exceeded",
    {},
  );
});

export const ozonRateLimiter = limiter;

export async function rateLimitedFetch(
  url: string | URL,
  options?: RequestInit,
): Promise<Response> {
  return limiter.schedule(() => fetch(url.toString(), options));
}
