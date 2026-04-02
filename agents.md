# Ozon Logistics API - Документация для разработчиков

## Описание проекта

Backend API для интеграции с Ozon Seller API и Ozon Логистикой. Обеспечивает OAuth авторизацию, автоматическое управление токенами и работу с методами Ozon API.

## Технологический стек

- **Runtime**: Bun
- **Framework**: Elysia
- **Language**: TypeScript
- **Architecture**: Modular REST API

## Структура проекта

```
ozon/
├── src/
│   ├── config/
│   │   └── env.ts              # Конфигурация и переменные окружения
│   ├── modules/
│   │   ├── auth/
│   │   │   └── auth.ts         # OAuth авторизация
│   │   └── delivery/
│   │       └── delivery.ts     # Модуль доставки
│   ├── utils/
│   │   ├── getAccessToken.ts   # Управление OAuth токенами
│   │   └── htmlResponses.ts    # HTML шаблоны для OAuth
│   └── index.ts                # Точка входа
├── .env                        # Переменные окружения
├── package.json
└── tsconfig.json
```

## Архитектурные принципы

### 1. Модульность
- Каждый модуль в отдельной директории
- Модули регистрируются в index.ts через `.use()`
- Prefix для маршрутов модуля

### 2. Конфигурация
- Все настройки через переменные окружения
- Валидация обязательных переменных при старте
- Автоматическое определение IP и порта

### 3. Безопасность
- OAuth токены сохраняются в файл (не в БД)
- Автоматическое обновление токенов
- Dev-only endpoints защищены проверкой `isProd`

### 4. Обработка ошибок
- Логирование всех ошибок в консоль
- Возврат понятных сообщений клиенту
- HTML ответы для OAuth callback

## Система авторизации

### OAuth Flow

1. **Получение URL авторизации**
   ```
   GET /auth/url
   ```
   Возвращает URL для открытия в браузере.

2. **Callback обработка**
   ```
   GET /auth/callback?code=...&state=...
   ```
   Автоматически обменивает code на токен.

3. **Автоматическое обновление**
   - Токен обновляется за 24 часа до истечения
   - При перезапуске токен загружается из файла
   - Таймер восстанавливается автоматически

4. **Токен передается в заголовках в модуле Delivery: Authorization: Bearer ACCESS_TOKEN**
### Управление токенами

- **Хранение**: `ozon_token.json` в директории utils
- **Автообновление**: setTimeout за 24 часа до истечения
- **Dev endpoints**: `/auth/status`, `/auth/reset`, `/auth/refresh`

## Переменные окружения

### Обязательные
```env
OZON_LOGISTICS_CLIENT_ID=your_client_id
OZON_LOGISTICS_CLIENT_SECRET=your_client_secret
```

### Опциональные
```env
OZON_LOGISTICS_API_URL=https://api-seller.ozon.ru
OZON_LOGISTICS_AUTH_URL=https://api-seller.ozon.ru
OZON_LOGISTICS_REDIRECT_URI=http://YOUR_IP:PORT/auth/callback
OZON_LOGISTICS_IS_PROD=false
OZON_LOGISTICS_TIMEOUT=10000
PORT=3000
```

### Автоматическое определение
- Если `OZON_LOGISTICS_REDIRECT_URI` не задан, формируется автоматически
- IP определяется из сетевых интерфейсов
- Порт берётся из переменной `PORT`

## Правила разработки

### Код-стайл

1. **TypeScript**
   - Строгая типизация
   - Интерфейсы для всех структур данных
   - Экспорт типов через `export type`

2. **Функции**
   - JSDoc комментарии для публичных функций
   - Явные типы параметров и возвращаемых значений
   - Обработка ошибок через try-catch

3. **Модули**
   - Elysia instance с prefix
   - Чейнинг методов `.get()`, `.post()`
   - Валидация через `t.Object()`

### Логирование

