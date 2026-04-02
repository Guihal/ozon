/**
 * Rate Limiter для API Ozon
 * Ограничивает количество запросов до 10 в секунду
 * Очередь до 1000 запросов, остальные отбрасываются
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
  private requestCount = 0;
  private lastSecondReset = Date.now();

  constructor(
    private readonly requestsPerSecond: number = 10,
    private readonly maxQueueSize: number = 1000,
  ) {}

  /**
   * Добавляет запрос в очередь
   * @param fetchFn - функция, выполняющая fetch запрос
   * @returns Promise с ответом
   */
  async enqueue<T extends Response>(fetchFn: () => Promise<T>): Promise<T> {
    // Проверяем размер очереди
    if (this.queue.length >= this.maxQueueSize) {
      const error = new Error(
        `Превышен лимит очереди запросов (${this.maxQueueSize}). Запрос отклонён.`,
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

      console.log(
        `📥 Запрос добавлен в очередь. Размер очереди: ${this.queue.length}`,
      );

      // Запускаем обработку очереди
      this.processQueue();
    });
  }

  /**
   * Обрабатывает очередь запросов с ограничением скорости
   */
  private async processQueue(): Promise<void> {
    // Если уже обрабатываем или очередь пуста - выходим
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();

      // Сбрасываем счётчик каждую секунду
      if (now - this.lastSecondReset >= 1000) {
        this.requestCount = 0;
        this.lastSecondReset = now;
      }

      // Если достигли лимита запросов в секунду - ждём
      if (this.requestCount >= this.requestsPerSecond) {
        const waitTime = 1000 - (now - this.lastSecondReset);
        console.log(
          `⏳ Достигнут лимит ${this.requestsPerSecond} req/s. Ожидание ${waitTime}ms...`,
        );
        await this.sleep(waitTime);
        continue;
      }

      // Вычисляем минимальное время между запросами
      const minInterval = 1000 / this.requestsPerSecond;
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Если прошло недостаточно времени - ждём
      if (timeSinceLastRequest < minInterval && this.lastRequestTime > 0) {
        const waitTime = minInterval - timeSinceLastRequest;
        await this.sleep(waitTime);
      }

      // Извлекаем запрос из очереди
      const item = this.queue.shift();
      if (!item) break;

      try {
        this.lastRequestTime = Date.now();
        this.requestCount++;

        console.log(
          `🚀 Выполнение запроса. Счётчик: ${this.requestCount}/${this.requestsPerSecond} req/s`,
        );

        const response = await item.execute();
        item.resolve(response);
      } catch (error) {
        console.error("❌ Ошибка выполнения запроса:", error);
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessing = false;
  }

  /**
   * Утилита для задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Получает текущий размер очереди
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Очищает очередь
   */
  clearQueue(): void {
    const rejectedCount = this.queue.length;
    this.queue.forEach((item) => {
      item.reject(new Error("Очередь очищена"));
    });
    this.queue = [];
    console.log(`🗑️ Очередь очищена. Отклонено запросов: ${rejectedCount}`);
  }

  /**
   * Получает статистику
   */
  getStats(): {
    queueSize: number;
    maxQueueSize: number;
    requestsPerSecond: number;
    currentRequestCount: number;
  } {
    return {
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      requestsPerSecond: this.requestsPerSecond,
      currentRequestCount: this.requestCount,
    };
  }
}

// Глобальный экземпляр rate limiter для Ozon API
export const ozonRateLimiter = new RateLimiter(10, 1000);

/**
 * Обёртка для fetch с rate limiting
 * @param url - URL запроса
 * @param options - параметры fetch
 * @returns Promise<Response>
 */
export async function rateLimitedFetch(
  url: string | URL,
  options?: RequestInit,
): Promise<Response> {
  return ozonRateLimiter.enqueue(() => fetch(url, options));
}
