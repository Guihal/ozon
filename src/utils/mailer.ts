import nodemailer from "nodemailer";
import { ozonConfig } from "../config/env";

const AUTH_LINK = "https://orderinme.fvds.ru/auth/url";

// Дебаунс — не шлём чаще чем раз в 5 минут
let lastSentAt = 0;
const DEBOUNCE_MS = 5 * 60 * 1000;

// Дебаунс для ошибок заказов — не чаще раза в 30 секунд
let lastOrderErrorSentAt = 0;
const ORDER_ERROR_DEBOUNCE_MS = 30 * 1000;

function createTransport() {
  if (!ozonConfig.smtpHost || !ozonConfig.smtpUser) {
    return null;
  }
  return nodemailer.createTransport({
    host: ozonConfig.smtpHost,
    port: ozonConfig.smtpPort,
    secure: ozonConfig.smtpPort === 465,
    auth: {
      user: ozonConfig.smtpUser,
      pass: ozonConfig.smtpPass,
    },
  });
}

/**
 * Отправляет уведомление клиенту о необходимости повторной авторизации.
 * Дебаунсится — не чаще раза в 5 минут.
 * Если SMTP не настроен, логирует в консоль.
 */
export async function sendAuthRequiredEmail(
  queuedCount: number,
): Promise<void> {
  const now = Date.now();
  if (now - lastSentAt < DEBOUNCE_MS) {
    return;
  }
  lastSentAt = now;

  const subject = "⚠️ Ozon Logistics: требуется повторная авторизация";
  const html = `
    <h2>Токен авторизации Ozon истёк</h2>
    <p>Автоматическое обновление токена не удалось.</p>
    <p><strong>${queuedCount}</strong> запрос(ов) поставлено в очередь и будет выполнено после авторизации.</p>
    <p>Пожалуйста, пройдите авторизацию по ссылке:</p>
    <p style="margin: 20px 0;">
      <a href="${AUTH_LINK}" 
         style="background:#005bff;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:16px;">
        Авторизоваться в Ozon
      </a>
    </p>
    <p style="color:#888;font-size:12px;">
      Ссылка: <a href="${AUTH_LINK}">${AUTH_LINK}</a>
    </p>
  `;

  const to = ozonConfig.notifyEmail;

  if (!to) {
    console.warn("⚠️  NOTIFY_EMAIL не задан — письмо не отправлено");
    console.warn(`   Тема: ${subject}`);
    console.warn(`   Ссылка для авторизации: ${AUTH_LINK}`);
    return;
  }

  const transport = createTransport();
  if (!transport) {
    console.warn("⚠️  SMTP не настроен — письмо не отправлено");
    console.warn(`   Тема: ${subject}`);
    console.warn(`   Кому: ${to}`);
    console.warn(`   Ссылка для авторизации: ${AUTH_LINK}`);
    return;
  }

  try {
    await transport.sendMail({
      from: ozonConfig.smtpFrom,
      to,
      subject,
      html,
    });
    console.log(`✅ Письмо отправлено на ${to}`);
  } catch (error) {
    console.error("❌ Ошибка отправки письма:", error);
  }
}

export interface OrderErrorEmailData {
  error: string;
  buyer: { name: string; phone: string; email: string };
  items: { name: string; quantity: number; sku: string }[];
  delivery: { type: string; address: string };
  webhookBody: unknown;
}

/**
 * Отправляет уведомление об ошибке создания заказа.
 * Содержит все данные для ручного создания заказа.
 */
