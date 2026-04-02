# Code Map: tcart.js

## Module Overview

Файл tcart.js (9104 строки) — скомпилированный Babel-бандл модуля корзины покупок платформы **Tilda** (блок ST100 / t706). Содержит полный цикл работы корзины: инициализацию, управление товарами, скидки, промокоды, авторизацию через Members, восстановление потерянных корзин, отрисовку UI (иконка, sidebar, fullscreen), работу с формой заказа, доставку и сетевое взаимодействие с Tilda Store API. ~42% файла занимают Babel runtime helpers.

## Top-level Inventory

### IIFE / Модули

| Type        | Name                        | Line range |
| ----------- | --------------------------- | ---------- |
| IIFE        | `t_cart__useRootZone`       | 3836       |
| IIFE (enum) | `TCartServerLocation`       | 3854       |
| IIFE (enum) | `RequestDataFormat`         | 4043       |
| IIFE (enum) | `ResponseDataFormat`        | 4052       |
| IIFE        | `t_store__useTranslation`   | 4394       |
| IIFE        | `t_cart__loadDiscountsHook` | 4940       |

### Основные переменные

| Type | Name                                            | Line range |
| ---- | ----------------------------------------------- | ---------- |
| var  | `id`, `REACT_ELEMENT_TYPE`, `applyDecs2203Impl` | 436        |
| var  | `parseResponse`                                 | 3883       |
| var  | `fetchWithRedirectHandling`                     | 3919       |
| var  | `t_store__fetchApiData`                         | 3941       |
| var  | `t_store__fetchData`                            | 3975       |
| var  | `enTranslation` + компоненты                    | 4153–4275  |
| var  | `ruTranslation` + компоненты                    | 4276–4392  |
| var  | `TCART_TRANSLATION_*`, `T_CART_*`               | 4393–4420  |
| var  | `T_CART_PRELOADED_LANGS`                        | 4421       |
| var  | `t_cart__loadLkpSettings`                       | 4471       |
| var  | `t_cart__loadProductsInfoById`                  | 4509       |
| var  | `t_cart__loadProductsPrices`                    | 4562       |
| var  | `LS_ERROR_TEXT`                                 | 4616       |
| var  | `t_cart__loadLastOrderFields`                   | 4734       |
| var  | `t_cart__loadLastDeliveries`                    | 4782       |
| var  | `T_STORE_USE_EXTERNAL_FUNCTION_TIMEOUT`         | 4814       |
| var  | `t_store__useExternalFunction`                  | 4814       |
| var  | `t_store__useExternalCSSFile`                   | 4835       |
| var  | `t_store__useExternalJsFile`                    | 4845       |
| var  | `t_cart__loadMembersSettings`                   | 4896       |
| var  | `t_cart__loadDiscountsScript`                   | 5034       |
| var  | `DISCOUNTS_FILE_NAME` … константы               | 5055–5063  |
| var  | `t_catalog__getStaticHost`                      | 5063       |
| var  | `t_cart__loadСountryСodes`                      | 5107       |
| var  | `tcart__loadDiscounts`                          | 5147       |
| var  | `tcart__getProductsInfoById`                    | 5212       |
| var  | `tcart__updateProductsPrice`                    | 5265       |
| var  | `tcart__auth__getMembersSettings`               | 5383       |
| var  | `tcart__initAuthAndDelivery`                    | 5392       |
| var  | `tcart__init`                                   | 5480       |

### Основные функции (function declarations)

