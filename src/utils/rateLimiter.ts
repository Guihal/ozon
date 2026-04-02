/**
 * Rate Limiter для API Ozon
 *
 * Алгоритм: фиксированный интервал между запросами (token bucket / sliding window).
 * Каждый запрос отправляется не раньше, чем lastRequestTime + (1000 / requestsPerSecond).
 * Пока лимит не достигнут — запросы пролетают мгновенно.
 */

interface QueueItem {
  execute: () => Promise<Response>;
  resolve: (value: Response) => void;
  reject: (error: Error) => void;
}

export class RateLimiter {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;

  constructor(
    private readonly requestsPerSecond: number = 35,
    private readonly maxQueueSize: number = 1000,
  ) {}

  /** Минимальный интервал между запросами в ms */
  private get minInterval(): number {
    return 1000 / this.requestsPerSecond;
  }

  /**
   * Добавляет запрос в очередь и возвращает Promise с результатом.
   * Если очередь переполнена — сразу отбрасывает с ошибкой.
   */
  async enqueue<T extends Response>(fetchFn: () => Promise<T>): Promise<T> {
    if (this.queue.length >= this.maxQueueSize) {
      const error = new Error(
        `Rate limiter: очередь переполнена (${this.maxQueueSize}). Запрос отклонён.`,
      );
      console.error("❌", error.message);
      throw error;
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: fetchFn as () => Promise<Response>,
        resolve: resolve as (value: Response) => void,
        reject,
      });

      this.scheduleProcessing();
    });
  }

  /**
   * Планирует запуск обработки очереди.
   * Если обработка уже идёт — ничего не делает (re-check после завершения покрыет новый элемент).
   */
  private scheduleProcessing(): void {
    if (this.isProcessing) return;

    const waitMs = this.timeUntilNextSlot();

    if (waitMs <= 0) {
      // Слот свободен прямо сейчас — запускаем через microtask,
      // чтобы не блокировать стек вызовов enqueue
      Promise.resolve().then(() => this.processQueue());
    } else {
      setTimeout(() => this.processQueue(), waitMs);
    }
  }

  /**
   * Сколько мс нужно подождать до следующего разрешённого момента запроса.
   * 0 — если можно выполнять сразу.
   */
  private timeUntilNextSlot(): number {
    if (this.lastRequestTime === 0) return 0;
    const elapsed = Date.now() - this.lastRequestTime;
    return Math.max(0, this.minInterval - elapsed);
  }

  /**
   * Основной цикл обработки очереди.
   *
   * Ключевые гарантии:
   * - try-catch вокруг ВСЕГО тела → isProcessing ВСЕГДА сбрасывается
   * - после выхода из while — перепроверка очереди (защита от race condition,
   *   когда enqueue добавил элемент в момент завершения цикла)
   * - ни один запрос не зависнет: каждый элемент очереди получит resolve/reject
   */
  private async processQueue(): Promise<void> {
    // Двойная проверка: если кто-то уже обрабатывает — выходим
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // Ждём до ближайшего свободного слота
        const waitMs = this.timeUntilNextSlot();
        if (waitMs > 0) {
          console.warn(
            `⏳ Rate limiter: ожидание ${waitMs}ms (лимит ${this.requestsPerSecond} req/s, очередь: ${this.queue.length})`,
          );
          await this.sleep(waitMs);
        }

        // Извлекаем элемент из очереди
        const item = this.queue.shift();
        if (!item) break;

        // Фиксируем время отправки ДО выполнения,
        // чтобы следующий запрос уже отсчитывался от этого момента
        this.lastRequestTime = Date.now();

        try {
          const response = await item.execute();
          item.resolve(response);
        } catch (error) {
          console.error("❌ Rate limiter: ошибка выполнения запроса:", error);
          item.reject(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    } catch (fatalError) {
      // Непредвиденная ошибка (не из execute — он обёрнут своим try-catch)
      console.error(
        "❌ Rate limiter: фатальная ошибка processQueue:",
        fatalError,
      );
    } finally {
      // ВСЕГДА сбрасываем флаг обработки
      this.isProcessing = false;

      // ПЕРЕПРОВЕРКА: если в момент, когда мы сбросили isProcessing,
      // кто-то добавил элемент в очередь — запускаем обработку заново.
      // Это защищает от race condition: enqueue проверил isProcessing === true
      // и не вызвал scheduleProcessing, но мы уже выходили.
      if (this.queue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Текущий размер очереди */
  getQueueSize(): number {
    return this.queue.length;
  }

  /** Очищает очередь, отклоняя все ожидающие запросы */
  clearQueue(): void {
    const count = this.queue.length;
    this.queue.forEach((item) =>
      item.reject(new Error("Rate limiter: очередь очищена")),
    );
    this.queue = [];
    if (count > 0) {
      console.warn(
        `🗑️ Rate limiter: очередь очищена, отклонено ${count} запросов`,
      );
    }
  }

  /** Статистика для мониторинга */
  getStats(): {
    queueSize: number;
    maxQueueSize: number;
    requestsPerSecond: number;
    minIntervalMs: number;
  } {
    return {
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      requestsPerSecond: this.requestsPerSecond,
      minIntervalMs: this.minInterval,
    };
  }
}

// ─── Глобальный экземпляр ────────────────────────────────────────────────────

export const ozonRateLimiter = new RateLimiter(10, 1000);

/**
 * Обёртка для fetch с rate limiting.
 * Пропускает запросы через очередь ozonRateLimiter.
 */
export async function rateLimitedFetch(
  url: string | URL,
  options?: RequestInit,
): Promise<Response> {
  return ozonRateLimiter.enqueue(() => fetch(url, options));
}
