# Tilda Cart/Delivery — Карта событий, методов и функций

## Архитектура

- `tcart.js` — корзина (t706 блок), продукты, UI, оплата
- `tdelivery.js` — модуль доставки (сервисы, город, ПВЗ, адрес)
- `front/src/` — наш патч для Ozon Logistics

---

## 1. ГЛОБАЛЬНЫЕ ОБЪЕКТЫ

### `window.tcart` — состояние корзины

- `.products[]` — массив товаров в корзине
- `.prodamount` — сумма товаров
- `.amount` — итоговая сумма (с доставкой)
- `.delivery` — данные доставки (город, улица, pickup-id и т.д.)
- `.currency_txt_l` / `.currency_txt_r` — символ валюты
- `.promocode` — объект промокода

### `window.tcart_newDelivery` (= `tcart_newDelivery`) — модуль доставки

- `.deliveryState` — полное состояние:
  - `.city` — выбранный город
  - `.services` — доступные сервисы доставки
  - `.activeServiceUid` — выбранный сервис
  - `.cityCoordinates` — координаты города
  - `.ymapApiKey` — API ключ Яндекс.Карт
  - `.pickupList` — список ПВЗ
  - `.postalCode` — индекс
  - `.freeDeliveryThreshold` — порог бесплатной доставки
  - `.searchboxes` — поисковые боксы
  - `.focusoutTimers` — таймеры фокуса
  - `.isSavedAddressSelected` — выбран ли сохранённый адрес
- `.deliveryKeys[]` — ключи полей доставки (city, street, house, etc.)

### `window.tcart__errorHandler` — показ/скрытие ошибок формы

- `.show(message)` — показать ошибку в `.js-errorbox-all`
- `.hide()` — скрыть все ошибки

### `window.tcart__inputErrorHandler` — ошибки конкретных полей

- `.show(inputEl, message)` — ошибка на поле
- `.hide(inputEl)` — скрыть ошибку поля

### `window.tcart__preloader` — спиннер загрузки

- `.show(parentEl, text?)` — показать в `#customdelivery`
- `.hide()` — скрыть

### `window.t_delivery__autocompleteFields` — автокомплит

- `.keys[]` — ключи полей (street, house, floor, etc.)
- `.clearState()` — очистить автокомплит

### `window.t_delivery__lang` — язык доставки

- `.lang` (getter/setter) — текущий язык
- `.clearLang()` — сбросить язык

### Прочие globals:

- `window.tcart__ymapApiKey` — ключ Яндекс.Карт
- `window.tcart_sendevent_onadd` — "y" если нужны GA-события
- `window.tcart_fullscreen` — полноэкранная корзина
- `window.tcart_newDeliveryActive` — флаг активности нового модуля доставки
- `window.tcartAuthState` — состояние авторизации members
- `window.t_delivery__map` — инстанс Яндекс.Карты
- `window.savedAddressesSelect` — TCartSelect сохранённых адресов
- `window.tcart__quantityProductsByUid` — кол-во товаров по uid

---

## 2. LIFECYCLE — ИНИЦИАЛИЗАЦИЯ

```
t_onReady → tcart_init:
  ├── tcart__loadLocalObj()           // загрузить корзину из localStorage
  ├── tcart__reDrawCartIcon()         // рисование иконки корзины
  ├── tcart__addEvent__links()        // обработчики кнопок "Купить"
  ├── tcart__addEvents()              // все обработчики UI
  ├── tcart__updateMinimals()         // минимальные суммы
  ├── tcart__loadDiscounts()          // загрузка скидок
  ├── tcart__addEvent__selectpayment() // выбор способа оплаты
  ├── tcart__drawBottomTotalAmount()  // итоговая сумма внизу
  └── tcart__getLostCart()            // восстановление потерянной корзины

На открытие корзины (tcart__openCart):
  ├── tcart__syncProductsObject__LStoObj()
  ├── tcart__updateProductsPrice()
  ├── tcart__reDrawProducts()
  ├── tcart__reDrawTotal()
  └── tcart__initAuthAndDelivery()
       ├── tcart__auth__init()         // авторизация members
       └── tcart__initDelivery()       // ← ТОЧКА ВХОДА ДОСТАВКИ
            └── tcart_newDelivery.init(ymapApiKey)
                 ├── renderRegionFields()
                 ├── renderServices()
                 └── tcart__updateDelivery()
```