| Type     | Name                                          | Line range |
| -------- | --------------------------------------------- | ---------- |
| function | `t_cart__getServerName`                       | 3859       |
| function | `t_cart__getServer2Name`                      | 3863       |
| function | `t_cart__getStoreEndpointUrl`                 | 3867       |
| function | `t_cart__getStore2EndpointUrl`                | 3871       |
| function | `determineContentType`                        | 4062       |
| function | `getQueryString`                              | 4076       |
| function | `handleRootzoneRedirect`                      | 4100       |
| function | `t_cart__loadCartData`                        | 4602       |
| function | `t_cart__getDataFromLS`                       | 4608       |
| function | `t_cart__saveCartDataToLS`                    | 4616       |
| function | `t_cart__createDefaultCartData`               | 4632       |
| function | `t_cart__isCartExpired`                       | 4650       |
| function | `t_cart__cleanCartProducts`                   | 4663       |
| function | `t_cart__getPageSettings`                     | 4677       |
| function | `t_cart__applyPageSettings`                   | 4695       |
| function | `t_cart__createTimestamp`                     | 4710       |
| function | `t_cart__getMembersToken`                     | 4713       |
| function | `tcart__loadLocalObj`                         | 5876       |
| function | `tcart__saveLocalObj`                         | 5890       |
| function | `tcart__syncProductsObject__LStoObj`          | 5897       |
| function | `tcart__addEvents`                            | 5922       |
| function | `tcart__addEvent__links`                      | 6027       |
| function | `tcart__auth__init`                           | 6417       |
| function | `tcart__auth__createWrapEl`                   | 6473       |
| function | `tcart__auth__insertAuthEl`                   | 6477       |
| function | `tcart__auth__createAuthEl`                   | 6487       |
| function | `tcart__auth__createLoggedInEl`               | 6513       |
| function | `tcart__auth__onMembersLogout`                | 6556       |
| function | `tcart__auth__getMauser`                      | 6578       |
| function | `tcart__auth__getMauserFromLS`                | 6592       |
| function | `tcart__auth__getUserFields`                  | 6601       |
| function | `tcart__auth__fillUserFields`                 | 6655       |
| function | `tcart__auth__clearUserFields`                | 6670       |
| function | `tcart__addProduct`                           | 6679       |
| function | `tcart__updateMinimals`                       | 5813       |
| function | `tcart__nullObj`                              | 5804       |
| function | `tcart_dict`                                  | 5800       |
| function | `tcart__updateTotalProductsinCartObj`         | 6902       |
| function | `tcart__reDrawCartIcon`                       | 6955       |
| function | `tcart__shouldShowCartIcon`                   | 6993       |
| function | `tcart__openCart`                             | 7008       |
| function | `tcart__reDrawProducts`                       | 7041       |
| function | `tcart__lumaRgb`                              | 7187       |
| function | `tcart_isZeroBecauseOfDiscount`               | 7196       |
| function | `tcart__reDrawTotal`                          | 7203       |
| function | `tcart_hasDiscount`                           | 7290       |
| function | `tcart_reDrawCartIcon`                        | 7296       |
| function | `tcart_reDrawCartTotal`                       | 7311       |
| function | `tcart_reDrawSidebarTotal`                    | 7328       |
| function | `tcart__drawTotalAmountInfo`                  | 7367       |
| function | `tcart__createTotalAmountListMarkup`          | 7381       |
| function | `tcart__toggleTotalAmountVisibility`          | 7392       |
| function | `tcart__toggleProdAmountVisibility`           | 7430       |
| function | `tcart__changeSubmitStatus`                   | 7440       |
| function | `tcart__addEvents__forProducts`               | 7516       |
| function | `tcart__getLostCart`                          | 7592       |
| function | `tcart__clearLostCartUrl`                     | 7624       |
| function | `tcart__restoreLostCart`                      | 7632       |
| function | `tcart__saveRestoredProducts`                 | 7669       |
| function | `tcart__openRestoredCart`                     | 7675       |
| function | `tcart__form__getForm`                        | 7680       |
| function | `tcart__form__getDeliveryWrapper`             | 7683       |
| function | `tcart__form__getFields`                      | 7690       |
| function | `tcart__form__disableFormFields`              | 7695       |
| function | `tcart__form__hideFormFields`                 | 7701       |
| function | `tcart__form__hideErrors`                     | 7707       |
| function | `tcart__form__showFormFields`                 | 7712       |
| function | `tcart__form__insertValidateRule`             | 7718       |
| function | `tcart__fillRestoredCartForm`                 | 7730       |
| function | `tcart__showClearCartDialog`                  | 7805       |
| function | `tcart__showWrongOrderPopup`                  | 7824       |
| function | `tcart__keyUpFunc`                            | 7848       |
| function | `tcart__blockSubmitButton`                    | 7854       |
| function | `tcart__unblockSubmitButton`                  | 7860       |
| function | `tcart__blockAndDelayUnblockSubmitOnResponse` | 7865       |
| function | `tcart__blockCartUI`                          | 7871       |
| function | `tcart__unblockCartUI`                        | 7879       |
| function | `tcart__blockSidebarContinueButton`           | 7887       |
| function | `tcart__unblockSidebarContinueButton`         | 7897       |
| function | `tcart__product__plus`                        | 7907       |
| function | `tcart__product__minus`                       | 7942       |
| function | `tcart__product__del`                         | 7971       |
| function | `tcart__product__editquantity`                | 8137       |
| function | `tcart__product__updateQuantity`              | 8165       |
| function | `tcart__delZeroquantity_inCartObj`            | 8199       |
| function | `tcart__createBottomTotalAmountMarkup`        | 8210       |
| function | `tcart__drawBottomTotalAmount`                | 8226       |
| function | `tcart__hideBottomTotalAmount`                | 8255       |
| function | `tcart__addDelivery`                          | 8259       |
| function | `tcart__updateDelivery`                       | 8281       |
| function | `tcart__processDelivery`                      | 8298       |
| function | `tcart__setFreeDeliveryThreshold`             | 8316       |
| function | `tcart__addEvent__selectpayment`              | 8333       |
| function | `tcart__escapeHtml`                           | 8364       |
| function | `tcart__escapeHtmlImg`                        | 8375       |
| function | `tcart__cleanPrice`                           | 8385       |
| function | `tcart__roundPrice`                           | 8398       |
| function | `tcart__showWeight`                           | 8409       |
| function | `tcart__showPrice`                            | 8448       |
| function | `tcart__clearProdUrl`                         | 8515       |
| function | `tcart__onFuncLoad`                           | 8549       |
| function | `tcart_fadeOut`                               | 8569       |
| function | `tcart_fadeIn`                                | 8584       |
| function | `tcart__isEmptyObject`                        | 8601       |
| function | `tcart__openCartFullscreen`                   | 8605       |
| function | `tcart__closeCartFullscreen`                  | 8671       |
| function | `tcart__openCartSidebar`                      | 8706       |
| function | `tcart__closeCartSidebar`                     | 8738       |
| function | `tcart__initDelivery`                         | 8764       |
| function | `tcart__addDiscountInfo`                      | 8781       |
| function | `tcart__calcPromocode`                        | 8842       |
| function | `tcart_ceil`                                  | 8925       |
| function | `tcart__showBubble`                           | 8929       |
| function | `tcart__closeBubble`                          | 8963       |
| function | `tcart__decodeHtml`                           | 8980       |
| function | `tcart__updateLazyload`                       | 8984       |
| function | `t706_onSuccessCallback`                      | 8997       |
| function | `t706_slideUp`                                | 9012       |
| function | `t_triggerEvent`                              | 9021       |
| function | `tcart__getRootZone`                          | 9050       |
| function | `tcart__isAuthorized`                         | 9053       |
| function | `tcart__getLkpSettings`                       | 9061       |
| function | `tcart__getSubtotalDiscount`                  | 9065       |
| function | `tcart__debounce`                             | 9068       |

