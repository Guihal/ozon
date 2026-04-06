/**
 * Система логирования с временными метками
 * Формат: [HH:MM:SS] [уровень] сообщение
 *
 * Уровни:
 *  log/info  — информационные сообщения
 *  warn      — предупреждения
 *  error     — ошибки
 *  critical  — критические ошибки: логируются + отправляется email-уведомление
 */

import { sendCriticalErrorEmail } from "./mailer";

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

export function log(message: string, ...args: unknown[]): void {
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] ${message}`, ...args);
}

export function error(message: string, ...args: unknown[]): void {
  const timestamp = getTimestamp();
  console.error(`[${timestamp}] ${message}`, ...args);
}

export function warn(message: string, ...args: unknown[]): void {
  const timestamp = getTimestamp();
  console.warn(`[${timestamp}] ${message}`, ...args);
}

export function info(message: string, ...args: unknown[]): void {
  const timestamp = getTimestamp();
  console.info(`[${timestamp}] ${message}`, ...args);
}

/**
 * Критическая ошибка — логируется в stderr и отправляется email.
 * @param subject - краткая тема (до 80 символов)
 * @param message - подробное сообщение / текст ошибки
 * @param details - любые дополнительные данные (объект, строка и т.д.)
 */
export function critical(
  subject: string,
  message: string,
  details?: unknown,
): void {
  const timestamp = getTimestamp();
  console.error(
    `[${timestamp}] 🔴 CRITICAL: ${subject} — ${message}`,
    details ?? "",
  );

  sendCriticalErrorEmail({ subject, message, details }).catch((err) => {
    console.error(`[${timestamp}] Не удалось отправить critical email:`, err);
  });
}

export default {
  log,
  error,
  warn,
  info,
  critical,
};