export async function sendOrderErrorEmail(
  data: OrderErrorEmailData,
): Promise<void> {
  const now = Date.now();
  if (now - lastOrderErrorSentAt < ORDER_ERROR_DEBOUNCE_MS) {
    return;
  }
  lastOrderErrorSentAt = now;

  const itemsRows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(i.name)}</td>` +
        `<td style="padding:4px 8px;border:1px solid #ddd;">${i.quantity}</td>` +
        `<td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(i.sku)}</td></tr>`,
    )
    .join("");

  const subject = `⚠️ Ошибка создания заказа — ${data.buyer.name} — ${data.error.slice(0, 50)}`;
  const html = `
    <h2>Ошибка создания заказа в Ozon</h2>
    <p><strong>Причина:</strong> ${escapeHtml(data.error)}</p>

    <h3>Покупатель</h3>
    <ul>
      <li><strong>ФИО:</strong> ${escapeHtml(data.buyer.name)}</li>
      <li><strong>Телефон:</strong> ${escapeHtml(data.buyer.phone)}</li>
      <li><strong>Email:</strong> ${escapeHtml(data.buyer.email)}</li>
    </ul>

    <h3>Товары</h3>
    <table style="border-collapse:collapse;width:100%;">
      <tr style="background:#f5f5f5;">
        <th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Название</th>
        <th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Кол-во</th>
        <th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">SKU</th>
      </tr>
      ${itemsRows}
    </table>

    <h3>Доставка</h3>
    <ul>
      <li><strong>Тип:</strong> ${escapeHtml(data.delivery.type)}</li>
      <li><strong>Адрес:</strong> ${escapeHtml(data.delivery.address)}</li>
    </ul>

    <h3>Полный body webhook</h3>
    <pre style="background:#f5f5f5;padding:12px;border-radius:4px;overflow-x:auto;font-size:12px;">${escapeHtml(JSON.stringify(data.webhookBody, null, 2))}</pre>
  `;

  const to = ozonConfig.notifyEmail;

  if (!to) {
    console.warn(
      "⚠️  NOTIFY_EMAIL не задан — письмо об ошибке заказа не отправлено",
    );
    console.warn(`   Тема: ${subject}`);
    return;
  }

  const transport = createTransport();
  if (!transport) {
    console.warn(
      "⚠️  SMTP не настроен — письмо об ошибке заказа не отправлено",
    );
    console.warn(`   Тема: ${subject}`);
    console.warn(`   Кому: ${to}`);
    return;
  }

  try {
    await transport.sendMail({
      from: ozonConfig.smtpFrom,
      to,
      subject,
      html,
    });
    console.log(`✅ Письмо об ошибке заказа отправлено на ${to}`);
  } catch (error) {
    console.error("❌ Ошибка отправки письма об ошибке заказа:", error);
  }
}

export interface CriticalErrorEmailData {
  subject: string;
  message: string;
  details?: unknown;
}

// Дебаунс для критических ошибок — не чаще раза в 10 минут
let lastCriticalSentAt = 0;
const CRITICAL_DEBOUNCE_MS = 10 * 60 * 1000;

/**
 * Отправляет уведомление о критической ошибке системы.
 * Дебаунсится — не чаще раза в 10 минут.
 */
export async function sendCriticalErrorEmail(
  data: CriticalErrorEmailData,
): Promise<void> {
  const now = Date.now();
  if (now - lastCriticalSentAt < CRITICAL_DEBOUNCE_MS) {
    return;
  }
  lastCriticalSentAt = now;

  const subject = `🔴 Критическая ошибка: ${data.subject}`;
  const detailsBlock =
    data.details !== undefined
      ? `<h3>Детали</h3>
    <pre style="background:#f5f5f5;padding:12px;border-radius:4px;overflow-x:auto;font-size:12px;">${escapeHtml(
      typeof data.details === "string"
        ? data.details
        : JSON.stringify(data.details, null, 2),
    )}</pre>`
      : "";

  const html = `
    <h2 style="color:#d32f2f;">🔴 Критическая ошибка системы</h2>
    <p><strong>Тема:</strong> ${escapeHtml(data.subject)}</p>
    <p><strong>Сообщение:</strong></p>
    <pre style="background:#fff3f3;border:1px solid #f44336;padding:12px;border-radius:4px;">${escapeHtml(data.message)}</pre>
    ${detailsBlock}
    <p style="color:#888;font-size:12px;">Время: ${new Date().toISOString()}</p>
  `;

  const to = ozonConfig.notifyEmail;

  if (!to) {
    console.warn(
      "⚠️  NOTIFY_EMAIL не задан — критическое письмо не отправлено",
    );
    console.warn(`   Тема: ${subject}`);
    return;
  }

  const transport = createTransport();
  if (!transport) {
    console.warn("⚠️  SMTP не настроен — критическое письмо не отправлено");
    console.warn(`   Тема: ${subject}`);
    return;
  }

  try {
    await transport.sendMail({
      from: ozonConfig.smtpFrom,
      to,
      subject,
      html,
    });
    console.log(`✅ Критическое письмо отправлено на ${to}`);
  } catch (error) {
    console.error("❌ Ошибка отправки критического письма:", error);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