### Babel runtime helpers (~100 функций, строки 1–3835)

_`_OverloadYield`, `_applyDecoratedDescriptor`, `_applyDecs2311`, `_arrayLikeToArray`, `_arrayWithHoles`, `_arrayWithoutHoles`, `_assertClassBrand`, `_assertThisInitialized`, `_asyncGeneratorDelegate`, `_asyncIterator`, `AsyncFromSyncIterator`, `asyncGeneratorStep`, `_asyncToGenerator`, `_awaitAsyncGenerator`, `_callSuper`, `_checkInRHS`, `_checkPrivateRedeclaration`, `_classCallCheck`, `_classNameTDZError`, `_classPrivateField*`, `_construct`, `_defineProperties`, `_createClass`, `_createForOfIteratorHelper`, `_extends`, `_getPrototypeOf`, `_inherits`, `_isNativeReflectConstruct`, `_iterableToArray`, `_iterableToArrayLimit`, `_nonIterableRest`, `_nonIterableSpread`, `_objectSpread2`, `_possibleConstructorReturn`, `_regeneratorRuntime`, `_setFunctionName`, `_setPrototypeOf`, `_slicedToArray`, `_toConsumableArray`, `_typeof`, `_unsupportedIterableToArray`, `_wrapNativeSuper`, `_wrapRegExp`, `_AwaitValue`, `_applyDecs*`, `_dispose`, `_using`, и др._