---

## 3. КОРЗИНА — КЛЮЧЕВЫЕ ФУНКЦИИ (tcart.js)

### Данные / LocalStorage

| Функция                                | Описание                                       |
| -------------------------------------- | ---------------------------------------------- |
| `tcart__loadLocalObj()`                | Загрузить корзину из LS → `window.tcart`       |
| `tcart__saveLocalObj()`                | Сохранить корзину в LS + перерисовать доставку |
| `tcart__syncProductsObject__LStoObj()` | Синхронизация LS → объект                      |
| `t_cart__loadCartData()`               | Загрузить данные корзины                       |
| `t_cart__getDataFromLS()`              | Прочитать из localStorage                      |
| `t_cart__saveCartDataToLS(data)`       | Записать в localStorage                        |
| `t_cart__createDefaultCartData()`      | Дефолтный объект корзины                       |
| `t_cart__isCartExpired(data)`          | Проверка срока жизни                           |
| `t_cart__cleanCartProducts(products)`  | Очистка невалидных товаров                     |

### Товары

| Функция                               | Описание                 |
| ------------------------------------- | ------------------------ |
| `tcart__addProduct(product)`          | Добавить товар в корзину |
| `tcart__product__plus(el)`            | +1 количество            |
| `tcart__product__minus(el)`           | -1 количество            |
| `tcart__product__del(el)`             | Удалить товар            |
| `tcart__product__editquantity(el)`    | Ввод количества вручную  |
| `tcart__product__updateQuantity(...)` | Обновление количества    |
| `tcart__delZeroquantity_inCartObj()`  | Удалить товары с qty=0   |
| `tcart__updateProductsPrice(force?)`  | Обновить цены с сервера  |

### Отрисовка UI

| Функция                                 | Описание                    |
| --------------------------------------- | --------------------------- |
| `tcart__reDrawProducts()`               | Перерисовать список товаров |
| `tcart__reDrawTotal()`                  | Перерисовать итог           |
| `tcart__reDrawCartIcon()`               | Обновить значок корзины     |
| `tcart__drawBottomTotalAmount()`        | Нижний блок суммы           |
| `tcart__drawTotalAmountInfo(...)`       | Инфо об итоговой сумме      |
| `tcart__toggleTotalAmountVisibility()`  | Показать/скрыть итог        |
| `tcart__toggleProdAmountVisibility(el)` | Показать/скрыть подитог     |
| `tcart__changeSubmitStatus()`           | Обновить статус кнопки      |
| `tcart__showBubble(text)`               | Всплывающее уведомление     |
| `tcart__closeBubble(el)`                | Закрыть bubble              |
| `tcart__updateLazyload()`               | Обновить lazyload картинок  |

### Корзина — открытие/закрытие

| Функция                           | Описание              |
| --------------------------------- | --------------------- |
| `tcart__openCart(silent?)`        | Открыть корзину       |
| `tcart__closeCart()`              | Закрыть корзину       |
| `tcart__openCartFullscreen()`     | Открыть полноэкранную |
| `tcart__closeCartFullscreen()`    | Закрыть полноэкранную |
| `tcart__openCartSidebar(silent?)` | Открыть сайдбар       |
| `tcart__closeCartSidebar()`       | Закрыть сайдбар       |
| `tcart__lockScroll()`             | Заблокировать скролл  |
| `tcart__unlockScroll()`           | Разблокировать скролл |

### Кнопка отправки

| Функция                                         | Описание                        |
| ----------------------------------------------- | ------------------------------- |
| `tcart__blockSubmitButton()`                    | Заблокировать кнопку "Оплатить" |
| `tcart__unblockSubmitButton()`                  | Разблокировать                  |
| `tcart__blockAndDelayUnblockSubmitOnResponse()` | Блок + авто-разблок             |
| `tcart__blockCartUI()`                          | Заблокировать весь UI корзины   |
| `tcart__unblockCartUI()`                        | Разблокировать UI               |
| `tcart__handleSubmitButton()`                   | Настройка обработчиков сабмита  |

### Форма

