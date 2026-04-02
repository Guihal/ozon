# Code Map: tdelivery.js

## Module Overview

Файл tdelivery.js (9407 строк) — скомпилированный Babel-бандл модуля **доставки** платформы Tilda. Ядром является объект `tcart_newDelivery` (~3300 строк), реализующий полный цикл оформления доставки: геолокация, автокомплит адресов через API, интеграция с Яндекс Картами, расчёт стоимости, выбор пунктов выдачи, сохранение/восстановление адресов. ~40% файла занимают Babel runtime helpers.

---

## Top-level Inventory

### IIFE / Модули

| Type | Name | Line |
|------|------|------|
| IIFE | `t_cart__useRootZone` | 1 |
| IIFE (enum) | `TCartServerLocation` | 20 |
| IIFE | `t_store__useTranslation` | 4457 |
| IIFE (class) | `DeliveryAvailableCountries` | 5147 |
| IIFE (object) | `tcart_newDelivery` | 5268 |
| IIFE (class) | `TCartSelect` | 9294 |

### Классы

| Name | Line |
|------|------|
| `DeliveryAvailableCountries` (Singleton) | 5147–5267 |
| `TCartSelect` (кастомный dropdown) | 9294–9407 |

### Основные переменные

| Name | Line |
|------|------|
| `parseResponse` | 3883 |
| `fetchWithRedirectHandling` | 3908 |
| `t_store__fetchApiData` | 3927 |
| `t_store__fetchData` | 3957 |
| `RequestDataFormat` | 4017 |
| `ResponseDataFormat` | 4024 |
| `t_cart__loadLastDeliveries` | 4125 |
| `enTranslation` + компоненты | 4166–4232 |
| `ruTranslation` + компоненты | 4273–4339 |
| `TCART_TRANSLATION_*`, `T_CART_*` | 4370–4400 |
| `T_CART_PRELOADED_LANGS` | 4401 |
| `t_cart__loadLkpSettings` | 4534 |
| `t_cart__loadProductsInfoById` | 4572 |
| `t_cart__loadProductsPrices` | 4625 |
| `LS_ERROR_TEXT` | 4652 |
| `t_cart__loadLastOrderFields` | 4773 |
| `T_STORE_USE_EXTERNAL_FUNCTION_TIMEOUT` | 4833 |
| `t_store__useExternalCSSFile` | 4835 |
| `t_store__useExternalJsFile` | 4872 |
| `t_cart__loadMembersSettings` | 4896 |
| `t_cart__loadDiscountsScript` | 5034 |
| `DISCOUNTS_FILE_NAME` … константы | 5046–5054 |
| `t_catalog__getStaticHost` | 5061 |
| `t_cart__loadСountryСodes` | 5107 |
| `DeliveryAvailableCountries` | 5147 |
| `tcart_newDelivery` | 5268 |
| `TCartSelect` | 9294 |

### Основные функции

| Name | Line |
|------|------|
| `t_cart__getServerName` | 24 |
| `t_cart__getServer2Name` | 28 |
| `t_cart__getStoreEndpointUrl` | 3853 |
| `t_cart__getStore2EndpointUrl` | 3857 |
| `determineContentType` | 4031 |
| `getQueryString` | 4045 |
| `handleRootzoneRedirect` | 4064 |
| `t_cart__getMauser` | 4093 |
| `t_cart__getMembersToken` | 4104 |
| `t_cart__createProductInfoResponseStub` | 4565 |
| `t_cart__checkProduct` | 4622 |
| `t_cart__loadCartData` | 4654 |
| `t_cart__getDataFromLS` | 4660 |
| `t_cart__saveCartDataToLS` | 4668 |
| `t_cart__createDefaultCartData` | 4684 |
| `t_cart__isCartExpired` | 4702 |
| `t_cart__cleanCartProducts` | 4715 |
| `t_cart__getPageSettings` | 4729 |
| `t_cart__applyPageSettings` | 4747 |
| `t_cart__createTimestamp` | 4762 |
| `t_cart__loadDiscountsHook` | 4940 |
| `t_cart__loadDeliveryAssets` | 5064 |
| `t_cart__loadRestoreFieldsScript` | 5074 |
| `t_cart__loadLostCartStyles` | 5081 |
| `t_cart__loadFullscreenStyles` | 5087 |
| `t_cart__loadWidgetPositionsScript` | 5093 |
| `t_delivery__dict` | 8575 |
| `t_delivery__declensionOfNumber` | 9094 |
| `t_delivery__showPrice` | 9099 |
| `t_delivery__getDeliveryInputByKey` | 9118 |
| `t_triggerEvent` | 9134 |
| `t_delivery__replaceUnicode` | 9138 |
| `t_delivery__loadJSFile` | 9157 |
| `t_delivery__getRootZone` | 9170 |

