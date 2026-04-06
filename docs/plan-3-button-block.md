# Этап 3 — UX: блокировка/разблокировка кнопки покупки

## Цель

Кнопка «Купить» (submit) должна быть заблокирована (серая), пока:

1. Проверка телефона (`/v1/delivery/check`) не пройдена
2. Способ доставки не выбран (ПВЗ не выбран / адрес не введён)

При блокировке — показывать ошибку в корзине с пояснением.

## Текущее состояние

- При неуспешном check → `alert("Доставка Ozon недоступна для этого номера")` и всё
- Кнопка остаётся активной, пользователь может оформить заказ
- Нет state-машины для отслеживания готовности к покупке

## Задачи

### 3.1. State-машина на фронте

В `tilda-map-patch.html` добавить глобальный объект состояния:

```javascript
const ozonState = {
  phoneChecked: false, // check пройден успешно
  phoneValid: false, // телефон введён и валиден
  deliverySelected: false, // ПВЗ выбран или адрес введён
  deliveryType: null, // "pickup" | "courier" | null
};

function updatePurchaseButton() {
  const canPurchase = ozonState.phoneChecked && ozonState.deliverySelected;
  if (canPurchase) {
    tcart__unblockSubmitButton();
    hideOzonError();
  } else {
    tcart__blockSubmitButton();
    showOzonError(getErrorMessage());
  }
}

function getErrorMessage() {
  if (!ozonState.phoneValid) return "Введите номер телефона";
  if (!ozonState.phoneChecked)
    return "Доставка Ozon недоступна для этого номера";
  if (!ozonState.deliverySelected)
    return "Выберите пункт выдачи или введите адрес доставки";
  return "";
}
```

### 3.2. Интеграция с существующими патчами

**Проверка телефона (патч 5):**

```javascript
// Вместо alert:
document.body.addEventListener("blur", async (e) => {
  if (e.target.name === "phone") {
    const phone = e.target.value.replace(/\D/g, "");
    ozonState.phoneValid = phone.length === 11;

    if (phone.length === 11) {
      const res = await fetch(`${BACKEND}/v1/delivery/check`, { ... });
      const d = await res.json();
      ozonState.phoneChecked = d.is_possible === true;
    } else {
      ozonState.phoneChecked = false;
    }
    updatePurchaseButton();
  }
}, true);
```

**Выбор ПВЗ (патч 1 — changePickupHandler):**

```javascript
delivery.changePickupHandler = function(pointId, ...) {
  origChangePickup.apply(this, arguments);
  // ... existing code ...

  ozonState.deliverySelected = !!pointId;
  ozonState.deliveryType = "pickup";
  updatePurchaseButton();
};
```

**Выбор курьерской доставки (Этап 2):**

```javascript
// После успешного получения цены курьера:
ozonState.deliverySelected = true;
ozonState.deliveryType = "courier";
updatePurchaseButton();
```

### 3.3. Показ ошибки в корзине

Использовать встроенные функции Тильды:

```javascript
function showOzonError(message) {
  // Вариант 1: через tcart__errorHandler
  if (window.tcart__errorHandler) {
    window.tcart__errorHandler.show(message);
  }

  // Вариант 2: кастомный элемент
  let errorEl = document.getElementById("ozon-delivery-error");
  if (!errorEl) {
    errorEl = document.createElement("div");
    errorEl.id = "ozon-delivery-error";
    errorEl.style.cssText =
      "color:#e74c3c; padding:8px 16px; font-size:14px; margin:8px 0;";
    const form = document.querySelector(".t706__cartwin-prodlist");
    if (form) form.after(errorEl);
  }
  errorEl.textContent = message;
  errorEl.style.display = message ? "block" : "none";
}

function hideOzonError() {
  const el = document.getElementById("ozon-delivery-error");
  if (el) el.style.display = "none";
}
```

### 3.4. Блокировка при загрузке страницы

При первом открытии корзины — кнопка заблокирована по умолчанию:

```javascript
waitFor(
  () => window.tcart_newDelivery,
  (delivery) => {
    // Сразу блокируем кнопку до прохождения проверок
    tcart__blockSubmitButton();
    showOzonError("Введите номер телефона и выберите способ доставки");

    // ... остальные патчи ...
  },
);
```

### 3.5. Сброс состояния

При изменении ключевых полей — сбрасывать соответствующие флаги:

```javascript
// При смене телефона — повторная проверка
input[(name = "phone")].addEventListener("input", () => {
  ozonState.phoneChecked = false;
  updatePurchaseButton();
});

// При смене способа доставки — сброс выбора
// (перехватить changeDeliveryTypeListener)
ozonState.deliverySelected = false;
updatePurchaseButton();
```

## Tilda API (встроенные функции)

| Функция                         | Описание                               |
| ------------------------------- | -------------------------------------- |
| `tcart__blockSubmitButton()`    | Делает кнопку серой и неактивной       |
| `tcart__unblockSubmitButton()`  | Возвращает кнопку в активное состояние |
| `tcart__changeSubmitStatus()`   | Альтернативный способ управления       |
| `tcart__errorHandler.show(msg)` | Показ ошибки в корзине                 |

## Зависимости

- Не блокирует и не зависит от Этапа 1
- Этап 2 (курьер) — дополнит state для courier

## Файлы для изменения

| Файл                               | Действие                                  |
| ---------------------------------- | ----------------------------------------- |
| `src/scripts/tilda-map-patch.html` | Добавить state-машину, обновить все патчи |