---

## Groups

### 🌐 Сетевая инфраструктура и API

**Responsibility:** HTTP-запросы к Tilda Store API, управление серверными URL, обработка редиректов между TLD-зонами.
**Contains:** `t_cart__getServerName`, `t_cart__getServer2Name`, `t_cart__getStoreEndpointUrl`, `t_cart__getStore2EndpointUrl`, `parseResponse`, `fetchWithRedirectHandling`, `t_store__fetchApiData`, `t_store__fetchData`, `determineContentType`, `getQueryString`, `handleRootzoneRedirect`, `RequestDataFormat`, `ResponseDataFormat`, `t_cart__useRootZone`, `TCartServerLocation`
**Dependencies:** DOM (для чтения `data-tilda-root-zone`), `fetch` API, `Promise`
**Side effects:** Сеть (HTTP-запросы), globals (`window`)

### 🌍 Переводы / i18n

**Responsibility:** Локализация интерфейса корзины (английский, русский + динамическая загрузка других языков).
**Contains:** `t_store__useTranslation`, `tcart_dict`, `t_store__createTranslationUrlPathname`, `t_store__createTranslationUrl`, `t_store__createFallbackTranslationUrl`, `t_store__getPreloadedLang`, `t_store__sendTranslationRequest`, `t_store__isAvailableLang`, `enTranslation`, `ruTranslation`, `TCART_TRANSLATION_*`, `T_CART_PRELOADED_LANGS`
**Dependencies:** Сетевой слой (загрузка переводов с CDN)
**Side effects:** Сеть (CDN-запросы при отсутствии предзагруженного языка)

### 💾 Данные корзины (localStorage)

**Responsibility:** CRUD операции с данными корзины в localStorage, сериализация/десериализация, проверка актуальности.
**Contains:** `t_cart__loadCartData`, `t_cart__getDataFromLS`, `t_cart__saveCartDataToLS`, `t_cart__createDefaultCartData`, `t_cart__isCartExpired`, `t_cart__cleanCartProducts`, `t_cart__getPageSettings`, `t_cart__applyPageSettings`, `t_cart__createTimestamp`, `tcart__loadLocalObj`, `tcart__saveLocalObj`, `tcart__syncProductsObject__LStoObj`
**Dependencies:** DOM (чтение настроек из `#allrecords`), `window.tcart`
**Side effects:** localStorage (чтение/запись `tcart`), globals (`window.tcart`)

### 🛒 Управление товарами

**Responsibility:** Добавление, удаление, изменение количества товаров, пересчёт сумм, проверка лимитов и SKU.
**Contains:** `tcart__addProduct`, `tcart__product__plus`, `tcart__product__minus`, `tcart__product__del`, `tcart__product__editquantity`, `tcart__product__updateQuantity`, `tcart__delZeroquantity_inCartObj`, `tcart__updateTotalProductsinCartObj`, `tcart__updateProductsPrice`, `t_cart__loadProductsInfoById`, `t_cart__loadProductsPrices`
**Dependencies:** localStorage (чтение/запись корзины), API (обновление цен), UI-отрисовка
**Side effects:** DOM (перерисовка корзины), localStorage, globals (`window.tcart`), сеть (обновление цен каждые 3ч)

### 🎨 Отрисовка UI корзины