### Глобальные объекты, записываемые в `window`

| Name | Line |
|------|------|
| `window.tcart__errorHandler` | 9174 |
| `window.tcart__inputErrorHandler` | 9199 |
| `window.t_delivery__autocompleteFields` | 9212 |
| `window.t_delivery__lang` | 9231 |
| `window.tcart__preloader` | 9246 |
| `window.tcart__chosePointOnMap` | ~6080 |
| `window.tcart_newDeliveryActive` | 5314 |
| `window.t_delivery__map` | ~5974 |

### Babel runtime helpers (~130 функций, строки 32–3852)

`_OverloadYield`, `_applyDecoratedDescriptor`, `_applyDecs2311`, `_regeneratorRuntime`, `_classCallCheck`, `_createClass`, `_extends`, `_objectSpread2`, `_wrapRegExp`, `_dispose`, `_using`, и др.

---

## Groups

### 🌐 Сетевая инфраструктура и API
**Responsibility:** HTTP-запросы к Tilda Store API, управление серверными URL, обработка редиректов между TLD-зонами, парсинг ответов.

**Contains:** `t_cart__getServerName`, `t_cart__getServer2Name`, `t_cart__getStoreEndpointUrl`, `t_cart__getStore2EndpointUrl`, `parseResponse`, `fetchWithRedirectHandling`, `t_store__fetchApiData`, `t_store__fetchData`, `determineContentType`, `getQueryString`, `handleRootzoneRedirect`, `RequestDataFormat`, `ResponseDataFormat`

**Dependencies:** DOM (`data-tilda-root-zone`), `fetch` API
**Side effects:** Сеть (HTTP), globals (`window`)

---

### 🌍 Переводы / i18n
**Responsibility:** Локализация интерфейса доставки на 13+ языков.

**Contains:** `t_store__useTranslation`, `t_delivery__dict`, `enTranslation`, `ruTranslation`, `T_CART_PRELOADED_LANGS`, константы перевода

**Dependencies:** Сетевой слой (CDN)
**Side effects:** Сеть (загрузка переводов)

---

### 💾 Данные корзины (общие утилиты)
**Responsibility:** Общие для корзины и доставки утилиты работы с localStorage и данными.

**Contains:** `t_cart__loadCartData`, `t_cart__getDataFromLS`, `t_cart__saveCartDataToLS`, `t_cart__createDefaultCartData`, `t_cart__isCartExpired`, `t_cart__cleanCartProducts`, `t_cart__getPageSettings`, `t_cart__applyPageSettings`, `t_cart__createTimestamp`, `t_cart__loadLkpSettings`, `t_cart__loadProductsInfoById`, `t_cart__loadProductsPrices`, `t_cart__loadLastOrderFields`, `t_cart__loadLastDeliveries`

**Dependencies:** API, localStorage, DOM
**Side effects:** localStorage, globals (`window.tcart`)

---

### 📦 Ядро доставки — `tcart_newDelivery`
**Responsibility:** Полный движок доставки: геолокация, автокомплит адресов, Яндекс Карты, расчёт стоимости, пункты выдачи, сохранение адресов.

**Contains:** объект `tcart_newDelivery` с методами:

- **Инициализация:** `init`, `updateProjectId`
- **Город:** `setCityState`, `setCityInput`, `getCityFromGeo`, `getCityFromGeoWithFailHandler`, `getCityCoordinates`
- **Восстановление:** `restoreFromLastOrder`, `restoreFromLS`, `restoreTcartDelivery`, `saveDelivery`, `saveTcartDelivery`, `renderSavedAddressesSelect`
- **API:** `getServices`, `getPayTypes`, `getPickupList`, `getDeliveryPrice`, `getAddresses`, `changeEndpoint`, `updateDeliveryPrice`
- **UI:** `renderRegionFields`, `renderAddressFields`, `renderServices`, `renderFullAddressNode`, `createInput`, `createRadio`, `createTitle`, `createSelect`, `createSearchbox`, `fillSearchList`, `setPostalCodeInput`, `setHashInput`, `setFullAddress`, `getFullAddress`, `getFullAddressHtml`
- **Яндекс Карты:** `mapAppendScript`, `mapInit`, `mapAddPoints`
- **Searchbox:** `searchboxInit`, `clickSearchboxInputHandler`, `changeSearchboxInputHandler`, `choseSearchListItemHandler`, `focusoutSearchboxInputHandler`
- **События:** `changeDeliveryTypeListener`, `changeCartInputsHandler`, `onAddressChange`, `changePickupHandler`, `hidePaymentMethod`
- **Утилиты:** `getInputFields`, `getInputValues`, `hideFieldsErrors`, `disableChoseServiceControls`, `enableChoseServiceControls`, `clearDeliveryFields`, `clearHouseInput`, `clearAddressSelect`, `updateTotal`, `showPickupInfo`, `hidePickupInfo`

