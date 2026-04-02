# 📚 Полная документация Codebase - Ozon Logistics API

**Версия:** 1.50.0  
**Runtime:** Bun  
**Framework:** Elysia + TypeScript  
**Дата создания:** 3 апреля 2026 г.

---

## 📋 Оглавление

1. [Обзор проекта](#обзор-проекта)
2. [Архитектура](#архитектура)
3. [Структура папок](#структура-папок)
4. [Модули](#модули)
5. [Сервисы](#сервисы)
6. [Утилиты](#утилиты)
7. [База данных](#база-данных)
8. [API Endpoints](#api-endpoints)
9. [Процесс авторизации](#процесс-авторизации)
10. [Примеры использования](#примеры-использования)

---

## 🎯 Обзор проекта

**Ozon Logistics API** — это backend сервис на Bun/Elysia для интеграции с Ozon Seller API и Ozon Логистикой. Основные задачи:

- **OAuth авторизация** с автоматическим управлением токенами
- **Проверка доступности доставки** по телефону клиента
- **Управление точками самовывоза** (фильтрация, поиск, кэширование)
- **Расчет стоимости доставки** с учётом товаров и точки доставки
- **Интеграция с Tilda** — платформой для создания интернет-магазинов
- **Кэширование** точек самовывоза в SQLite и полнотекстовый поиск

### Ключевые особенности

✅ **Type-safe API** — полная типизация всех endpoint'ов  
✅ **Автоматическое управление токенами** — обновление за 24 часа до истечения  
✅ **Кэширование в SQLite** — быстрый поиск среди тысяч точек самовывоза  
✅ **Rate limiting** — ограничение запросов к Ozon API  
✅ **CORS поддержка** — работа с фронтенд приложениями  
✅ **Логирование** — детальные логи всех операций

---

## 🏗️ Архитектура

### Многоуровневая архитектура

```
┌─────────────────────────────────────┐
│     Tilda платформа (фронтенд)      │
└──────────────────┬──────────────────┘
                   │
                   ↓
┌─────────────────────────────────────┐
│    Ozon Logistics API (этот проект)  │
├─────────────────────────────────────┤
│ ▌ Модули (Auth, Delivery)            │
│ ▌ Сервисы (Delivery, Checkout)       │
│ ▌ Утилиты (Fetch, Cache, Logger)     │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        ↓             ↓
    ┌────────┐  ┌──────────┐
    │ SQLite │  │ Ozon API │
    │ (кэш)  │  │(доставка)│
    └────────┘  └──────────┘
```

### Принципы организации

1. **Модульность** — каждый модуль в отдельной папке с четким `prefix`
2. **Разделение ответственности** — модули, сервисы, утилиты
3. **Типобезопасность** — полная типизация всех операций
4. **Асинхронность** — async/await на всех уровнях
5. **Обработка ошибок** — try-catch, валидация входных данных

---

## 📁 Структура папок

```
ozon/
│
├── 📄 package.json                 # Зависимости (Elysia, Bun)
├── 📄 tsconfig.json                # TypeScript конфигурация
├── 📄 ecosystem.config.js          # PM2 конфиг для продакшена
├── 📄 .env                         # Переменные окружения (не коммитится)
├── 🔑 key, key.pub                 # SSH ключи (не коммитится)
│
├── src/
│   ├── 📄 index.ts                 # Точка входа приложения
│   │
│   ├── config/
│   │   └── 📄 env.ts               # Загрузка и валидация .env
│   │
│   ├── modules/                    # Основные модули с API
│   │   ├── auth/
│   │   │   └── 📄 auth.ts          # OAuth авторизация (GET/POST)
│   │   └── delivery/
│   │       └── 📄 delivery.ts      # Endpoints доставки (5+ методов)
│   │
│   ├── services/                   # Бизнес-логика и интеграции
│   │   ├── 📄 pickup-points-cache.ts  # Кэширование точек самовывоза
│   │   └── ozon-logistics/             # Интеграция с Ozon API
│   │       ├── 📄 delivery.ts       # Проверка доставки, получение точек
│   │       ├── 📄 checkout.ts       # Расчет цены доставки
│   │       ├── 📄 mapper.ts         # Преобразование данных
│   │       └── 📄 types.ts          # TypeScript типы для Ozon API
│   │
│   ├── utils/                      # Вспомогательные функции
│   │   ├── 📄 getAccessToken.ts    # OAuth токены и управление
│   │   ├── 📄 ozonFetch.ts         # Типизированный fetch для API
│   │   ├── 📄 htmlResponses.ts     # HTML шаблоны для callback
│   │   ├── 📄 useFetch.ts          # Безопасный fetch с обработкой ошибок
│   │   ├── 📄 rateLimiter.ts       # Rate limiting для Ozon API
│   │   ├── 📄 typedApiClient.ts    # Type mapping для endpoints
│   │   ├── 📄 logger.ts            # Логирование
│   │   └── 📄 useFetch.examples.ts # Примеры использования
│   │
│   ├── db/
│   │   └── 📄 index.ts             # Инициализация SQLite БД
│   │
│   ├── cache/                      # Папка для хранения данных (не коммитится)
│   │   ├── ozon.db                 # SQLite база с точками самовывоза
│   │   ├── ozon_token.json         # Сохраненный OAuth токен
│   │   └── tilda-callbacks.log     # Логи callback'ов от Tilda
│   │
│   └── scripts/                    # Утилиты для развертывания
│       ├── 📄 rebuild-fts.ts       # Пересоздание FTS индекса
│       └── 📄 tilda-map-patch.js   # JavaScript патч для фронтенда
│
└── 📄 README.md                    # Основная документация
```

---

## 🔌 Модули

### 1. Auth Module (`src/modules/auth/auth.ts`)

**Назначение:** OAuth авторизация с Ozon, управление токенами

**Endpoints:**

| Метод | Путь                                | Описание                          | Режим    |
| ----- | ----------------------------------- | --------------------------------- | -------- |
| GET   | `/auth/url`                         | Получить URL авторизации          | All      |
| GET   | `/auth/callback?code=...&state=...` | Обработка callback от Ozon        | All      |
| GET   | `/auth/status`                      | Статус токена, время до истечения | Dev only |
| POST  | `/auth/reset`                       | Сброс токена (удалить файл)       | Dev only |
| POST  | `/auth/refresh`                     | Ручное обновление токена          | Dev only |

**Ключевые функции:**

```typescript
// Перенаправляет на OAuth страницу Ozon
GET /auth/url

// OAuth callback от Ozon
// Обменивает code на токен
GET /auth/callback?code=XXX&state=YYY

// Проверка статуса текущего токена
GET /auth/status
// Возвращает:
// {
//   success: true,
//   token_preview: "1234567890...",
//   expires_in: 2592000,
//   scope: ["business", "delivery"],
//   configured: true
// }

// Сброс токена (удаляет файл ozon_token.json)
POST /auth/reset

// Обновить токен вручную
POST /auth/refresh
```

**Процесс авторизации:**

1. Фронтенд запрашивает `/auth/url`
2. Сервер возвращает 302 редирект на OAuth страницу Ozon
3. Пользователь логинится в Ozon
4. Ozon перенаправляет на `/auth/callback?code=...&state=...`
5. Сервер обменивает code на токен и сохраняет в `ozon_token.json`
6. Запускается таймер для автообновления за 24 часа до истечения
7. Клиент видит HTML страницу успеха

**Особенности:**

- ✅ CSRF защита через state параметр
- ✅ Автоматическое обновление токена за 24 часа до истечения
- ✅ Токен сохраняется в файл (приживает перезагрузку)
- ✅ Таймер восстанавливается при старте приложения
- ✅ Логирование всех шагов авторизации

---

### 2. Delivery Module (`src/modules/delivery/delivery.ts`)

**Назначение:** API endpoints для работы с доставкой и точками самовывоза

**Endpoints:**

| Метод | Путь                         | Описание                       | Параметры                           |
| ----- | ---------------------------- | ------------------------------ | ----------------------------------- |
| POST  | `/v1/delivery/check`         | Проверить доступность доставки | `client_phone`                      |
| POST  | `/v1/delivery/tilda/success` | Callback от Tilda после оплаты | `any` (логирует)                    |
| GET   | `/v1/delivery/pvz`           | Получить точки самовывоза      | `q`, `limit`, `offset`              |
| GET   | `/v1/delivery/pvz/all`       | Все точки самовывоза           | -                                   |
| GET   | `/v1/delivery/pvz/status`    | Статус кэша ПВЗ                | -                                   |
| POST  | `/v1/delivery/price`         | Расчет цены доставки           | `mapPointId`, `items`, `buyerPhone` |
| POST  | `/v1/delivery/map`           | Получить точки для карты       | `viewport`, `zoom`                  |

**Примеры использования:**

```javascript
// 1. Проверить доступность доставки
POST /v1/delivery/check
{
  "client_phone": "79991234567"
}

// Ответ:
{
  "success": true,
  "is_possible": true,
  "available_types": ["Pickup", "DeliveryAtHome"]
}

// 2. Получить точки самовывоза (поиск)
GET /v1/delivery/pvz?q=москва&limit=50

// Ответ:
{
  "success": true,
  "pvz": [
    {
      "map_point_id": 12345,
      "name": "Ст. м. Красные Ворота",
      "address": "Москва, ул. Лусировая",
      "lat": 55.7647,
      "long": 37.6250,
      ...
    }
  ],
  "total": 1
}

// 3. Все точки (для выгрузки на фронтенд)
GET /v1/delivery/pvz/all

// 4. Статус кэша
GET /v1/delivery/pvz/status
// {
//   "success": true,
//   "count": 15234,
//   "last_update": "2026-04-03T14:15:30Z",
//   "cache_status": "actual"
// }

// 5. Расчет цены доставки
POST /v1/delivery/price
{
  "mapPointId": 12345,
  "items": [
    { "sku": 100, "quantity": 2, "offer_id": "offer1" }
  ],
  "buyerPhone": "79991234567"
}

// Ответ:
{
  "success": true,
  "price": 299,
  "days": 3,
  "deadline": "2026-04-06T23:59:59Z"
}

// 6. Карта — получить точки в viewport
POST /v1/delivery/map
{
  "viewport": {
    "left_bottom": { "lat": 55.7, "long": 37.5 },
    "right_top": { "lat": 55.8, "long": 37.7 }
  },
  "zoom": 12
}

// Ответ: массив точек для отрисовки на карте
```

**Особенности:**

- ✅ Валидация входных данных через `t.Object()`
- ✅ Полнотекстовый поиск через FTS5
- ✅ Фильтрация по координатам (zoom < 10 → пустой результат)
- ✅ Кэширование — быстрые ответы
- ✅ Логирование всех ошибок

---

## 🚀 Сервисы

### 1. Pickup Points Cache (`src/services/pickup-points-cache.ts`)

**Назначение:** Кэширование и управление точками самовывоза (ПВЗ) в SQLite

**Основные функции:**

```typescript
// Инициализация кэша при старте
initializePickupPointsCache(): Promise<void>

// Получить точки самовывоза с поиском
getTildaPickupPoints(options: {
  q?: string;      // Текстовый поиск
  limit?: number;  // max 5000
  offset?: number; // Пагинация
}): { pvz: TildaPickupPoint[], total: number }

// Получить все точки (для выгрузки)
getAllTildaPickupPoints(): TildaPickupPoint[]

// Получить точки в viewport карты
getTildaPickupPointsByViewport(params: {
  viewport: ViewportBounds;
  zoom: number;
}): TildaPickupPoint[]

// Статус кэша (когда обновлялся, сколько записей)
getCacheStatus(): { count: number, last_update: string, ... }

// Обновить кэш (запросить свежие данные у Ozon)
refreshPickupPointsCache(): Promise<void>
```

**Процесс кэширования:**

1. **При старте:**
   - Проверить есть ли данные в БД
   - Если нет → загрузить с Ozon API
   - Запустить таймер для ежедневного обновления в 14:00

2. **При обновлении:**
   - Запросить все точки с Ozon (батчами по 100)
   - Преобразовать в нужный формат
   - Сохранить в SQLite
   - Обновить FTS индекс

3. **При поиске:**
   - Если есть `q` → полнотекстовый поиск через FTS5
   - Если нет → просто limit/offset
   - Вернуть с пагинацией

**Особенности:**

- ✅ Батч-загрузка (по 100 точек)
- ✅ FTS5 индекс для быстрого поиска
- ✅ Пространственные индексы (lat, long)
- ✅ Ежедневное автообновление в 14:00
- ✅ Обновление после успешной авторизации

---

### 2. Ozon Logistics Services

#### `src/services/ozon-logistics/delivery.ts`

**Проверка доставки и получение точек:**

```typescript
// Проверить, возможна ли доставка по телефону
checkDeliveryAvailability(clientPhone: string): Promise<{
  is_possible: boolean;
  available_types: DeliveryType[];
  available_locations: DeliveryLocation[];
}>

// Получить все точки самовывоза (включено в кэш)
getPickupPointsList(params: {
  limit?: number;
  offset?: number;
}): Promise<PickupPointItem[]>

// Получить полную информацию о точке (описание, часы, рейтинг)
getPickupPointsInfo(mapPointIds: number[]): Promise<PickupPointInfoItem[]>
```

#### `src/services/ozon-logistics/checkout.ts`

**Расчет стоимости доставки:**

```typescript
// Получить цену доставки до конкретной точки
getDeliveryPrice(params: {
  mapPointId: number;
  items: OrderItem[];
  buyerPhone?: string;
}): Promise<{
  price: number;
  days: number;
  deadline: string;
}>
```

#### `src/services/ozon-logistics/mapper.ts`

**Преобразование данных Ozon → Tilda format:**

```typescript
// Преобразовать точку Ozon в формат Tilda
mapOzonPointToTilda(point: OzonPoint): TildaPickupPoint

// Преобразовать несколько точек
mapOzonPointsToTilda(points: OzonPoint[]): TildaPickupPoint[]
```

---

## 🛠️ Утилиты

### 1. OAuth Token Management (`src/utils/getAccessToken.ts`)

**Управление токенами доступа:**

```typescript
// Основные функции:

// Получить URL авторизации
getAuthUrl(): string

// Обменять code на токен
fetchAccessToken(grantType: 'authorization_code' | 'refresh_token', codeOrRefresh: string): Promise<TokenData>

// Получить текущий токен из кэша
getAccessToken(): string | null

// Получить статус токена
getTokenStatus(): { expires_in: number, scope: string[], ... }

// Сброс токена
resetToken(): void

// Получить refresh token
getRefreshToken(): string | null

// Валилидация state (CSRF защита)
validateState(state: string): boolean
```

**Токен сохраняется в:**

- Память (RAM) - для быстрого доступа
- Файл `src/utils/ozon_token.json` - для сохранения между перезагрузками

**Структура токена:**

```json
{
  "access_token": "1234567890abcdef",
  "refresh_token": "abcdef1234567890",
  "expires": 1712145600000,
  "token_type": "Bearer",
  "scope": ["business", "delivery"]
}
```

---

### 2. Типизированный Fetch (`src/utils/ozonFetch.ts` + `useFetch.ts`)

**Безопасный fetch с типами:**

```typescript
// Типизированный запрос к Ozon API
const result = await ozonFetch("/v1/delivery/check", {
  client_phone: "79991234567",
});

if (result.status === "ok") {
  // result.response имеет точный тип ответа
  console.log(result.response.is_possible);
} else {
  // result.response — это ошибка
  console.error(result.response.message);
}

// Возвращаемая структура:
type ApiResult<T> =
  | { status: "ok"; response: T }
  | { status: "error"; response: OzonErrorType };
```

**Особенности:**

- ✅ IDE автоматически подсказывает правильный тип ответа
- ✅ Обработка ошибок сети, таймауты
- ✅ Rate limiting для предотвращения блокировки
- ✅ Логирование ошибок

---

### 3. HTML Responses (`src/utils/htmlResponses.ts`)

**Генерация HTML для OAuth callback:**

```typescript
// Успешная авторизация
generateSuccessHTML(data: {
  expires_in: number;
  scope: string[];
}): string

// Ошибка авторизации
generateErrorHTML(message: string): string

// Создать HTTP ответ
createHTMLResponse(html: string): Response
```

**Пример HTML ответов:**

```html
<!-- При успехе -->
<html>
  <h1>✅ Авторизация успешна!</h1>
  <p>Токен действителен 30 дней</p>
  <p>Разрешения: business, delivery</p>
  <p>Окно можно закрыть</p>
</html>

<!-- При ошибке -->
<html>
  <h1>❌ Ошибка авторизации</h1>
  <p>Сообщение ошибки</p>
</html>
```

---

### 4. Rate Limiter (`src/utils/rateLimiter.ts`)

**Ограничение частоты запросов к Ozon API:**

```typescript
// Выполнить fetch с учетом rate limit
rateLimitedFetch(url: URL, options: RequestInit): Promise<Response>
```

**Особенности:**

- ✅ Очередь запросов
- ✅ Задержка между запросами
- ✅ Отказ при превышении лимита

---

### 5. Logger (`src/utils/logger.ts`)

**Логирование с форматированием:**

```typescript
// Все уровни:
log(message: string, data?: any)      // ℹ️
info(message: string)                 // ℹ️
warn(message: string)                 // ⚠️
error(message: string, error?: any)   // ❌
debug(message: string, data?: any)    // 🐛
success(message: string)               // ✅
```

---

## 🗄️ База данных

### Инициализация (`src/db/index.ts`)

**SQLite БД с WAL режимом:**

```typescript
// Используется Bun встроенный SQLite
import { Database } from "bun:sqlite";
const db = new Database(DB_FILE, { create: true, strict: true });
```

**Таблица `pickup_points`:**

```sql
CREATE TABLE pickup_points (
  map_point_id INTEGER PRIMARY KEY,
  enabled INTEGER,
  name TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  street TEXT,
  house TEXT,
  description TEXT,
  lat REAL,
  long REAL,
  location_id TEXT,
  delivery_type_id INTEGER,
  delivery_type_name TEXT,
  fitting_rooms_count INTEGER,
  pvz_rating REAL,
  storage_period INTEGER,
  working_hours TEXT,    -- JSON массив
  properties TEXT,       -- JSON объект
  images TEXT,          -- JSON массив
  updated_at TEXT       -- ISO datetime
);
```

**Индексы:**

- `idx_pp_city` — быстрый поиск по городу
- `idx_pp_enabled` — фильтр включенных точек
- `idx_pp_region` — поиск по регионам
- `idx_pp_coords` — пространственный поиск (lat, long)
- `pickup_points_fts` — полнотекстовый поиск (FTS5)

**Триггеры:**

- `pp_fts_insert` — синхронизация FTS при INSERT
- `pp_fts_update` — синхронизация FTS при UPDATE
- `pp_fts_delete` — синхронизация FTS при DELETE

**Оптимизации:**

```typescript
PRAGMA journal_mode = WAL;      // Write-Ahead Logging
PRAGMA synchronous = NORMAL;    // Баланс безопасность/скорость
PRAGMA cache_size = -16000;     // 16MB кэш в памяти
PRAGMA temp_store = MEMORY;     // Временные данные в RAM
```

---

## 🌐 API Endpoints

### Root

```
GET /
→ { status: "ok", service: "ozon-logistics-api" }
```

### Auth (`/auth`)

| Метод | Путь             | Тип          | Режим |
| ----- | ---------------- | ------------ | ----- |
| GET   | `/auth/url`      | Redirect 302 | All   |
| GET   | `/auth/callback` | HTML/JSON    | All   |
| GET   | `/auth/status`   | JSON         | Dev   |
| POST  | `/auth/reset`    | JSON         | Dev   |
| POST  | `/auth/refresh`  | JSON         | Dev   |

### Delivery (`/v1/delivery/*`)

| Метод | Путь                         | Параметры                           | Ответ                              |
| ----- | ---------------------------- | ----------------------------------- | ---------------------------------- |
| POST  | `/v1/delivery/check`         | `client_phone`                      | `{ is_possible, available_types }` |
| POST  | `/v1/delivery/tilda/success` | любые                               | `{ success: true }`                |
| GET   | `/v1/delivery/pvz`           | `q`, `limit`, `offset`              | `{ success, pvz[], total }`        |
| GET   | `/v1/delivery/pvz/all`       | -                                   | `{ success, count, pvz[] }`        |
| GET   | `/v1/delivery/pvz/status`    | -                                   | `{ success, count, last_update }`  |
| POST  | `/v1/delivery/price`         | `mapPointId`, `items`, `buyerPhone` | `{ success, price, days }`         |
| POST  | `/v1/delivery/map`           | `viewport`, `zoom`                  | `TildaPickupPoint[]`               |

---

## 🔐 Процесс авторизации

### OAuth Flow Диаграмма

```
┌──────────────┐                    ┌────────────────┐
│   Клиент     │                    │   Ozon API     │
│ (Браузер)    │                    │   /OAuth       │
└──────┬───────┘                    └────────┬───────┘
       │                                     │
       │ 1. Нажать "Авторизоваться"          │
       ├────────────── GET /auth/url ────────→
       │                                     │
       │ 2. 302 Redirect → Ozon OAuth        │
       ←──────────────────────────────────────┤
       │                                     │
       │ 3. Логин в Ozon                     │
       ├─────────────────────────────────────→
       │                                     │
       │ 4. Ozon вернет callback             │
       │ GET /auth/callback?code=...         │
       ←───────────────────────────────────────
       │
       ├─── Сервер обменивает code на token ──┬─→
       │                                     │
       │ 5. HTML страница успеха             │
       ←────────────────────────────────────────┘
```

### Этапы обновления токена

```
Получен токен
  ↓
Сохранено в файл (ozon_token.json)
  ↓
Сохранено в памяти (tokenCache)
  ↓
Запущен таймер на (expires_in - 24 часа)
  ↓
За 24 часа до истечения → Автообновление
  ↓
Новый токен получен
  ↓
Сохранено в файл и памяти
  ↓
Таймер перезапущен
```

### State параметр (CSRF защита)

```typescript
// При генерации URL авторизации
1. Создать уникальный state = randomUUID()
2. Сохранить в stateCache с ttl = 10 минут
3. Передать в URL параметр

// При callback
1. Получить state из query параметра
2. Проверить есть ли в stateCache
3. Если есть — удалить (использовать может быть только раз)
4. Если нет → CSRF атака, отклонить

// Очистка старых state каждую минуту
```

---

## 📖 Примеры использования

### 1. Авторизация

```bash
# Получить URL авторизации
curl http://localhost:3000/auth/url

# Получит 302 редирект на:
# https://api-seller.ozon.ru/auth?client_id=...&state=...

# Пользователь логинится, Ozon перенаправляет на callback
# Сервер автоматически обменивает code на токен
```

### 2. Проверка доставки

```bash
curl -X POST http://localhost:3000/v1/delivery/check \
  -H "Content-Type: application/json" \
  -d '{"client_phone": "79991234567"}'

# Ответ:
{
  "success": true,
  "is_possible": true,
  "available_types": ["Pickup", "DeliveryAtHome"],
  "available_locations": [
    {
      "location_id": "123",
      "name": "Москва"
    }
  ]
}
```

### 3. Поиск точек самовывоза

```bash
# Поиск по названию
curl 'http://localhost:3000/v1/delivery/pvz?q=красные%20ворота&limit=10'

# Ответ:
{
  "success": true,
  "pvz": [
    {
      "map_point_id": 12345,
      "name": "Ст. м. Красные Ворота",
      "address": "Москва, ул. Лусировая, д. 5",
      "city": "Москва",
      "region": "Московская область",
      "enabled": 1,
      "lat": 55.7647,
      "long": 37.6250,
      "pvz_rating": 4.8,
      "fitting_rooms_count": 2,
      "working_hours": "[...]"
    }
  ],
  "total": 1
}
```

### 4. Расчет цены доставки

```bash
curl -X POST http://localhost:3000/v1/delivery/price \
  -H "Content-Type: application/json" \
  -d '{
    "mapPointId": 12345,
    "items": [
      {"sku": 100, "quantity": 2, "offer_id": "offer_1"}
    ],
    "buyerPhone": "79991234567"
  }'

# Ответ:
{
  "success": true,
  "price": 299,
  "days": 3,
  "deadline": "2026-04-06T23:59:59Z"
}
```

### 5. Получение карты

```bash
curl -X POST http://localhost:3000/v1/delivery/map \
  -H "Content-Type: application/json" \
  -d '{
    "viewport": {
      "left_bottom": {"lat": 55.7, "long": 37.5},
      "right_top": {"lat": 55.8, "long": 37.7}
    },
    "zoom": 12
  }'

# Ответ: массив из ~50-200 точек с lat/long для отрисовки
```

---

## 📊 Переменные окружения

### Обязательные

```env
OZON_LOGISTICS_CLIENT_ID=your_client_id
OZON_LOGISTICS_CLIENT_SECRET=your_client_secret
```

### Опциональные

```env
# API URLs
OZON_LOGISTICS_API_URL=https://api-seller.ozon.ru
OZON_LOGISTICS_AUTH_URL=https://api-seller.ozon.ru

# Redirect URI для OAuth callback
# Если не задан — формируется автоматически из IP и PORT
OZON_LOGISTICS_REDIRECT_URI=http://YOUR_IP:PORT/auth/callback

# Режим работы (true = production, false = development)
OZON_LOGISTICS_IS_PROD=false

# Таймаут для API запросов (мс)
OZON_LOGISTICS_TIMEOUT=10000

# Порт для прослушивания
PORT=3000
```

---

## 🔧 Конфигурация

### `src/config/env.ts`

```typescript
// Экспортирует объект с конфигурацией:
export const ozonConfig = {
  clientId: string;              // из OZON_LOGISTICS_CLIENT_ID
  clientSecret: string;          // из OZON_LOGISTICS_CLIENT_SECRET
  apiUrl: string;                // URL базы API
  authUrl: string;               // URL для авторизации
  redirectUri: string;           // Callback URL
  isProd: boolean;               // Режим production?
  timeoutMs: number;             // Таймаут запросов
  port: number;                  // Порт сервера
  isConfigured: boolean;         // Все ли переменные заданы?
}

// Проверяет при старте:
// 1. Наличие CLIENT_ID и CLIENT_SECRET
// 2. Валидность переменных
// 3. Автоматически определяет IP для redirect_uri
// 4. Логирует конфигурацию
```

---

## 🚀 Запуск и развертывание

### Development

```bash
# Установка зависимостей
bun install

# Запуск с watch режимом
bun run dev

# Логирование:
# 🦊 Elysia is running at 192.168.1.100:3000
# ✅ Pickup points cache initialized
```

### Production (через PM2)

```bash
# Используется ecosystem.config.js
pm2 start ecosystem.config.js

# Логирование
pm2 logs ozon-api

# Перезагрузка
pm2 restart ozon-api
```

### Docker (если требуется)

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install
CMD ["bun", "run", "src/index.ts"]
```

---

## 📝 Скрипты

### Rebuild FTS (`src/scripts/rebuild-fts.ts`)

Пересоздает полнотекстовый индекс для быстрого поиска.

```bash
bun run db:rebuild-fts
```

**Когда использовать:**

- После прямого изменения таблицы БД
- Если поиск работает неправильно
- После восстановления из бэкапа

---

### Tilda Patch (`src/scripts/tilda-map-patch.js`)

JavaScript патч для интеграции с Tilda.

```javascript
// Перехватывает компонент доставки Tilda
// Заменяет стандартный поиск/карту на кастомные

// Функции:
loadPointsForViewport(map, delivery); // Загружает точки в viewport
delivery.getPickupList; // Переопределяет поиск
delivery.mapInit; // Переопределяет инициализацию карты
```

**Установка:**

1. Вставить скрипт в Tilda в HTML блок
2. Скрипт автоматически перехватит компонент доставки
3. Поиск и карта будут использовать наш API

---

## 🐛 Troubleshooting

### Проблема: "Authorization token not found"

**Решение:**

1. Проверить есть ли файл `ozon_token.json` в `src/utils/`
2. Выполнить `/auth/url` и авторизоваться
3. Проверить логи на ошибки

### Проблема: "redirect_uri does not match"

**Решение:**

1. Проверить `OZON_LOGISTICS_REDIRECT_URI` в .env
2. Или убедиться что IP и PORT совпадают с настройками Ozon
3. Посмотреть in логов - там выводится автоматический redirect_uri

### Проблема: "Port already in use"

**Решение:**

1. Изменить PORT в .env
2. Или убить процесс: `lsof -i :3000` → `kill -9 <PID>`

### Проблема: Медленный поиск

**Решение:**

1. Пересоздать FTS индекс: `bun run db:rebuild-fts`
2. Проверить кэш БД: `/v1/delivery/pvz/status`
3. Убедиться что zoom >= 10 при запросе карты

---

## 📚 Дополнительная информация

### Краткая история проекта

- **v1.0** — Первоначальная версия с OAuth и проверкой доставки
- **v1.30** — Добавлено кэширование точек в SQLite
- **v1.40** — FTS5 для полнотекстового поиска
- **v1.50** — Поддержка Tilda интеграции, карта viewport

### Известные ограничения

1. **Ozon restrict на порты** — требует двузначный порт (< 100) для OAuth
2. **Rate limiting** — Ozon может ограничить частоту запросов
3. **Token refresh** — требует refresh_token (автоматически обновляется)

### Планы развития

- 📌 Кэширование цен доставки
- 📌 WebSocket для live обновлений карты
- 📌 Multi-region поддержка
- 📌 GraphQL API опционально

---

## 📞 Контакты и поддержка

- **Документация Ozon:** https://docs.ozon.ru/sellers/
- **Appstore Ozon:** https://seller.ozon.ru/app/appstore/
- **Bun документация:** https://bun.sh/
- **Elysia Framework:** https://elysiajs.com/

---

**Документ актуален на:** 3 апреля 2026 г.  
**Версия кода:** 1.50.0  
**Поддерживаемая версия Node:** Bun 1.x

---

_Это полная документация всей кодовой базы. Используйте её как справочник при развитии и поддержке проекта._
