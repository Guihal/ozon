# Ozon Logistics API

Backend для интеграции сайта на Тильде с доставкой Ozon. OAuth-авторизация, расчёт стоимости, выбор ПВЗ/курьера, создание заказов — всё через Ozon Seller API.

## Стек

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Elysia](https://elysiajs.com)
- **Language**: TypeScript
- **БД**: SQLite (встроенная в Bun)
- **Фронтенд**: JS-патч для корзины Тильды

## Запуск

```bash
bun install
cp .env.example .env   # заполнить переменные
bun run dev             # dev с hot reload
bun run src/index.ts    # prod
```

## ENV

| Переменная                     | Обяз. | Описание                               |
| ------------------------------ | ----- | -------------------------------------- |
| `OZON_LOGISTICS_CLIENT_ID`     | да    | Client ID из Ozon Seller               |
| `OZON_LOGISTICS_CLIENT_SECRET` | да    | Client Secret                          |
| `TILDA_WEBHOOK_API_KEY`        | да    | Ключ webhook от Тильды                 |
| `YANDEX_GEOCODER_API_KEY`      | нет   | Яндекс Геокодер (fallback — Nominatim) |
| `SERVER_DOMEN`                 | нет   | Домен сервера                          |
| `PORT`                         | нет   | Порт (3000)                            |
| `OZON_LOGISTICS_IS_PROD`       | нет   | `true` — отключает dev-эндпоинты       |
| `SMTP_*`                       | нет   | SMTP для email-алертов                 |
| `NOTIFY_EMAIL`                 | нет   | Email для уведомлений                  |

## Структура

```
src/
├── index.ts                        # Точка входа
├── config/env.ts                   # Конфигурация
├── db/index.ts                     # SQLite
├── modules/
│   ├── auth/auth.ts                # OAuth с Ozon
│   └── delivery/delivery.ts        # Эндпоинты доставки и заказов
├── services/
│   ├── pickup-points-cache.ts      # Кеш ПВЗ (FTS5, cron)
│   └── ozon-logistics/
│       ├── checkout.ts             # Расчёт цены/сроков
│       ├── delivery.ts             # Доступность, карта ПВЗ
│       ├── order.ts                # Создание заказа из webhook
│       ├── product.ts              # SKU → offer_id
│       ├── mapper.ts               # Маппинг данных
│       └── types.ts                # Типы Ozon API
├── utils/
│   ├── getAccessToken.ts           # OAuth-токены
│   ├── requestQueue.ts             # Очередь при 401
│   ├── ozonFetch.ts                # Fetch к Ozon API
│   ├── geocode.ts                  # Яндекс + Nominatim
│   ├── rateLimiter.ts              # 10 req/s
│   ├── mailer.ts                   # Email-уведомления
│   └── logger.ts                   # Логирование
└── scripts/
    └── tilda-map-patch.html        # JS-патч для Тильды
```

## API

### Auth `/auth`

| Метод | Путь             | Описание               |
| ----- | ---------------- | ---------------------- |
| GET   | `/auth/url`      | URL авторизации Ozon   |
| GET   | `/auth/callback` | OAuth callback         |
| GET   | `/auth/status`   | Статус токена _(dev)_  |
| POST  | `/auth/reset`    | Сброс токена _(dev)_   |
| POST  | `/auth/refresh`  | Обновить токен _(dev)_ |

### Доставка `/v1`

| Метод | Путь                         | Описание               |
| ----- | ---------------------------- | ---------------------- |
| POST  | `/v1/delivery/check`         | Проверка телефона      |
| POST  | `/v1/delivery/price`         | Цена/сроки — ПВЗ       |
| POST  | `/v1/delivery/courier/price` | Цена/сроки — курьер    |
| POST  | `/v1/delivery/map`           | Кластеры ПВЗ для карты |
| GET   | `/v1/delivery/pvz`           | Поиск ПВЗ по тексту    |
| GET   | `/v1/delivery/pvz/all`       | Все ПВЗ                |
| GET   | `/v1/delivery/pvz/status`    | Статус кеша            |
| POST  | `/v1/delivery/geocode`       | Геокодирование адреса  |

### Заказы `/v1`

| Метод    | Путь                | Описание                      |
| -------- | ------------------- | ----------------------------- |
| POST     | `/v1/order/webhook` | Webhook Тильды → заказ в Ozon |
| HEAD/GET | `/v1/order/webhook` | Проверка доступности          |

### Админ `/v1` _(dev)_

| Метод | Путь                    | Описание                 |
| ----- | ----------------------- | ------------------------ |
| POST  | `/v1/admin/sku-mapping` | Маппинг Tilda → Ozon SKU |
| GET   | `/v1/admin/sku-mapping` | Просмотр маппингов       |
| GET   | `/v1/admin/orders`      | История заказов          |

## Flow

```
Покупатель на Тильде
  ├─ Проверка телефона → /v1/delivery/check
  ├─ Выбор ПВЗ или ввод адреса курьера
  ├─ Расчёт цены → /v1/delivery/price | /courier/price
  └─ Оплата → Тильда webhook → /v1/order/webhook
       → парсинг адреса → checkout → создание заказа в Ozon
```

**ПВЗ**: покупатель выбирает точку на карте → `map_point_id`
**Курьер**: ввод адреса → геокодирование → парсинг (город, улица, дом, квартира, подъезд, этаж)

## Отказоустойчивость

- 401 → автоматический refresh токена → повтор запроса
- Если refresh не удался → запрос на диск → повтор после авторизации
- Email-алерты при критических ошибках (с дебаунсом)
- Rate limiting: 10 req/s к Ozon API

## Кеш ПВЗ

- ~5000 точек в SQLite + FTS5 (полнотекстовый поиск)
- Автообновление каждый день в 14:00
- Батч-загрузка по 100 точек

## Деплой

```bash
pm2 start ecosystem.config.js
pm2 restart ozon-app
```

Для портов < 1024:

```bash
sudo setcap 'cap_net_bind_service=+ep' $(which bun)
```

## Скрипты

```bash
bun run dev              # Dev с hot reload
bun run db:drop          # Удалить БД
bun run db:rebuild-fts   # Пересобрать FTS-индекс
```