**Dependencies:** API (geoservice, delivery endpoints), Яндекс Карты API, localStorage, DOM, `DeliveryAvailableCountries`, `TCartSelect`
**Side effects:** DOM (массовое создание элементов), сеть (API геолокации, доставки, Яндекс Карты), localStorage, sessionStorage, globals (`window.t_delivery__map`, `window.tcart__chosePointOnMap`, `window.tcart_newDeliveryActive`, `window.savedAddressesSelect`), timers (debounce на searchbox)

---

### 🗺 DeliveryAvailableCountries (Singleton)
**Responsibility:** Кеширование и проверка доступных стран доставки с TTL 24 часа.

**Contains:** `DeliveryAvailableCountries` — `getInstance()`, `onStateChange()`, `checkAvailableCountries()`, геттер `state`

**Dependencies:** API (загрузка стран), localStorage
**Side effects:** localStorage (кеш стран), сеть (API-запрос при отсутствии кеша)

---

### 🎨 UI-компоненты
**Responsibility:** Кастомные UI-элементы для доставки.

**Contains:** `TCartSelect` (кастомный dropdown select: `init`, `setValue`, `getValue`, `onChange`, `openDropdown`, `closeDropdown`)

**Dependencies:** DOM
**Side effects:** DOM (создание/модификация элементов), event listeners

---

### 🔧 Утилиты
**Responsibility:** Общие вспомогательные функции для модуля доставки.

**Contains:** `t_delivery__declensionOfNumber`, `t_delivery__showPrice`, `t_delivery__getDeliveryInputByKey`, `t_triggerEvent`, `t_delivery__replaceUnicode`, `t_delivery__loadJSFile`, `t_delivery__getRootZone`

**Dependencies:** нет внешних
**Side effects:** DOM (динамическая загрузка JS через `t_delivery__loadJSFile`)

---

### 🔧 Обработчики ошибок и автокомплит (window globals)
**Responsibility:** Экспорт в глобальную область видимости для использования внешними модулями.

**Contains:** `window.tcart__errorHandler`, `window.tcart__inputErrorHandler`, `window.t_delivery__autocompleteFields`, `window.t_delivery__lang`, `window.tcart__preloader`

**Dependencies:** DOM
**Side effects:** globals (`window.*`), DOM (отображение/скрытие ошибок)

---

## ⚠️ Unclear / Needs Review

1. **`tcart_newDelivery` (~3300 строк)** — гигантский монолитный объект. Детальная трассировка всех ~60 методов не выполнена; точная последовательность вызовов при `init()` требует пошагового анализа.
2. **`t_delivery__dict` (~500 строк)** — словарь на 13+ языков; точный список ключей и языков не полностью инвентаризирован.
3. **`window.window.tcart__inputErrorHandler`** — двойной `window.window`, вероятно баг минификации.
4. **Опечатка**: `t_cart__loadСountryСodes` — кириллические «С» вместо латинских «C».
5. **Жёстко закодированные URL**: `delivery.tildacdn.com`, `geoserv{zone}/api/`, `geocode-maps.yandex.ru` — эндпоинты доставки.
6. **Язык по умолчанию**: определяется через `window.t_delivery__browserLang` — должен быть установлен до загрузки скрипта; при отсутствии — поведение неясно.
7. **Кеширование в sessionStorage**: гео-запросы кешируются с префиксом `"t"` — точный формат ключа и TTL неясны.
8. **Взаимозависимость файлов**: tcart.js и tdelivery.js дублируют значительную часть кода (Babel helpers, сетевой слой, утилиты корзины). Неясно, загружаются ли они оба одновременно или взаимоисключающе.