| Функция                                   | Описание                   |
| ----------------------------------------- | -------------------------- |
| `tcart__form__getForm()`                  | Получить элемент формы     |
| `tcart__form__getDeliveryWrapper()`       | Получить обёртку доставки  |
| `tcart__form__isDeliveryServicesActive()` | Есть ли сервисы доставки   |
| `tcart__form__getFields()`                | Все поля формы             |
| `tcart__form__disableFormFields()`        | Заблокировать поля         |
| `tcart__form__hideFormFields()`           | Скрыть поля                |
| `tcart__form__showFormFields()`           | Показать поля              |
| `tcart__form__hideErrors()`               | Скрыть ошибки формы        |
| `tcart__form__insertValidateRule(rule)`   | Добавить правило валидации |

### Доставка (из tcart.js)

| Функция                                            | Описание                                               |
| -------------------------------------------------- | ------------------------------------------------------ |
| `tcart__initDelivery()`                            | Инициализировать доставку → `tcart_newDelivery.init()` |
| `tcart__addDelivery()`                             | Добавить стоимость доставки к итогу                    |
| `tcart__updateDelivery()`                          | Обновить доставку при изменении корзины                |
| `tcart__processDelivery(service)`                  | Обработать выбранный сервис                            |
| `tcart__setFreeDeliveryThreshold()`                | Установить порог бесплатной доставки                   |
| `tcart__hideDeliveryPrice()` _(tdelivery)_         | Скрыть цену доставки                                   |
| `tcart__showDeliveryPrice()` _(tdelivery)_         | Показать цену доставки                                 |
| `tcart__mapDeliveryService(service)` _(tdelivery)_ | Маппинг сервиса                                        |
| `tcart__rerenderDeliveryServices()` _(tdelivery)_  | Перерисовать сервисы                                   |

### Промокод / Скидки

| Функция                                 | Описание                      |
| --------------------------------------- | ----------------------------- |
| `tcart__calcPromocode(amount)`          | Рассчитать промокод           |
| `tcart__addDiscountInfo()`              | Добавить информацию о скидках |
| `tcart__updateTotalProductsinCartObj()` | Пересчитать итого в объекте   |

### Авторизация (Members)

| Функция                                 | Описание                  |
| --------------------------------------- | ------------------------- |
| `tcart__auth__init()`                   | Инициализация авторизации |
| `tcart__auth__getMauser()`              | Получить маузер токен     |
| `tcart__auth__getMauserFromLS()`        | Маузер из localStorage    |
| `tcart__auth__getMembersSettings()`     | Настройки members         |
| `tcart__auth__getUserFields()`          | Поля пользователя         |
| `tcart__auth__fillUserFields(data)`     | Заполнить поля юзера      |
| `tcart__auth__clearUserFields()`        | Очистить поля юзера       |
| `tcart__auth__onMembersLogout()`        | Обработчик выхода         |
| `tcart__auth__insertAuthEl(el)`         | Вставить блок авторизации |
| `tcart__auth__createAuthEl(...)`        | Создать блок авторизации  |
| `tcart__auth__createLoggedInEl(mauser)` | Блок "Вы авторизованы"    |

### Утилиты

| Функция                           | Описание                   |
| --------------------------------- | -------------------------- |
| `tcart__showPrice(amount, opts?)` | Форматировать цену         |
| `tcart__cleanPrice(str)`          | Очистить строку цены       |
| `tcart__roundPrice(num)`          | Округлить цену             |
| `tcart__escapeHtml(str)`          | Экранировать HTML          |
| `tcart__escapeHtmlImg(str)`       | Экранировать HTML img      |
| `tcart__showWeight(weight, unit)` | Отобразить вес             |
| `tcart__isEmptyObject(obj)`       | Проверка пустого объекта   |
| `tcart__debounce(fn, ms)`         | Дебаунс                    |
| `tcart__onFuncLoad(name, cb)`     | Дождаться загрузки функции |
| `tcart__decodeHtml(str)`          | Декодировать HTML-сущности |
| `t_triggerEvent(el, eventName)`   | Вызвать нативное событие   |

### Callback

| Функция                    | Описание                               |
| -------------------------- | -------------------------------------- |
| `t706_onSuccessCallback()` | После успешной оплаты — скрыть корзину |
| `t706_slideUp(el, ms)`     | Анимация скрытия                       |

---

## 4. ДОСТАВКА — КЛЮЧЕВЫЕ МЕТОДЫ (tdelivery.js → `tcart_newDelivery`)

### Инициализация

