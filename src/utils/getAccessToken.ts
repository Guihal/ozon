import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { ozonConfig } from "../config/env";
import { OzonOAuthClient } from "./typedApiClient";
import { ozonOAuthFetch } from "./ozonFetch";
import * as logger from "./logger";

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  token_type: string;
}

// Проверка конфигурации
if (!ozonConfig.isConfigured) {
  logger.warn("⚠️  OAuth не настроен. Проверьте переменные окружения.");
}

// Путь к файлу для сохранения токена
const TOKEN_FILE = join(__dirname, "ozon_token.json");

// Глобальное хранилище токена
let tokenCache: {
  value: string | null;
  refresh_token: string | null;
  expires: number;
} = {
  value: null,
  refresh_token: null,
  expires: Date.now(),
};

// Хранилище для state параметра (защита от CSRF)
const stateCache: Map<string, number> = new Map();
const STATE_EXPIRY_TIME = 10 * 60 * 1000; // 10 минут

// Очистка истёкших state периодически
setInterval(() => {
  const now = Date.now();
  for (const [state, expiry] of stateCache.entries()) {
    if (now > expiry) {
      stateCache.delete(state);
    }
  }
}, 60 * 1000); // Проверяем каждую минуту

/**
 * Загрузка токена из файла при старте
 */
function loadTokenFromFile(): void {
  try {
    if (existsSync(TOKEN_FILE)) {
      const data = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
      tokenCache.value = data.access_token || null;
      tokenCache.refresh_token = data.refresh_token || null;
      tokenCache.expires = data.expires || Date.now();
    }
  } catch (error) {
    logger.warn("Не удалось загрузить токен из файла:", error);
  }
}

logger.log(`Client ID: ${ozonConfig.clientId}`);

/**
 * Сохранение токена в файл
 */
function saveTokenToFile(): void {
  try {
    writeFileSync(
      TOKEN_FILE,
      JSON.stringify({
        access_token: tokenCache.value,
        refresh_token: tokenCache.refresh_token,
        expires: tokenCache.expires,
      }),
      "utf-8",
    );
  } catch (error) {
    logger.warn("Не удалось сохранить токен в файл:", error);
  }
}

/**
 * Генерация URL для авторизации продавца
 * @param state - уникальная строка для защиты от CSRF
 * @param scope - список разрешений (через пробел)
 * @returns URL для перенаправления на страницу авторизации Ozon
 */
export function generateAuthUrl(
  state: string = generateState(),
  scope: string = "seller-api.ozon-logistics",
): string {
  if (!ozonConfig.isConfigured) {
    throw new Error("OAuth не настроен. Проверьте переменные окружения.");
  }

  // Сохраняем state с временем истечения для защиты от CSRF
  stateCache.set(state, Date.now() + STATE_EXPIRY_TIME);

  const params = new URLSearchParams({
    response_type: "code",
    access_type: "offline",
    client_id: ozonConfig.clientId,
    redirect_uri: ozonConfig.redirectUri,
    scope: scope,
    state: state,
    prompt: "select_company",
  });

  return `${ozonConfig.oauthAuthorizeUrl}?${params.toString()}`;
}

/**
 * Генерация случайной строки для state (защита от CSRF)
 */
function generateState(length: number = 16): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Проверка и валидация state параметра (защита от CSRF)
 * @param state - state значение из callback
 * @returns true если state валиден, false если невалиден или истёк
 */
export function validateState(state: string): boolean {
  const timestamp = stateCache.get(state);

  if (!timestamp) {
    logger.error("❌ State не найден или истёк");
    return false;
  }

  // Проверяем, не истёк ли state
  if (Date.now() > timestamp) {
    logger.error("❌ State истёк");
    stateCache.delete(state);
    return false;
  }

  // Удаляем state после проверки (используется один раз)
  stateCache.delete(state);
  return true;
}

/**
 * Получение нового токена через authorization_code или refresh_token
 * @param grantType - тип гранта: 'authorization_code' или 'refresh_token'
 * @param code - код авторизации (для grant_type=authorization_code)
 * @param refreshToken - refresh_token (для grant_type=refresh_token)
 * @returns объект с токеном и данными
 */
export async function fetchAccessToken(
  grantType: "authorization_code" | "refresh_token",
  code?: string,
  refreshToken?: string,
): Promise<TokenData> {
  if (!ozonConfig.isConfigured) {
    throw new Error("OAuth не настроен. Проверьте переменные окружения.");
  }

  const body: Record<string, string> = {
    grant_type: grantType,
    client_id: String(ozonConfig.clientId),
    client_secret: ozonConfig.clientSecret,
  };

  if (grantType === "authorization_code") {
    if (!code) {
      throw new Error("Для authorization_code требуется параметр code");
    }
    body.code = code;
    body.redirect_uri = ozonConfig.redirectUri;
  } else if (grantType === "refresh_token") {
    if (!refreshToken) {
      throw new Error("Для refresh_token требуется параметр refresh_token");
    }
    body.refresh_token = refreshToken;
  }

  const response = await ozonOAuthFetch(body);

  if (response.status === "error") {
    throw Error;
  }

  const data = response.response;

  tokenCache.value = data.access_token;
  tokenCache.refresh_token = data.refresh_token || null;
  tokenCache.expires = data.expires_in;

  saveTokenToFile();

  logger.log(
    `Токен получен. Истекает через ${data.expires_in - Date.now() / 1000} секунд.`,
  );

  return data;
}

/**
 * Получение токена доступа (просто возвращает из кэша)
 * Обновление происходит автоматически через таймер
 * @returns токен доступа или null если нет токена
 */
export function getAccessToken(): string | null {
  return tokenCache.value;
}

/**
 * Получение refresh_token (для ручного обновления)
 * @returns refresh_token или null если нет токена
 */
export function getRefreshToken(): string | null {
  return tokenCache.refresh_token;
}

/**
 * Получение текущего состояния токена (для отладки)
 */
export function getTokenStatus(): {
  hasToken: boolean;
  isExpired: boolean;
  expiresAt: number;
  expiresIn: number;
  hasRefreshToken: boolean;
} {
  const now = Date.now();
  return {
    hasToken: !!tokenCache.value,
    isExpired: now >= tokenCache.expires,
    expiresAt: tokenCache.expires,
    expiresIn: Math.max(0, Math.floor((tokenCache.expires - now) / 1000)),
    hasRefreshToken: !!tokenCache.refresh_token,
  };
}

/**
 * Сброс токена (для тестирования или ручного сброса)
 */
export function resetToken(): void {
  tokenCache.value = null;
  tokenCache.refresh_token = null;
  tokenCache.expires = Date.now();

  // Удаляем файл
  try {
    if (existsSync(TOKEN_FILE)) {
      unlinkSync(TOKEN_FILE);
    }
  } catch (error) {
    logger.warn("Не удалось удалить файл токена:", error);
  }

  logger.log("Токен сброшен");
}

/**
 * Получение URL для авторизации (удобная обёртка)
 */
export function getAuthUrl(): string {
  return generateAuthUrl();
}

// Загружаем токен при старте модуля
loadTokenFromFile();