**Responsibility:** Визуальное отображение корзины: иконка, список товаров, итоги, суммы, скидки.
**Contains:** `tcart__reDrawCartIcon`, `tcart__shouldShowCartIcon`, `tcart__reDrawProducts`, `tcart__reDrawTotal`, `tcart__lumaRgb`, `tcart_isZeroBecauseOfDiscount`, `tcart_hasDiscount`, `tcart_reDrawCartIcon`, `tcart_reDrawCartTotal`, `tcart_reDrawSidebarTotal`, `tcart__drawTotalAmountInfo`, `tcart__createTotalAmountListMarkup`, `tcart__toggleTotalAmountVisibility`, `tcart__toggleProdAmountVisibility`, `tcart__createBottomTotalAmountMarkup`, `tcart__drawBottomTotalAmount`, `tcart__hideBottomTotalAmount`, `tcart__updateMinimals`, `tcart__updateLazyload`, `tcart__showBubble`, `tcart__closeBubble`
**Dependencies:** `window.tcart` (данные корзины), переводы (`tcart_dict`), утилиты цен (`tcart__showPrice`)
**Side effects:** DOM (создание/обновление/удаление элементов)

### 🪟 Открытие/Закрытие корзины

**Responsibility:** Управление визуальными режимами корзины: sidebar, fullscreen, modal; блокировка прокрутки.
**Contains:** `tcart__openCart`, `tcart__closeCart`, `tcart__openCartFullscreen`, `tcart__closeCartFullscreen`, `tcart__openCartSidebar`, `tcart__closeCartSidebar`, `tcart__lockScroll`, `tcart__unlockScroll`, `tcart__keyUpFunc`
**Dependencies:** UI-отрисовка, DOM (классы body), утилиты (`tcart_fadeIn`, `tcart_fadeOut`)
**Side effects:** DOM (классы на `body`, `document`), globals (`window.tcart`)

### 🔐 Авторизация (Members)

**Responsibility:** Интеграция с Tilda Members: логин, регистрация, автозаполнение полей пользователя, выход.
**Contains:** `tcart__auth__init`, `tcart__auth__createWrapEl`, `tcart__auth__insertAuthEl`, `tcart__auth__createAuthEl`, `tcart__auth__createLoggedInEl`, `tcart__auth__onMembersLogout`, `tcart__auth__getMauser`, `tcart__auth__getMauserFromLS`, `tcart__auth__getUserFields`, `tcart__auth__fillUserFields`, `tcart__auth__clearUserFields`, `tcart__isAuthorized`, `tcart__initAuthAndDelivery`, `t_cart__loadMembersSettings`
**Dependencies:** API (`t_cart__loadMembersSettings`), localStorage (токен пользователя), DOM (форма)
**Side effects:** DOM (создание формы логина/регистрации), localStorage, globals (`window.mauser`)

### 📦 Доставка

**Responsibility:** Инициализация модуля доставки, добавление/обновление данных доставки, порог бесплатной доставки.
**Contains:** `tcart__initDelivery`, `tcart__addDelivery`, `tcart__updateDelivery`, `tcart__processDelivery`, `tcart__setFreeDeliveryThreshold`, `t_cart__loadDeliveryAssets`, `t_cart__loadСountryСodes`, `tcart__form__isDeliveryServicesActive`
**Dependencies:** Внешние скрипты (`tilda-delivery-1.0`), localStorage
**Side effects:** DOM (вставка скриптов/CSS), сеть (загрузка delivery assets), globals (`window.tcart_newDelivery`)

### 🏷️ Скидки и промокоды

**Responsibility:** Загрузка, расчёт и отображение скидок и промокодов.
**Contains:** `t_cart__loadDiscountsHook`, `tcart__loadDiscounts`, `tcart__addDiscountInfo`, `tcart__calcPromocode`, `tcart_ceil`, `tcart__getSubtotalDiscount`
**Dependencies:** API (загрузка скидок), localStorage, утилиты цен
**Side effects:** localStorage (кеш скидок), DOM (отрисовка инфо о скидках)

### 📋 Форма заказа