| Метод                              | Описание                          |
| ---------------------------------- | --------------------------------- |
| `.init(ymapApiKey)`                | Полная инициализация доставки     |
| `.updateProjectId()`               | Обновить projectId                |
| `.restoreFromLastOrder()`          | Восстановить из последнего заказа |
| `.restoreFromLS()`                 | Восстановить из LS                |
| `.getCityFromGeoWithFailHandler()` | Определить город по геолокации    |

### Город / Регион

| Метод                       | Описание                 |
| --------------------------- | ------------------------ |
| `.setCityState(cityData)`   | Установить город в state |
| `.setCityInput(name)`       | Установить город в input |
| `.setPostalCodeInput(code)` | Установить индекс        |
| `.renderRegionFields()`     | Отрисовать поля региона  |

### Сервисы доставки

| Метод                                          | Описание                        |
| ---------------------------------------------- | ------------------------------- |
| `.renderServices(callback?)`                   | Отрисовать все сервисы доставки |
| `.changeDeliveryTypeListener()`                | Слушатель смены типа доставки   |
| `.updateDeliveryPrice(postalCode, serviceUid)` | Обновить цену доставки          |
| `.calcDeliveryPrices(...)`                     | Рассчитать цены                 |

### ПВЗ / Pickup

| Метод                                             | Описание                  |
| ------------------------------------------------- | ------------------------- |
| `.changePickupHandler(id, name, code, box, addr)` | Обработчик выбора ПВЗ     |
| `.showPickupInfo(id, box)`                        | Показать информацию о ПВЗ |

### Адрес

| Метод                    | Описание                         |
| ------------------------ | -------------------------------- |
| `.getInputFields()`      | Получить все input-поля доставки |
| `.getInputValues()`      | Получить значения полей          |
| `.getFullAddress()`      | Полный адрес строкой             |
| `.onAddressChange(e)`    | Обработчик изменения адреса      |
| `.clearAddressSelect()`  | Сбросить сохранённый адрес       |
| `.clearDeliveryFields()` | Очистить поля доставки           |

### Сохранение / Восстановление

| Метод                        | Описание                                     |
| ---------------------------- | -------------------------------------------- |
| `.saveTcartDelivery()`       | Сохранить доставку в `window.tcart.delivery` |
| `.restoreTcartDelivery()`    | Восстановить доставку                        |
| `.changeCartInputsHandler()` | Повесить change listeners на все inputs      |

### Карта

| Метод                         | Описание                |
| ----------------------------- | ----------------------- |
| `.mapAppendScript(_, apikey)` | Подключить Яндекс.Карты |
| `.mapInit(type)`              | Инициализировать карту  |

### UI

| Метод                            | Описание                    |
| -------------------------------- | --------------------------- |
| `.disableChoseServiceControls()` | Отключить radio сервисов    |
| `.enableChoseServiceControls()`  | Включить radio сервисов     |
| `.hideFieldsErrors()`            | Скрыть ошибки полей         |
| `.renderFullAddressNode()`       | Создать блок полного адреса |
| `.setFullAddress(text)`          | Установить полный адрес     |
| `.createTitle(text)`             | Создать заголовок секции    |

### Сохранённые адреса

| Метод                                     | Описание                       |
| ----------------------------------------- | ------------------------------ |
| `.renderSavedAddresses(addresses)`        | Отрисовать сохранённые адреса  |
| `.showSavedAddressesUnavailableMessage()` | Предупреждение о недоступности |
| `.hideSavedAddressesUnavailableMessage()` | Убрать предупреждение          |
| `.getFullAddressHtml(addr)`               | HTML сохранённого адреса       |
| `.saveDelivery(addr)`                     | Сохранить выбранный адрес      |

### Утилиты (tdelivery.js)

| Функция                                  | Описание                |
| ---------------------------------------- | ----------------------- |
| `t_delivery__dict(key)`                  | Перевод строки          |
| `t_delivery__showPrice(amount)`          | Форматировать цену      |
| `t_delivery__getDeliveryInputByKey(key)` | Получить input по имени |
| `t_delivery__replaceUnicode(str)`        | Заменить unicode        |
| `t_delivery__loadJSFile(url)`            | Загрузить JS файл       |
| `t_delivery__getRootZone()`              | Получить root zone      |
| `t_delivery__declensionOfNumber(num)`    | Склонение числительных  |

---

## 5. СОБЫТИЯ

### DOM Events (addEventListener)

