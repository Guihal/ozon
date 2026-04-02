/**
 * Система логирования с временными метками
 * Формат: [HH:MM:SS] [сообщение]
 */

/**
 * Получить текущее время в формате HH:MM:SS
 */
function getTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Логирование информационных сообщений
 * @param message - Сообщение для логирования
 * @param args - Дополнительные аргументы
 */
export function log(message: string, ...args: unknown[]): void {
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] ${message}`, ...args);
}

/**
 * Логирование ошибок
 * @param message - Сообщение об ошибке
 * @param args - Дополнительные аргументы
 */
export function error(message: string, ...args: unknown[]): void {
  const timestamp = getTimestamp();
  console.error(`[${timestamp}] ${message}`, ...args);
}

/**
 * Логирование предупреждений
 * @param message - Сообщение предупреждения
 * @param args - Дополнительные аргументы
 */
export function warn(message: string, ...args: unknown[]): void {
  const timestamp = getTimestamp();
  console.warn(`[${timestamp}] ${message}`, ...args);
}

/**
 * Логирование информационных сообщений (alias для log)
 * @param message - Информационное сообщение
 * @param args - Дополнительные аргументы
 */
export function info(message: string, ...args: unknown[]): void {
  const timestamp = getTimestamp();
  console.info(`[${timestamp}] ${message}`, ...args);
}

export default {
  log,
  error,
  warn,
  info,
};