```typescript
// Успешные операции
console.log("✅ Операция успешна");
console.log(`   Параметр: ${value}`);

// Ошибки
console.error("❌ Ошибка:", error);

// Информационные сообщения
console.log("🔄 Обмен code на токен...");
```

### Обработка ошибок

```typescript
try {
  // Операция
} catch (error) {
  console.error("❌ Описание:", error);
  return {
    success: false,
    error: error instanceof Error ? error.message : "Неизвестная ошибка",
  };
}
```

### HTML ответы

Использовать функции из `htmlResponses.ts`:
```typescript
const html = generateSuccessHTML({ expires_in, scope });
return createHTMLResponse(html);
```

Не встраивать HTML напрямую в код!

## API Endpoints

### Auth Module (`/auth`)

| Method | Path | Description | Mode |
|--------|------|-------------|------|
| GET | `/auth/url` | Получить URL авторизации | All |
| GET | `/auth/callback` | OAuth callback | All |
| GET | `/auth/status` | Статус токена | Dev only |
| POST | `/auth/reset` | Сброс токена | Dev only |
| POST | `/auth/refresh` | Обновление токена | Dev only |

### Delivery Module (`/delivery`)

Модуль для работы с доставкой Ozon.

### Root

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |

## Развертывание

### Development

```bash
# Установка зависимостей
bun install

# Запуск в dev режиме
bun run dev
```

### Production

```bash
# Установка зависимостей
bun install

# Запуск
bun run start
```

### Firewall

```bash
# Открыть порт
sudo ufw allow PORT/tcp
sudo ufw reload
```

### Привилегированные порты (< 1024)

Для портов < 1024 требуется:
```bash
# Вариант 1: Запуск с sudo
sudo bun run src/index.ts

# Вариант 2: capabilities (рекомендуется)
sudo setcap 'cap_net_bind_service=+ep' $(which bun)
```

## Тестирование

### Проверка авторизации

1. Открыть `http://YOUR_IP:PORT/auth/url`
2. Скопировать URL из ответа
3. Открыть в браузере
4. Авторизоваться в Ozon
5. Увидеть HTML страницу с результатом

### Проверка токена

```bash
curl http://YOUR_IP:PORT/auth/status
```

## Известные ограничения

1. **Ozon Redirect URI**
   - Требует двухзначный порт (< 100)
   - Для портов >= 100 нужен reverse proxy

2. **Firewall**
   - Порт должен быть открыт в UFW
   - Проверить NAT на роутере

3. **Mixed Content**
   - Браузер блокирует HTTP с HTTPS страниц
   - Решение: открыть callback URL напрямую

## Troubleshooting

### Токен не получен

1. Проверить логи сервера
2. Проверить `redirect_uri` в настройках Ozon
3. Проверить доступность сервера извне

### Порт недоступен

1. Проверить firewall: `sudo ufw status`
2. Проверить NAT на роутере
3. Проверить прослушивание: `ss -tlnp | grep :PORT`

### OAuth ошибки

1. `redirect_uri does not match` — проверить URL в настройках Ozon
2. `invalid_client` — проверить client_id и client_secret
3. `invalid_grant` — код авторизации истёк или использован

## Обновление токенов

### Автоматическое обновление

- Запускается при получении токена
- Обновляет за 24 часа до истечения
- Сохраняет новый токен в файл

### Ручное обновление (dev only)

```bash
POST /auth/refresh
```

## Безопасность

### Производственный режим

Установить `OZON_LOGISTICS_IS_PROD=true`:
- Отключаются dev-only endpoints
- Ограничивается доступ к управлению токенами

### Рекомендации

1. Не коммитить `.env` файл
2. Использовать HTTPS в production
3. Ограничить доступ к портам по IP
4. Регулярно обновлять client_secret

## Контакты и поддержка

При возникновении вопросов обращаться к документации Ozon API:
- https://docs.ozon.ru/sellers/
- https://seller.ozon.ru/app/appstore/
