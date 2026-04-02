# OZON LOGISTICS BACKEND - ПОЛНЫЙ КОД ПРОЕКТА

## 📋 СОДЕРЖАНИЕ

1. [package.json](#packagejson)
2. [tsconfig.json](#tsconfigjson)
3. [.env](#env)
4. [Конфигурация (config/env.ts)](#конфигурация-configenvts)
5. [Точка входа (src/index.ts)](#точка-входа-srcindexts)
6. [Модули](модули)
   - [Auth модуль](#auth-модуль-srcmodulesauthauthts)
   - [Delivery модуль](#delivery-модуль-srcmodulesdeliverydeliveryts)
7. [Утилиты](#утилиты)
   - [getAccessToken.ts](#getaccesstokents)
   - [htmlResponses.ts](#htmlresponsests)
   - [logger.ts](#loggerts)
   - [rateLimiter.ts](#ratelimiterts)
   - [typedApiClient.ts](#typedapiclientts)
   - [useFetch.ts](#usefetchts)
   - [ozonFetch.ts](#ozonfetchts)
8. [Сервисы](#сервисы)
   - [ozon-logistics/types.ts](#ozon-logisticstypests)
   - [ozon-logistics/delivery.ts](#ozon-logisticsdeliveryts)
   - [pickup-points-cache.ts](#pickup-points-cachets)
9. [Документация](#документация)
   - [agents.md - Архитектура проекта](#agentsmd)
   - [TYPED_API_CLIENT.md](#typed_api_clientmd)
   - [USE_FETCH_GUIDE.md](#use_fetch_guidemd)

---

## package.json

```json
{
  "name": "ozon",
  "version": "1.50.0",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "dev": "bun run --watch src/index.ts"
  },
  "dependencies": {
    "elysia": "latest",
    "@elysiajs/cors": "latest"
  },
  "devDependencies": {
    "bun-types": "latest"
  },
  "module": "src/index.js"
}
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ES2022",
    "moduleResolution": "node",
    "types": ["bun-types"]
  }
}
```

---

## .env

```env
# Обязательные переменные
OZON_LOGISTICS_CLIENT_ID=your_client_id
OZON_LOGISTICS_CLIENT_SECRET=your_client_secret

# Опциональные переменные
OZON_LOGISTICS_API_URL=https://api-seller.ozon.ru
OZON_LOGISTICS_AUTH_URL=https://api-seller.ozon.ru
OZON_LOGISTICS_REDIRECT_URI=http://YOUR_IP:PORT/auth/callback
OZON_LOGISTICS_IS_PROD=false
OZON_LOGISTICS_TIMEOUT=10000
PORT=3000
SERVER_DOMEN=http://YOUR_IP:PORT
```

---

## Конфигурация (config/env.ts)

```typescript
/**
 * Configuration for Ozon Logistics API
 * Uses Bun's native env support
 */

import { networkInterfaces } from "os";

/**
 * Get local IP address automatically
 */
function getLocalIP(): string {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }

  return "localhost";
}

// Required environment variables
const requiredVars = [
  "OZON_LOGISTICS_CLIENT_ID",
  "OZON_LOGISTICS_CLIENT_SECRET",
] as const;

// Optional environment variables with defaults
const optionalVars = {
  OZON_LOGISTICS_API_URL: "https://api-seller.ozon.ru",
  OZON_LOGISTICS_AUTH_URL: "https://api-seller.ozon.ru",
  OZON_LOGISTICS_IS_PROD: "false",
  OZON_LOGISTICS_TIMEOUT: "10000",
  PORT: "3000",
} as const;

// Get port from env or use default
const port = parseInt(process.env.PORT || optionalVars.PORT, 10);

// Auto-generate redirect URI if not set
const autoRedirectUri = `${process.env.SERVER_DOMEN}/auth/callback`;

// Log redirect URI for debugging
console.log("========================================");
console.log("🔍 Информация о redirect_uri:");
console.log(`   Определённый IP: ${getLocalIP()}`);
console.log(`   Порт: ${port}`);
console.log(`   Автоматический redirect_uri: ${autoRedirectUri}`);
if (process.env.OZON_LOGISTICS_REDIRECT_URI) {
  console.log(`   Заданный в .env: ${process.env.OZON_LOGISTICS_REDIRECT_URI}`);
}
console.log("========================================");

// Validate required vars and log missing ones
const missingVars: string[] = [];
for (const key of requiredVars) {
  if (!process.env[key]) {
    missingVars.push(key);
  }
}

if (missingVars.length > 0) {
  console.error("========================================");
  console.error("ОШИБКА: Отсутствуют обязательные переменные окружения:");
  missingVars.forEach((key) => {
    console.error(`  - ${key}`);
  });
  console.error("");
  console.error("Добавьте их в .env файл:");
  console.error("  OZON_LOGISTICS_CLIENT_ID=your_client_id");
  console.error("  OZON_LOGISTICS_CLIENT_SECRET=your_client_secret");
  console.error("========================================");
}

// Warn about empty values
const emptyVars: string[] = [];
for (const key of requiredVars) {
  if (process.env[key] === "") {
    emptyVars.push(key);
  }
}

if (emptyVars.length > 0) {
  console.warn("Внимание: Следующие переменные имеют пустые значения:");
  emptyVars.forEach((key) => {
    console.warn(`  - ${key}`);
  });
}

export const ozonConfig = {
  // API URLs
  apiUrl:
    process.env.OZON_LOGISTICS_API_URL || optionalVars.OZON_LOGISTICS_API_URL,
  authUrl:
    process.env.OZON_LOGISTICS_AUTH_URL || optionalVars.OZON_LOGISTICS_AUTH_URL,

  // OAuth Configuration
  clientId: process.env.OZON_LOGISTICS_CLIENT_ID || "",
  clientSecret: process.env.OZON_LOGISTICS_CLIENT_SECRET || "",
  redirectUri: process.env.OZON_LOGISTICS_REDIRECT_URI || autoRedirectUri,

  // OAuth URLs
  oauthTokenUrl: "https://xapi.ozon.ru/appstore-api/oauth/token",
  oauthAuthorizeUrl: "https://seller.ozon.ru/app/appstore/oauth/authorize",

  // Environment flag
  isProd: process.env.OZON_LOGISTICS_IS_PROD === "true",

  // Request timeout (ms)
  timeoutMs: parseInt(
    process.env.OZON_LOGISTICS_TIMEOUT || optionalVars.OZON_LOGISTICS_TIMEOUT,
    10,
  ),

  // Server port
  port: port,

  // Validation helpers
  isConfigured: missingVars.length === 0 && emptyVars.length === 0,
  missingVars,
  emptyVars,
} as const;

export type OzonConfig = typeof ozonConfig;

// Log configuration status on startup
if (ozonConfig.isConfigured) {
  console.log("✅ Конфигурация Ozon загружена успешно");
  console.log(`   API URL: ${ozonConfig.apiUrl}`);
  console.log(`   Redirect URI: ${ozonConfig.redirectUri}`);
  console.log(`   Production: ${ozonConfig.isProd}`);
  console.log("");
  console.log("⚠️  ВАКонфигурация Ozon не завершена");
}
```

---

## Точка входа (src/index.ts)

```typescript
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
```

---

## Модули

### Auth модуль (src/modules/auth/auth.ts)

```typescript
import { Elysia, t } from "elysia";
import {
  getAuthUrl,
  fetchAccessToken,
  getAccessToken,
  getTokenStatus,
  resetToken,
  getRefreshToken,
  validateState,
} from "../../utils/getAccessToken";
import { ozonConfig } from "../../config/env";
import {
  generateSuccessHTML,
  generateErrorHTML,
  createHTMLResponse,
} from "../../utils/htmlResponses";

/**
 * Auth module for Ozon OAuth integration
 */
export const auth = new Elysia({ prefix: "/auth" })
  /**
   * Redirect to Ozon OAuth page
   * GET /auth/url
   */
  .get("/url", ({ set }) => {
    try {
      const url = getAuthUrl();
      set.headers["Location"] = url;
      set.status = 302;
      return "";
    } catch (error) {
      set.status = 500;
      return error instanceof Error ? error.message : "Неизвестная ошибка";
    }
  })

  /**
   * OAuth callback endpoint
   * GET /auth/callback?code=AUTHORIZATION_CODE&state=STATE_STRING
   */
  .get(
    "/callback",
    async ({ query }) => {
      const { code, state, error: oauthError, error_description } = query;

      console.log("========================================");
      console.log("📥 OAuth Callback получен:");
      console.log(`   Code: ${code ? "получен" : "отсутствует"}`);
      console.log(`   State: ${state || "отсутствует"}`);
      console.log(`   Error: ${oauthError || "нет"}`);
      console.log(`   Error description: ${error_description || "нет"}`);
      console.log("========================================");

      // Проверяем state для защиты от CSRF атак
      if (!state || !validateState(state)) {
        console.error("❌ Невалидный state - возможна CSRF атака");
        const html = generateErrorHTML(
          "Невалидный state параметр - возможна CSRF атака",
        );
        return createHTMLResponse(html);
      }

      // Check for OAuth errors
      if (oauthError) {
        console.error("❌ OAuth ошибка:", oauthError, error_description);
        return {
          success: false,
          error: oauthError,
          description: error_description || "Ошибка авторизации",
        };
      }

      // Validate code
      if (!code) {
        console.error("❌ Отсутствует параметр code");
        return {
          success: false,
          error: "Отсутствует параметр code",
        };
      }

      try {
        console.log("🔄 Обмен code на токен...");
        // Exchange code for token
        const tokenData = await fetchAccessToken("authorization_code", code);

        console.log("✅ Токен успешно получен");
        console.log(
          `   Expires in: ${tokenData.expires_in - Date.now() / 1000} секунд`,
        );
        console.log(`   Scope: ${tokenData.scope.join(", ")}`);

        // Return HTML response for browser
        const html = generateSuccessHTML({
          expires_in: tokenData.expires_in,
          scope: tokenData.scope,
        });
        return createHTMLResponse(html);
      } catch (error) {
        console.error("❌ Ошибка получения токена:", error);

        // Return HTML error response
        const errorMessage =
          error instanceof Error ? error.message : "Неизвестная ошибка";
        const html = generateErrorHTML(errorMessage);
        return createHTMLResponse(html);
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
        error_description: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Get token status (dev only)
   * GET /auth/status
   */
  .get("/status", () => {
    // Available only in dev mode
    if (ozonConfig.isProd) {
      return {
        success: false,
        error: "Endpoint доступен только в dev режиме",
      };
    }

    const status = getTokenStatus();
    const token = getAccessToken();

    return {
      success: true,
      configured: true,
      ...status,
      token_preview: token ? `${token.substring(0, 10)}...` : null,
    };
  })

  /**
   * Reset token (dev only)
   * POST /auth/reset
   */
  .post("/reset", () => {
    // Available only in dev mode
    if (ozonConfig.isProd) {
      return {
        success: false,
        error: "Endpoint доступен только в dev режиме",
      };
    }

    try {
      resetToken();
      return {
        success: true,
        message: "Токен сброшен",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Ошибка сброса токена",
      };
    }
  })

  /**
   * Manual token refresh (dev only)
   * POST /auth/refresh
   */
  .post("/refresh", async () => {
    // Available only in dev mode
    if (ozonConfig.isProd) {
      return {
        success: false,
        error: "Endpoint доступен только в dev режиме",
      };
    }

    const status = getTokenStatus();

    if (!status.hasRefreshToken) {
      return {
        success: false,
        error: "Нет refresh_token. Требуется авторизация.",
      };
    }

    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return {
          success: false,
          error: "Refresh token не найден",
        };
      }

      const tokenData = await fetchAccessToken(
        "refresh_token",
        undefined,
        refreshToken,
      );

      return {
        success: true,
        message: "Токен успешно обновлён",
        token: {
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
          scope: tokenData.scope,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Ошибка обновления токена",
      };
    }
  });
```

### Delivery модуль (src/modules/delivery/delivery.ts)

```typescript
import Elysia, { t } from "elysia";
import { checkDeliveryAvailability } from "../../services/ozon-logistics/delivery";

export const delivery = new Elysia({ prefix: "/v1" }).post(
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
);
```

---

## Утилиты

### getAccessToken.ts

```typescript
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { ozonConfig } from "../config/env";
import { OzonOAuthClient } from "./typedApiClient";
import { ozonOAuthFetch } from "./ozonFetch";

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  token_type: string;
}

// Проверка конфигурации
if (!ozonConfig.isConfigured) {
  console.warn("⚠️  OAuth не настроен. Проверьте переменные окружения.");
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

// Таймер автоматического обновления
let autoRefreshTimer: NodeJS.Timeout | null = null;

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

      // Восстанавливаем таймер обновления
      const timeUntilExpiry = tokenCache.expires - Date.now();
      if (timeUntilExpiry > 0 && tokenCache.refresh_token) {
        scheduleAutoRefresh(timeUntilExpiry);
      }
    }
  } catch (error) {
    console.warn("Не удалось загрузить токен из файла:", error);
  }
}

console.log(ozonConfig.clientId);

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
    console.warn("Не удалось сохранить токен в файл:", error);
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
    console.error("❌ State не найден или истёк");
    return false;
  }

  // Проверяем, не истёк ли state
  if (Date.now() > timestamp) {
    console.error("❌ State истёк");
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

  scheduleAutoRefresh(data.expires_in);

  console.log(
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
 * Планирование автоматического обновления токена
 * Обновляем за 24 часа до истечения срока действия
 */
function scheduleAutoRefresh(expiresIn: number): void {
  // Очищаем предыдущий таймер
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  const refreshTime = expiresIn * 1000 - Date.now() - 60 * 1000;
  // const refreshTime = 10000;

  if (refreshTime > 0) {
    console.log(
      `Автообновление токена запланировано через ${Math.floor(refreshTime / 1000 / 60)} минут`,
    );

    autoRefreshTimer = setTimeout(async () => {
      console.log("Автоматическое обновление токена...");
      try {
        if (tokenCache.refresh_token) {
          await fetchAccessToken(
            "refresh_token",
            undefined,
            tokenCache.refresh_token,
          );
          console.log("Токен успешно обновлён");
        }
      } catch (error) {
        console.error("Ошибка при автоматическом обновлении токена:", error);
      }
    }, refreshTime);

    autoRefreshTimer.unref(); // Не блокирует выход из процесса
  }
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
    console.warn("Не удалось удалить файл токена:", error);
  }

  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  console.log("Токен сброшен");
}

/**
 * Получение URL для авторизации (удобная обёртка)
 */
export function getAuthUrl(): string {
  return generateAuthUrl();
}

// Загружаем токен при старте модуля
loadTokenFromFile();
```

### htmlResponses.ts

```typescript
/**
 * HTML Response Templates for OAuth
 */

export interface SuccessTokenData {
  expires_in: number;
  scope: string[];
}

/**
 * Generate success HTML response
 */
export function generateSuccessHTML(data: SuccessTokenData): string {
  const hoursUntilExpiry = Math.floor(
    (data.expires_in - Date.now() / 1000) / 60,
  );
  const scopeCount = data.scope.length;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Авторизация успешна</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
    }
    .success-icon {
      font-size: 60px;
      color: #4CAF50;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    .info {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
      text-align: left;
    }
    .info p {
      margin: 5px 0;
      color: #666;
    }
    .close-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 20px;
    }
    .close-btn:hover {
      background: #764ba2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✅</div>
    <h1>Авторизация успешна!</h1>
    <div class="info">
      <p><strong>Токен получен</strong></p>
      <p>Истекает через: ${hoursUntilExpiry} минут</p>
      <p>Разрешений: ${scopeCount}</p>
    </div>
    <p style="color: #666; font-size: 14px;">
      Токен сохранён и будет автоматически обновляться.<br>
      Вы можете закрыть эту страницу.
    </p>
    <button class="close-btn" onclick="window.close()">Закрыть</button>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate error HTML response
 */
export function generateErrorHTML(errorMessage: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ошибка авторизации</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
    }
    .error-icon {
      font-size: 60px;
      color: #f44336;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    .error-message {
      background: #ffebee;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
      color: #c62828;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">❌</div>
    <h1>Ошибка авторизации</h1>
    <div class="error-message">
      ${errorMessage}
    </div>
    <p style="color: #666; font-size: 14px;">
      Проверьте логи сервера для подробностей.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Create HTML Response
 */
export function createHTMLResponse(html: string): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
```

### logger.ts

```typescript
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
```

### rateLimiter.ts

```typescript
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
```

### typedApiClient.ts

```typescript
import { rateLimitedFetch } from "./rateLimiter";
import { useFetch, type ApiResult } from "./useFetch";
import type {
  CheckDeliveryRequest,
  CheckDeliveryResponse,
  PickupPointsListResponse,
  PickupPointsInfoResponse,
  PickupPointInfoRequest,
} from "../services/ozon-logistics/types";
import type { TokenData } from "./getAccessToken";
import { log, error as logError } from "./logger";

/**
 * Маппинг endpoint-ов на их request/response типы
 * Автокомплит и type-safety для всех методов API
 */
type OzonApiEndpointMap = {
  "/v1/delivery/check": {
    request: CheckDeliveryRequest;
    response: CheckDeliveryResponse;
  };
  "/v1/delivery/point/list": {
    request: Record<string, never>;
    response: PickupPointsListResponse;
  };
  "/v1/delivery/point/info": {
    request: PickupPointInfoRequest;
    response: PickupPointsInfoResponse;
  };
};

/**
 * Маппинг OAuth endpoint-ов
 */
type OzonOAuthEndpointMap = {
  oauth_token: {
    request: Record<string, string>;
    response: TokenData;
  };
};

/**
 * Типизированный клиент для API Ozon Logistics
 * Предоставляет автокомплит и type-safety для всех методов
 *
 * @example
 * const client = new OzonApiClient(baseUrl, token);
 * const result = await client.call("/v1/delivery/check", { client_phone: "79991234567" });
 * // result имеет тип CheckDeliveryResponse
 */
export class OzonApiClient {
  constructor(
    private baseUrl: string,
    private token: string,
    private timeoutMs: number = 10000,
  ) {}

  /**
   * Выполняет типизированный запрос к API Ozon
   * @param endpoint - endpoint из маппинга (с автокомплитом)
   * @param body - тело запроса (типизировано)
   * @returns типизированный response
   */
  async call<K extends keyof OzonApiEndpointMap>(
    endpoint: K,
    body?: OzonApiEndpointMap[K]["request"],
  ): Promise<OzonApiEndpointMap[K]["response"]> {
    const url = new URL(endpoint, this.baseUrl);

    try {
      const response = await rateLimitedFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          `❌ Ozon API Error (${endpoint}):`,
          response.status,
          errorData,
        );
        throw new Error(
          `Ozon API Error: ${response.status} ${response.statusText}`,
        );
      }

      return response.json() as Promise<OzonApiEndpointMap[K]["response"]>;
    } catch (error) {
      console.error(`❌ Error calling ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Безопасный типизированный запрос к API Ozon с обработкой ошибок
   * Оборачивает результат в { status: 'ok' | 'error', response: T | OzonErrorType }
   * Автоматически логирует ошибки, сервер не падет
   *
   * @param endpoint - endpoint из маппинга (с автокомплитом)
   * @param body - тело запроса (типизировано)
   * @returns результат вида { status: 'ok'; response: T } | { status: 'error'; response: OzonErrorType }
   *
   * @example
   * const result = await client.callSafe("/v1/delivery/check", { client_phone: "..." });
   * if (result.status === "ok") {
   *   console.log(result.response.is_possible); // TypeScript знает тип!
   * }
   */
  async callSafe<K extends keyof OzonApiEndpointMap>(
    endpoint: K,
    body?: OzonApiEndpointMap[K]["request"],
  ): Promise<ApiResult<OzonApiEndpointMap[K]["response"]>> {
    return useFetch(() => this.call(endpoint, body));
  }
}

/**
 * Типизированный клиент для OAuth методов Ozon
 * Используется для получения и обновления токенов
 */
export class OzonOAuthClient {
  constructor(
    private tokenUrl: string,
    private timeoutMs: number = 10000,
  ) {}

  /**
   * Выполняет OAuth запрос
   * @param body - тело запроса (должно содержать grant_type и credentials)
   * @returns типизированный response с токеном
   */
  async call(
    body: OzonOAuthEndpointMap["oauth_token"]["request"],
  ): Promise<OzonOAuthEndpointMap["oauth_token"]["response"]> {
    try {
      const response = await rateLimitedFetch(this.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ OAuth Error:", response.status, errorData);
        throw new Error(
          `OAuth Error: ${response.status} ${response.statusText}`,
        );
      }

      return response.json() as Promise<
        OzonOAuthEndpointMap["oauth_token"]["response"]
      >;
    } catch (error) {
      console.error("❌ Error in OAuth call:", error);
      throw error;
    }
  }
}

export type { OzonApiEndpointMap, OzonOAuthEndpointMap };
```

### useFetch.ts

```typescript
/**
 * Обертка над Ozon API запросами с унифицированной обработкой ошибок
 * Функция-обертка useFetch оборачивает каждый API запрос в объект:
 * { status: 'ok' | 'error', response: T | OzonErrorType }
 */

import { error as logError } from "./logger";

// === ТИПЫ ОШИБОК ===

/**
 * Формат ошибки API Ozon (стандартный)
 * Структура: { code, message, details }
 */
export interface OzonApiError {
  type: "api_error";
  code: number;
  message: string;
  details?: Array<Record<string, unknown>>;
}

/**
 * Формат ошибки с инцидентом (альтернативный)
 * Структура: { incidentId, supportURL }
 */
export interface OzonIncidentError {
  type: "incident_error";
  incidentId: string;
  supportURL: string;
}

/**
 * Union type всех возможных ошибок Ozона
 */
export type OzonErrorType = OzonApiError | OzonIncidentError;

/**
 * Результат выполнения API запроса
 * Никогда не выбрасывает исключение, всегда возвращает результат
 */
export type ApiResult<T> =
  | { status: "ok"; response: T }
  | { status: "error"; response: OzonErrorType };

// === УТИНАЯ ТИПИЗАЦИЯ (TYPE GUARDS) ===

/**
 * Проверяет, является ли объект ошибкой API Ozона
 * Ищет поля: code (число) и message (строка)
 */
function isOzonApiError(obj: unknown): obj is OzonApiError {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).code === "number" &&
    typeof (obj as Record<string, unknown>).message === "string"
  );
}

/**
 * Проверяет, является ли объект ошибкой инцидента
 * Ищет поля: incidentId (строка) и supportURL (строка)
 */
function isOzonIncidentError(obj: unknown): obj is OzonIncidentError {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).incidentId === "string" &&
    typeof (obj as Record<string, unknown>).supportURL === "string"
  );
}

// === ПАРСИНГ ОШИБОК ===

/**
 * Парсит неизвестную ошибку в один из поддерживаемых форматов Ozона
 * @param error - неизвестный объект ошибки
 * @returns нормализованный объект ошибки OzonErrorType
 */
function parseOzonError(error: unknown): OzonErrorType {
  // Проверяем первый формат ошибки
  if (isOzonApiError(error)) {
    return {
      type: "api_error",
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  // Проверяем второй формат ошибки
  if (isOzonIncidentError(error)) {
    return {
      type: "incident_error",
      incidentId: error.incidentId,
      supportURL: error.supportURL,
    };
  }

  // Если это Error объект
  if (error instanceof Error) {
    // Пытаемся распарсить JSON из сообщения
    try {
      const parsed = JSON.parse(error.message);
      if (isOzonApiError(parsed) || isOzonIncidentError(parsed)) {
        return parseOzonError(parsed);
      }
    } catch {
      // Не JSON, продолжаем
    }

    return {
      type: "api_error",
      code: 500,
      message: error.message || "Unknown error",
    };
  }

  // Последняя попытка - конвертируем в строку
  return {
    type: "api_error",
    code: 500,
    message: String(error) || "Unknown error",
  };
}

// === ОСНОВНАЯ ФУНКЦИЯ ===

/**
 * Функция-обертка для API запросов Ozона
 * Похожа на useFetch в React hook, но для backend
 *
 * Характеристики:
 * ✅ Оборачивает результат в { status: 'ok' | 'error', response }
 * ✅ Использует утиную типизацию для детектирования ошибок по двум форматам
 * ✅ Автоматически логирует ошибки через logger
 * ✅ Никогда не выбрасывает исключения (сервер не упадет)
 * ✅ Полная типизация: если ok → тип из T, если error → OzonErrorType
 *
 * @template T - тип успешного ответа
 * @param fn - async функция, результат которой нужно обернуть
 * @returns Promise<{ status: 'ok' | 'error', response: T | OzonErrorType }>
 *
 * @example
 * // С OzonApiClient
 * const result = await useFetch(() =>
 *   client.call("/v1/delivery/check", { client_phone: "79991234567" })
 * );
 *
 * if (result.status === "ok") {
 *   console.log("✅ Доставка возможна:", result.response.is_possible);
 * } else if (result.status === "error") {
 *   const err = result.response;
 *   if (err.type === "api_error") {
 *     console.error(`❌ API Error (${err.code}): ${err.message}`);
 *   } else {
 *     console.error(`❌ Incident (${err.incidentId}): ${err.supportURL}`);
 *   }
 * }
 *
 * @example
 * // С OzonOAuthClient
 * const tokenResult = await useFetch(() =>
 *   oauthClient.call({
 *     grant_type: "authorization_code",
 *     code: "...",
 *     client_id: "...",
 *     client_secret: "..."
 *   })
 * );
 *
 * if (tokenResult.status === "ok") {
 *   saveToken(tokenResult.response.access_token);
 * } else {
 *   // Ошибка уже залогирована автоматически
 *   handleError(tokenResult.response);
 * }
 */
export async function useFetch<T>(fn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    const response = await fn();

    // Проверяем, может ли ответ сам являться ошибкой
    // (для случаев когда API возвращает ошибку в body с кодом 200)
    if (isOzonApiError(response) || isOzonIncidentError(response)) {
      const parsedError = parseOzonError(response);
      logError(`❌ API вернул ошибку в теле ответа`, parsedError);
      return {
        status: "error",
        response: parsedError,
      };
    }

    return {
      status: "ok",
      response,
    };
  } catch (error) {
    const parsedError = parseOzonError(error);
    logError(`❌ Ошибка при выполнении API запроса`, parsedError);

    return {
      status: "error",
      response: parsedError,
    };
  }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

/**
 * Проверяет, был ли результат успешным
 * @example
 * const result = await useFetch(() => client.call(...));
 * if (isSuccess(result)) {
 *   console.log(result.response.field); // автокомплит работает!
 * }
 */
export function isSuccess<T>(result: ApiResult<T>): result is {
  status: "ok";
  response: T;
} {
  return result.status === "ok";
}

/**
 * Проверяет, была ли ошибка
 * @example
 * const result = await useFetch(() => client.call(...));
 * if (isError(result)) {
 *   if (result.response.type === "api_error") {
 *     console.error(result.response.code, result.response.message);
 *   }
 * }
 */
export function isError<T>(result: ApiResult<T>): result is {
  status: "error";
  response: OzonErrorType;
} {
  return result.status === "error";
}

// === ЭКСПОРТЫ ===

export default {
  useFetch,
  isSuccess,
  isError,
};
```

### ozonFetch.ts

```typescript
/**
 * Типизированные функции для работы с Ozon API
 * Похожи на $fetch в Nuxt - получают правильный тип ответа по endpoint-у
 *
 * Использование:
 * const result = await ozonFetch("/v1/delivery/check", { client_phone: "..." });
 * if (result.status === "ok") {
 *   // result.response имеет тип CheckDeliveryResponse
 *   console.log(result.response.is_possible);
 * }
 */

import { rateLimitedFetch } from "./rateLimiter";
import { useFetch, type ApiResult } from "./useFetch";
import { getAccessToken } from "./getAccessToken";
import { ozonConfig } from "../config/env";
import { error as logError } from "./logger";
import type {
  OzonApiEndpointMap,
  OzonOAuthEndpointMap,
} from "./typedApiClient";

/**
 * Типизированный запрос к Ozon API
 * Автоматически получает правильный тип ответа по endpoint-у
 * Использует useFetch для безопасной обработки ошибок
 *
 * @param endpoint - endpoint из маппинга (IDE подскажет варианты)
 * @param body - тело запроса (типизировано)
 * @returns { status: 'ok' | 'error', response: T | OzonErrorType }
 *
 * @example
 * const result = await ozonFetch("/v1/delivery/check", { client_phone: "..." });
 * if (result.status === "ok") {
 *   console.log(result.response.is_possible);
 * } else {
 *   console.error(result.response.message);
 * }
 *
 * @example
 * const result = await ozonFetch("/v1/delivery/point/list", {});
 * if (result.status === "ok") {
 *   console.log(result.response.points.length);
 * }
 */
export async function ozonFetch<K extends keyof OzonApiEndpointMap>(
  endpoint: K,
  body?: OzonApiEndpointMap[K]["request"],
): Promise<ApiResult<OzonApiEndpointMap[K]["response"]>> {
  // Получаем токен из кэша
  const token = getAccessToken();
  if (!token) {
    return {
      status: "error",
      response: {
        type: "api_error",
        code: 401,
        message: "Authorization token not found",
      },
    };
  }

  // Используем useFetch для безопасной обработки ошибок
  return useFetch(async () => {
    const url = new URL(endpoint, ozonConfig.apiUrl);

    const response = await rateLimitedFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(ozonConfig.timeoutMs),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logError(
        `❌ Ozon API Error (${endpoint}): ${response.status}`,
        errorData,
      );
      throw errorData;
    }

    return response.json() as Promise<OzonApiEndpointMap[K]["response"]>;
  });
}

/**
 * Типизированный OAuth запрос к Ozon
 * Используется для получения и обновления токенов
 *
 * @param body - тело OAuth запроса
 * @returns { status: 'ok' | 'error', response: TokenData | OzonErrorType }
 *
 * @example
 * const result = await ozonOAuthFetch({
 *   grant_type: "authorization_code",
 *   code: authCode,
 *   client_id: clientId,
 *   client_secret: clientSecret,
 * });
 *
 * if (result.status === "ok") {
 *   console.log(result.response.access_token);
 * }
 */
export async function ozonOAuthFetch(
  body: OzonOAuthEndpointMap["oauth_token"]["request"],
): Promise<ApiResult<OzonOAuthEndpointMap["oauth_token"]["response"]>> {
  return useFetch(async () => {
    const response = await rateLimitedFetch(ozonConfig.oauthTokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ozonConfig.timeoutMs),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logError(`❌ OAuth Error: ${response.status}`, errorData);
      throw errorData;
    }

    return response.json() as Promise<
      OzonOAuthEndpointMap["oauth_token"]["response"]
    >;
  });
}

export default {
  ozonFetch,
  ozonOAuthFetch,
};
```

---

## Сервисы

### ozon-logistics/types.ts

```typescript
// Types for Ozon Logistics Platform API responses

// --- Ozon API Response Types ---

export interface OzonAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface OzonDeliveryVariant {
  id: string;
  name: string;
  deliveryType: "PickPoint" | "Courier";
  carrier?: string;
  price?: number;
  time?: {
    min: number;
    max: number;
  };
}

export interface OzonCity {
  id: string;
  name: string;
  prepositionalName?: string;
  region?: string;
}

export interface OzonCitiesResponse {
  cities: OzonCity[];
}

export interface OzonPackageDimensions {
  weight: number;
  length: number;
  height: number;
  width: number;
}

export interface OzonPackage {
  count: number;
  dimensions: OzonPackageDimensions;
  price: number;
}

export interface OzonVariantsByAddressRequest {
  deliveryType: "PickPoint" | "Courier";
  address: string;
  radius?: number;
  packages: OzonPackage[];
}

export interface OzonVariantsByAddressResponse {
  variants: OzonDeliveryVariant[];
}

export interface OzonCalculateResponse {
  price: number;
  currency: string;
  deliveryVariantId: string;
  fromPlaceId: string;
}

export interface OzonTimeResponse {
  minDays: number;
  maxDays: number;
}

export interface OzonErrorResponse {
  errorCode: string;
  message: string;
  arguments?: Record<string, string[]>[];
}

// --- Our API Request/Response Types ---

export interface CalculateDeliveryRequest {
  address: string;
  packages: {
    weight: number;
    length: number;
    height: number;
    width: number;
    price: number;
  }[];
}

export interface DeliveryOption {
  variantId: string;
  name: string;
  deliveryType: "pickup" | "address";
  price: number;
  currency: string;
  days: {
    min: number;
    max: number;
  };
  address?: string;
  pickupPointId?: string;
}

export interface CalculateResponse {
  options: DeliveryOption[];
}

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city: string;
}

export interface PickupPointsResponse {
  pickupPoints: PickupPoint[];
}

export interface City {
  id: string;
  name: string;
}

export interface CitiesResponse {
  cities: City[];
}

// --- Delivery Check Types ---

export interface CheckDeliveryRequest {
  client_phone: string;
}

export interface CheckDeliveryResponse {
  is_possible: boolean;
}

// --- Pickup Points List Types ---

export interface PickupPointCoordinate {
  lat: number;
  long: number;
}

export interface PickupPointItem {
  coordinate: PickupPointCoordinate;
  map_point_id: number;
}

export interface PickupPointsListResponse {
  points: PickupPointItem[];
}

// --- Pickup Point Info Types ---

export interface PickupPointInfoRequest {
  map_point_ids: string[];
}

export interface PickupPointAddressDetails {
  city: string;
  house: string;
  region: string;
  street: string;
}

export interface PickupPointDeliveryType {
  id: number;
  name: string;
}

export interface PickupPointTimeBounds {
  hours: number;
  minutes: number;
}

export interface PickupPointWorkingPeriod {
  max: PickupPointTimeBounds;
  min: PickupPointTimeBounds;
}

export interface PickupPointWorkingHours {
  date: string;
  periods: PickupPointWorkingPeriod[];
}

export interface PickupPointHoliday {
  begin: string;
  end: string;
}

export interface PickupPointProperty {
  enabled: boolean;
  name: string;
}

export interface PickupPointDeliveryMethod {
  address: string;
  address_details: PickupPointAddressDetails;
  coordinates: PickupPointCoordinate;
  delivery_type: PickupPointDeliveryType;
  description: string;
  fitting_rooms_count: number;
  holidays: PickupPointHoliday[];
  holidays_filled: boolean;
  images: string[];
  location_id: string;
  map_point_id: number;
  name: string;
  properties: PickupPointProperty[];
  pvz_rating: number;
  storage_period: number;
  working_hours: PickupPointWorkingHours[];
}

export interface PickupPointInfoItem {
  delivery_method: PickupPointDeliveryMethod;
  enabled: boolean;
}

export interface PickupPointsInfoResponse {
  points: PickupPointInfoItem[];
}
```

### ozon-logistics/delivery.ts

```typescript
import { getAccessToken } from "../../utils/getAccessToken";
import { ozonConfig } from "../../config/env";
import { OzonApiClient } from "../../utils/typedApiClient";
import type {
  CheckDeliveryResponse,
  PickupPointsListResponse,
  PickupPointsInfoResponse,
} from "./types";

/**
 * Проверяет доступность доставки Ozon для покупателя
 * @param clientPhone - номер телефона покупателя в формате 7XXXXXXXXXX
 * @returns объект с полем is_possible
 */
export async function checkDeliveryAvailability(
  clientPhone: string,
): Promise<CheckDeliveryResponse> {
  // Валидация номера телефона
  const phoneRegex = /^7\d{10}$/;
  if (!phoneRegex.test(clientPhone)) {
    console.error("❌ Неверный формат номера телефона:", clientPhone);
    throw new Error("Номер телефона должен быть в формате 7XXXXXXXXXX");
  }

  const token = getAccessToken();
  if (!token) {
    console.error("❌ Токен авторизации не найден");
    throw new Error("Требуется авторизация");
  }

  try {
    console.log(
      `🔄 Проверка доступности доставки для телефона: ${clientPhone}`,
    );

    const client = new OzonApiClient(
      ozonConfig.apiUrl,
      token,
      ozonConfig.timeoutMs,
    );
    const data = await client.call("/v1/delivery/check", {
      client_phone: clientPhone,
    });

    console.log(`✅ Результат проверки: is_possible=${data.is_possible}`);
    return data;
  } catch (error) {
    console.error("❌ Ошибка при проверке доставки:", error);
    throw error;
  }
}

/**
 * Получает список всех точек самовывоза с координатами
 * @returns объект с массивом точек самовывоза
 */
export async function getPickupPointsList(): Promise<PickupPointsListResponse> {
  const token = getAccessToken();
  if (!token) {
    console.error("❌ Токен авторизации не найден");
    throw new Error("Требуется авторизация");
  }

  try {
    console.log("🔄 Получение списка точек самовывоза...");

    const client = new OzonApiClient(
      ozonConfig.apiUrl,
      token,
      ozonConfig.timeoutMs,
    );
    const data = await client.call("/v1/delivery/point/list", {});

    console.log(`✅ Получено точек самовывоза: ${data.points.length}`);
    return data;
  } catch (error) {
    console.error("❌ Ошибка при получении точек самовывоза:", error);
    throw error;
  }
}

/**
 * Получает детальную информацию о точках самовывоза
 * @param mapPointIds - массив идентификаторов точек (максимум 100 за запрос)
 * @returns объект с массивом детальной информации о точках
 */
export async function getPickupPointsInfo(
  mapPointIds: string[],
): Promise<PickupPointsInfoResponse> {
  if (mapPointIds.length === 0) {
    return { points: [] };
  }

  if (mapPointIds.length > 100) {
    console.error("❌ Превышен лимит идентификаторов:", mapPointIds.length);
    throw new Error("Максимум 100 идентификаторов за запрос");
  }

  const token = getAccessToken();
  if (!token) {
    console.error("❌ Токен авторизации не найден");
    throw new Error("Требуется авторизация");
  }

  try {
    console.log(
      `🔄 Получение информации о ${mapPointIds.length} точках самовывоза...`,
    );

    const client = new OzonApiClient(
      ozonConfig.apiUrl,
      token,
      ozonConfig.timeoutMs,
    );
    const data = await client.call("/v1/delivery/point/info", {
      map_point_ids: mapPointIds,
    });

    console.log(`✅ Получена информация о ${data.points.length} точках`);
    return data;
  } catch (error) {
    console.error("❌ Ошибка при получении информации о точках:", error);
    throw error;
  }
}
```

### pickup-points-cache.ts

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  getPickupPointsList,
  getPickupPointsInfo,
} from "./ozon-logistics/delivery";
import { ozonConfig } from "../config/env";
import type {
  PickupPointItem,
  PickupPointInfoItem,
} from "./ozon-logistics/types";

// Пути к файлам кэша
const CACHE_DIR = join(__dirname, "..", "cache");
const POINTS_LIST_FILE = join(CACHE_DIR, "pickup-points-list.json");
const POINTS_INFO_FILE = join(CACHE_DIR, "pickup-points-info.json");

// Настройки обновления
const UPDATE_HOUR = 14; // Обновление в 14:00 (вторая половина дня)
const BATCH_SIZE = 100; // Размер пачки для запросов

// Таймер для ежедневного обновления
let dailyUpdateTimer: NodeJS.Timeout | null = null;

/**
 * Создаёт директорию для кэша, если не существует
 */
function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
    console.log("📁 Создана директория кэша:", CACHE_DIR);
  }
}

/**
 * Сохраняет базовый список точек в файл
 */
function savePointsList(points: PickupPointItem[]): void {
  ensureCacheDir();
  try {
    writeFileSync(
      POINTS_LIST_FILE,
      JSON.stringify(
        {
          last_update: new Date().toISOString(),
          count: points.length,
          points: points,
        },
        null,
        2,
      ),
      "utf-8",
    );
    console.log(`💾 Сохранён список точек: ${points.length} шт.`);
  } catch (error) {
    console.error("❌ Ошибка сохранения списка точек:", error);
    throw error;
  }
}

/**
 * Загружает базовый список точек из файла
 */
function loadPointsList(): {
  points: PickupPointItem[];
  last_update?: string;
  count?: number;
} | null {
  try {
    if (!existsSync(POINTS_LIST_FILE)) {
      return null;
    }
    const data = JSON.parse(readFileSync(POINTS_LIST_FILE, "utf-8"));
    console.log(`📂 Загружен список точек из кэша: ${data.points.length} шт.`);
    return data;
  } catch (error) {
    console.error("❌ Ошибка загрузки списка точек:", error);
    return null;
  }
}

/**
 * Сохраняет детальную информацию о точках в файл
 */
function savePointsInfo(points: PickupPointInfoItem[]): void {
  ensureCacheDir();
  try {
    writeFileSync(
      POINTS_INFO_FILE,
      JSON.stringify(
        {
          last_update: new Date().toISOString(),
          count: points.length,
          points: points,
        },
        null,
        2,
      ),
      "utf-8",
    );
    console.log(`💾 Сохранена детальная информация: ${points.length} шт.`);
  } catch (error) {
    console.error("❌ Ошибка сохранения детальной информации:", error);
    throw error;
  }
}

/**
 * Загружает детальную информацию о точках из файла
 */
export function loadPointsInfo(): { points: PickupPointInfoItem[] } | null {
  try {
    if (!existsSync(POINTS_INFO_FILE)) {
      return null;
    }
    const data = JSON.parse(readFileSync(POINTS_INFO_FILE, "utf-8"));
    return data;
  } catch (error) {
    console.error("❌ Ошибка загрузки детальной информации:", error);
    return null;
  }
}

/**
 * Получает детальную информацию о всех точках пачками
 * @param points - базовый список точек
 * @returns массив детальной информации
 */
async function fetchAllPointsInfo(
  points: PickupPointItem[],
): Promise<PickupPointInfoItem[]> {
  const allInfo: PickupPointInfoItem[] = [];
  const totalPoints = points.length;
  const batches = Math.ceil(totalPoints / BATCH_SIZE);

  console.log(
    `🔄 Начинаем получение детальной информации: ${totalPoints} точек, ${batches} пачек`,
  );

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, totalPoints);
    const batchIds = points
      .slice(start, end)
      .map((p) => p.map_point_id.toString());

    try {
      console.log(
        `📦 Обработка пачки ${i + 1}/${batches} (точки ${start + 1}-${end})`,
      );

      const response = await getPickupPointsInfo(batchIds);
      allInfo.push(...response.points);

      // Небольшая пауза между запросами, чтобы не перегрузить API
      if (i < batches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(
        `❌ Ошибка при обработке пачки ${i + 1}/${batches}:`,
        error,
      );
      // Продолжаем с следующей пачкой
    }
  }

  console.log(
    `✅ Получена детальная информация о ${allInfo.length} из ${totalPoints} точек`,
  );
  return allInfo;
}

/**
 * Инициализирует кэш точек самовывоза
 * Вызывается при запуске сервера
 */
export async function initializePickupPointsCache(): Promise<void> {
  if (!ozonConfig.isConfigured) {
    console.warn(
      "⚠️  Кэш точек самовывоза не инициализирован: конфигурация не завершена",
    );
    return;
  }

  console.log("🚀 Инициализация кэша точек самовывоза...");

  try {
    // 1. Получаем базовый список точек
    console.log("📍 Шаг 1: Получение базового списка точек...");
    const listResponse = await getPickupPointsList();
    savePointsList(listResponse.points);

    // 2. Получаем детальную информацию для всех точек
    console.log("📍 Шаг 2: Получение детальной информации...");
    const infoData = await fetchAllPointsInfo(listResponse.points);
    savePointsInfo(infoData);

    console.log("✅ Кэш точек самовывоза успешно инициализирован");

    // 3. Запускаем ежедневное обновление
    scheduleDailyUpdate();
  } catch (error) {
    console.error("❌ Ошибка инициализации кэша:", error);
    console.warn(
      "⚠️  Сервер продолжит работу без кэша. Кэш будет заполнен при первом запросе с токеном авторизации",
    );
  }
}

/**
 * Обновляет кэш точек самовывоза
 */
export async function refreshPickupPointsCache(): Promise<void> {
  if (!ozonConfig.isConfigured) {
    console.warn("⚠️  Обновление кэша пропущено: конфигурация не завершена");
    return;
  }

  console.log("🔄 Обновление кэша точек самовывоза...");

  try {
    // 1. Получаем базовый список точек
    const listResponse = await getPickupPointsList();
    savePointsList(listResponse.points);

    // 2. Получаем детальную информацию
    const infoData = await fetchAllPointsInfo(listResponse.points);
    savePointsInfo(infoData);

    console.log("✅ Кэш точек самовывоза успешно обновлён");
  } catch (error) {
    console.error("❌ Ошибка обновления кэша:", error);
  }
}

/**
 * Планирует ежедневное обновление кэша
 * Запускается в UPDATE_HOUR часов (14:00 по умолчанию)
 */
function scheduleDailyUpdate(): void {
  // Очищаем предыдущий таймер
  if (dailyUpdateTimer) {
    clearTimeout(dailyUpdateTimer);
    dailyUpdateTimer = null;
  }

  const now = new Date();
  const nextUpdate = new Date();
  nextUpdate.setHours(UPDATE_HOUR, 0, 0, 0);

  // Если время обновления уже прошло сегодня, планируем на завтра
  if (now >= nextUpdate) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
  }

  const timeUntilUpdate = nextUpdate.getTime() - now.getTime();
  const hoursUntilUpdate = Math.floor(timeUntilUpdate / (1000 * 60 * 60));
  const minutesUntilUpdate = Math.floor(
    (timeUntilUpdate % (1000 * 60 * 60)) / (1000 * 60),
  );

  console.log(
    `⏰ Следующее обновление кэша: ${nextUpdate.toLocaleString("ru-RU")} (через ${hoursUntilUpdate}ч ${minutesUntilUpdate}мин)`,
  );

  dailyUpdateTimer = setTimeout(async () => {
    await refreshPickupPointsCache();
    // Планируем следующее обновление
    scheduleDailyUpdate();
  }, timeUntilUpdate);

  // Не блокируем выход из процесса
  dailyUpdateTimer.unref();
}

/**
 * Получает статус кэша
 */
export function getCacheStatus(): {
  listExists: boolean;
  infoExists: boolean;
  lastUpdate: string | null;
  pointsCount: number;
} {
  const listData = loadPointsList();
  const infoData = loadPointsInfo();

  return {
    listExists: existsSync(POINTS_LIST_FILE),
    infoExists: existsSync(POINTS_INFO_FILE),
    lastUpdate: listData?.last_update || null,
    pointsCount: listData?.count || 0,
  };
}

/**
 * Останавливает автоматическое обновление
 */
export function stopDailyUpdate(): void {
  if (dailyUpdateTimer) {
    clearTimeout(dailyUpdateTimer);
    dailyUpdateTimer = null;
    console.log("⏹️  Остановлено ежедневное обновление кэша");
  }
}
```

---

## Документация

### agents.md

Документация о проекте находится в файле agents.md (архитектура проекта, описание структуры, развертывание и т.д.)

### TYPED_API_CLIENT.md

Подробная документация по типизированному API клиенту для работы с Ozon API с примерами использования.

### USE_FETCH_GUIDE.md

Полное руководство по использованию функции useFetch для безопасной обработки ошибок при работе с API.

---

## ✅ ПОЛНЫЙ КОД ПРОЕКТА ЗАВЕРШЕН

Этот файл содержит весь исходный код проекта Ozon Logistics Backend в одном месте.

**Структура проекта:**

- 📦 Конфигурация (package.json, tsconfig.json, .env)
- 🎯 Точка входа (index.ts)
- 🔧 Модули (Auth, Delivery)
- 🛠️ Утилиты (15+ файлов с функциями)
- 📊 Сервисы (Ozon Logistics, Cache)
- 📚 Документация (3 обширных гайда)

**Технологический стаж:**

- Runtime: Bun
- Framework: Elysia
- Language: TypeScript
- Architecture: Modular REST API

**Ключевые функции:**

- ✅ OAuth авторизация с автоматическим обновлением токенов
- ✅ Type-safe API клиент с автокомплитом IDE
- ✅ Унифицированная обработка ошибок
- ✅ Rate limiting (10 req/s)
- ✅ Кэширование данных о точках самовывоза
- ✅ CORS поддержка
- ✅ Логирование с временными метками