| Событие                     | Элемент                            | Описание                                              |
| --------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `tildaform:beforesend`      | form                               | Перед отправкой формы → `tcart__saveFieldsOnCheckout` |
| `tildaform:afterformsubmit` | form                               | После отправки → блок/разблок кнопки                  |
| `tildaform:aftererror`      | form                               | После ошибки формы                                    |
| `keyup`                     | document                           | ESC → закрыть корзину (`tcart__keyUpFunc`)            |
| `pageshow`                  | window                             | Восстановление из bfcache → перезагрузка корзины      |
| `membersLogout`             | document                           | Выход пользователя → очистка формы                    |
| `change`                    | input fields                       | Изменение полей → `saveTcartDelivery()`               |
| `input`                     | delivery inputs                    | Изменение адреса → `onAddressChange()`                |
| `click`                     | `.t706__cartwin-close`             | Закрыть корзину                                       |
| `click`                     | `.t706__product-plus`              | + количество                                          |
| `click`                     | `.t706__product-minus`             | - количество                                          |
| `click`                     | `.t706__product-del`               | Удалить товар                                         |
| `click`                     | `input[name="tildadelivery-type"]` | Выбор сервиса доставки                                |
| `click`                     | `.searchbox-change-pickup`         | Сменить ПВЗ                                           |

### Custom Events (нативные)

| Событие                    | Описание                                          |
| -------------------------- | ------------------------------------------------- |
| `membersLogout`            | Выход из members → `tcart__auth__onMembersLogout` |
| `t_triggerEvent(el, name)` | Утилита для нативных событий                      |

---

## 6. CSS СЕЛЕКТОРЫ — КЛЮЧЕВЫЕ

| Селектор                          | Описание                                     |
| --------------------------------- | -------------------------------------------- |
| `.t706`                           | Корневой контейнер корзины                   |
| `.t706__cartwin`                  | Окно корзины                                 |
| `.t706__cartwin_showed`           | Видимое окно                                 |
| `.t706__cartwin-products`         | Список товаров                               |
| `.t706__product`                  | Один товар                                   |
| `.t706__product-quantity`         | Количество товара                            |
| `.t706__cartwin-prodamount`       | Подитог                                      |
| `.t706__cartwin-totalamount-wrap` | Обёртка итоговой суммы                       |
| `.t706__cartwin-totalamount-info` | Инфо о стоимости                             |
| `.t706__orderform`                | Форма заказа                                 |
| `.t-form__submit`                 | Кнопка отправки                              |
| `.t-radio__wrapper-delivery`      | Обёртка сервисов доставки                    |
| `#customdelivery`                 | Контейнер сервисов (назначается динамически) |
| `.js-errorbox-all`                | Блок ошибок формы                            |
| `.js-rule-error-string`           | Текст ошибки                                 |
| `.t-input-group_dl`               | Группа поля "Доставка"                       |
| `.searchbox-wrapper`              | Обёртка поискового бокса                     |
| `.searchbox-input`                | Input поиска                                 |
| `.tcart__preloader`               | Спиннер загрузки                             |
| `.tcart-select`                   | Кастомный select (TCartSelect)               |

---

## 7. НАШ ПАТЧ (front/src/) — ТОЧКИ ВМЕШАТЕЛЬСТВА

### Что патчим:

1. **`patchPickupHandler`** — перехват выбора ПВЗ
2. **`patchSearchHandler`** — перехват поиска ПВЗ по тексту
3. **`patchGetPickupList`** — заглушка стандартного списка ПВЗ
4. **`patchMapInit`** — патч инициализации карты (наши ПВЗ)
5. **`initPhoneListeners`** — проверка телефона через Ozon API
6. **`initCourier`** — курьерская доставка с геокодированием
7. **`initCartPolling`** — поллинг изменений корзины

### Используемые глобальные API:

- `window.tcart_newDelivery` — для патчей методов доставки
- `window.tcart__errorHandler.show/hide` — показ ошибок
- `window.tcart__blockSubmitButton()` — блокировка кнопки
- `window.tcart__unblockSubmitButton()` — разблокировка кнопки
- `window.tcart.products` — список товаров (для SKU)
- `window.tcart.delivery` — данные доставки
- Hidden fields: `ozon_map_point_id`, `ozon_delivery_type`, `ozon_courier_lat`, `ozon_courier_lon`

### State Machine (ozonState):

```
phoneChecked + deliverySelected + checkoutPassed → unblock submit
Любое false → block submit + show error
```