**Responsibility:** Управление формой заказа: валидация, блокировка/разблокировка полей, кнопка отправки.
**Contains:** `tcart__form__getForm`, `tcart__form__getFields`, `tcart__form__disableFormFields`, `tcart__form__hideFormFields`, `tcart__form__hideErrors`, `tcart__form__showFormFields`, `tcart__form__insertValidateRule`, `tcart__handleSaveFieldsOnCheckout`, `tcart__handleSubmitButton`, `tcart__saveFieldsOnCheckout`, `tcart__fillRestoredCartForm`, `tcart__blockSubmitButton`, `tcart__unblockSubmitButton`, `tcart__blockAndDelayUnblockSubmitOnResponse`, `tcart__blockCartUI`, `tcart__unblockCartUI`, `tcart__blockSidebarContinueButton`, `tcart__unblockSidebarContinueButton`, `tcart__changeSubmitStatus`
**Dependencies:** DOM (элементы формы)
**Side effects:** DOM (модификация формы, блокировка кнопок), timers (3с задержка разблокировки)

### 🔄 Восстановление корзины (Lost Cart)

**Responsibility:** Восстановление потерянной корзины по URL `#!/torder/...`, диалог «очистить/добавить».
**Contains:** `tcart__getLostCart`, `tcart__clearLostCartUrl`, `tcart__restoreLostCart`, `tcart__saveRestoredProducts`, `tcart__openRestoredCart`, `tcart__showClearCartDialog`, `tcart__showWrongOrderPopup`, `tcart__getProductsInfoById`, `t_cart__loadRestoreFieldsScript`, `t_cart__loadLostCartStyles`
**Dependencies:** API (`tcart__getProductsInfoById`), UI-отрисовка, localStorage
**Side effects:** DOM (диалоги), сеть (API-запросы), URL (очистка хеша), localStorage

### 🎯 Обработка событий

**Responsibility:** Навешивание и обработка кликов по кнопкам `#order`, +/-/del, выбор оплаты, Escape.
**Contains:** `tcart__addEvents`, `tcart__addEvent__links`, `tcart__addEvents__forProducts`, `tcart__addEvent__selectpayment`, `tcart__keyUpFunc`
**Dependencies:** Управление товарами, UI, форма заказа
**Side effects:** DOM (event listeners на `document`, кнопки, ссылки)

### 🔧 Утилиты

**Responsibility:** Общие вспомогательные функции: форматирование, экранирование, анимации, debounce.
**Contains:** `tcart__escapeHtml`, `tcart__escapeHtmlImg`, `tcart__cleanPrice`, `tcart__roundPrice`, `tcart__showWeight`, `tcart__showPrice`, `tcart__nullObj`, `tcart__isEmptyObject`, `tcart__clearProdUrl`, `tcart__onFuncLoad`, `tcart_fadeOut`, `tcart_fadeIn`, `tcart__decodeHtml`, `tcart__debounce`, `tcart__getRootZone`, `tcart__getLkpSettings`, `t_triggerEvent`, `t706_onSuccessCallback`, `t706_slideUp`
**Dependencies:** нет внешних
**Side effects:** нет

### ⚙️ Загрузка внешних ресурсов

**Responsibility:** Динамическая загрузка CSS/JS файлов и ожидание готовности глобальных функций.
**Contains:** `t_store__useExternalFunction`, `t_store__useExternalCSSFile`, `t_store__useExternalJsFile`, `t_catalog__getStaticHost`
**Dependencies:** DOM (`<script>`, `link>`)
**Side effects:** DOM (вставка `script>`, `link>`), timers (polling)

---

## Unclear / Needs Review

1. **`tcart__addEvent__links` (~400 строк)** — слишком длинная функция, обрабатывающая клики по `#order` ссылкам. Внутри может быть сложная логика маршрутизации, которая требует детальной трассировки.
2. **`tcart__init`** — главная точка входа, но её точная последовательность вызовов не полностью трассирована (зависит от множества условий: авторизация, доставка, скидки, lost cart).
3. **`tcart__updateTotalProductsinCartObj`** — пересчёт сумм корзины, может содержать нетривиальную логику промокодов/скидок.
4. **Опечатка**: `t_cart__loadСountryСodes` — кириллические «С» вместо латинских «C» в имени функции.
5. **Глобальное состояние**: `window.tcart` используется повсеместно как глобальный стейт — нет модульной инкапсуляции.
6. **Взаимодействие с внешними модулями**: ожидание загрузки `tcart__calcAmountWithDiscounts`, `tcart_newDelivery`, `tcart__restoreFields` через `t_store__useExternalFunction` — фактическое поведение зависит от внешних скриптов.
