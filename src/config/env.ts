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

  // Tilda webhook
  tildaWebhookApiKey: process.env.TILDA_WEBHOOK_API_KEY || "",

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
