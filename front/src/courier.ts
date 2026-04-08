/**
 * Курьерская доставка — отслеживание адреса через евенты Тильды, геокод, checkout
 */
import { OZON_COURIER_ID } from "./config";
import { ozonState, updatePurchaseButton } from "./state";
import { setHiddenInput } from "./utils";
import { geocodeAndUpdateCourier } from "./checkout";
import { handlePhoneChange, resetLastCheckedPhone } from "./phone";
import type { TildaDelivery } from "./types";

let courierDebounce: ReturnType<typeof setTimeout> | null = null;

/** Адрес, для которого последний checkout вернул ошибку (дедупликация) */
let lastFailedAddress = "";
/** Адрес, для которого сейчас выполняется запрос */
let courierInFlight = false;
/** Последний адрес, по которому уже запустили геокод */
let lastTriggeredAddress = "";

/**
 * Сбрасывает блокировки курьерского checkout (вызывать при реальном изменении данных)
 */
export function resetCourierFailed(): void {
  lastFailedAddress = "";
  lastTriggeredAddress = "";
  ozonState.checkoutFailedOnce = false;
}

/**
 * Проверяет, выбран ли сейчас курьерский сервис Ozon
 */
function isCourierActive(delivery: TildaDelivery): boolean {
  // Тильда хранит activeServiceUid как number (parseInt), наши ID — строки
  return String(delivery?.deliveryState?.activeServiceUid) === OZON_COURIER_ID;
}

/**
 * Собирает полный адрес из полей Тильды
 */
function collectCourierAddress(): string {
  const city =
    (
      document.querySelector(
        'input[name="tildadelivery-city"]',
      ) as HTMLInputElement
    )?.value || "";
  const street =
    (
      document.querySelector(
        'input[name="tildadelivery-street"]',
      ) as HTMLInputElement
    )?.value || "";
  const house =
    (
      document.querySelector(
        'input[name="tildadelivery-house"]',
      ) as HTMLInputElement
    )?.value || "";
  const onelineAddr =
    (
      document.querySelector(
        'input[name="tildadelivery-onelineaddress"]',
      ) as HTMLInputElement
    )?.value || "";

  if (street && house) {
    return [city, street, house].filter(Boolean).join(", ");
  }
  if (onelineAddr) {
    return city ? `${city}, ${onelineAddr}` : onelineAddr;
  }
  return [city, street, house].filter(Boolean).join(", ");
}

/**
 * Запуск геокода с дебаунсом (вызывается пользовательскими действиями)
 */
function scheduleCourierGeocode(isUserAction: boolean = false): void {
  if (courierDebounce) clearTimeout(courierDebounce);
  courierDebounce = setTimeout(() => {
    const fullAddress = collectCourierAddress();
    if (fullAddress.length < 5) return;

    // Если адрес не изменился и checkout уже провалился — не повторяем
    if (fullAddress === lastFailedAddress && !isUserAction) return;
    // Если уже идёт запрос — не дублируем
    if (courierInFlight) return;
    // Если тот же адрес уже был тригернут (не из пользовательского действия) — пропускаем
    if (fullAddress === lastTriggeredAddress && !isUserAction) return;

    if (isUserAction) {
      // Пользователь реально сменил адрес — сбрасываем блокировки
      lastFailedAddress = "";
      ozonState.checkoutFailedOnce = false;
    }

    lastTriggeredAddress = fullAddress;
    console.log("[OzonPatch] Courier geocode trigger:", fullAddress);
    courierInFlight = true;
    geocodeAndUpdateCourier(fullAddress).finally(() => {
      courierInFlight = false;
      if (!ozonState.checkoutPassed) {
        lastFailedAddress = fullAddress;
        ozonState.checkoutFailedOnce = true;
      }
    });
  }, 800);
}

/**
 * Обработчик переключения на курьерский сервис
 */
function onCourierSelected(delivery: TildaDelivery): void {
  setHiddenInput("ozon_delivery_type", "courier");
  setHiddenInput("ozon_map_point_id", "");
  ozonState.deliverySelected = false;
  ozonState.deliveryType = "courier";
  ozonState.checkoutPassed = false;
  updatePurchaseButton();

  // Поля курьера рендерятся асинхронно — ждём и пробуем геокод
  setTimeout(() => {
    const fullAddress = collectCourierAddress();
    if (fullAddress.length >= 5) {
      geocodeAndUpdateCourier(fullAddress);
    }
  }, 400);

  if (!ozonState.phoneChecked && ozonState.phoneValid) {
    resetLastCheckedPhone();
    handlePhoneChange();
  }
}

/**
 * Обработчик переключения НЕ на курьера (ПВЗ и т.д.)
 */
function onCourierDeselected(): void {
  if (ozonState.deliveryType === "courier") {
    ozonState.deliverySelected = false;
    ozonState.deliveryType = null;
    ozonState.checkoutPassed = false;
    updatePurchaseButton();
  }
}

/**
 * Инициализация курьерской доставки — через евенты Тильды
 */
export function initCourier(delivery: TildaDelivery): void {
  // === 1. Клик по радио-кнопкам доставки (нативное событие Тильды) ===
  document.body.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      const radio = target.closest(
        'input[name="tildadelivery-type"]',
      ) as HTMLInputElement | null;
      if (!radio) return;

      // Даём Тильде обработать клик и обновить activeServiceUid
      setTimeout(() => {
        if (isCourierActive(delivery)) {
          onCourierSelected(delivery);
        } else {
          onCourierDeselected();
        }
      }, 50);
    },
    true,
  );

  // === 2. Патч onAddressChange — Тильда вызывает при любом изменении адреса ===
  const origOnAddressChange = delivery.onAddressChange;
  if (origOnAddressChange) {
    delivery.onAddressChange = function (e: Event) {
      origOnAddressChange.call(delivery, e);

      if (isCourierActive(delivery)) {
        scheduleCourierGeocode(true); // user action
      }
    };
  }

  // === 3. Патч saveTcartDelivery — safety net: Тильда сохраняет доставку после заполнения полей ===
  const origSaveTcartDelivery = delivery.saveTcartDelivery;
  if (origSaveTcartDelivery) {
    delivery.saveTcartDelivery = function () {
      origSaveTcartDelivery.call(delivery);

      if (isCourierActive(delivery)) {
        scheduleCourierGeocode(true); // user action
      }
    };
  }

  // === 4. Делегированный change на полях адреса (автокомплит Тильды ставит значения программно) ===
  document.body.addEventListener(
    "change",
    (e) => {
      const el = e.target as HTMLInputElement;
      if (
        el.name === "tildadelivery-onelineaddress" ||
        el.name === "tildadelivery-city" ||
        el.name === "tildadelivery-street" ||
        el.name === "tildadelivery-house"
      ) {
        if (isCourierActive(delivery)) {
          scheduleCourierGeocode(true); // user action
        }
      }
    },
    true,
  );

  // === 5. Делегированный blur — ловит момент когда пользователь покинул поле ===
  document.body.addEventListener(
    "focusout",
    (e) => {
      const el = e.target as HTMLInputElement;
      if (
        el.name === "tildadelivery-onelineaddress" ||
        el.name === "tildadelivery-city" ||
        el.name === "tildadelivery-street" ||
        el.name === "tildadelivery-house"
      ) {
        if (isCourierActive(delivery)) {
          scheduleCourierGeocode(true); // user action
        }
      }
    },
    true,
  );

  // === 6. Перехват selectDeliveryService как fallback ===
  const origSelectService = delivery.selectDeliveryService;
  if (origSelectService) {
    delivery.selectDeliveryService = function (...args: unknown[]) {
      origSelectService.apply(delivery, args);

      if (isCourierActive(delivery)) {
        onCourierSelected(delivery);
      } else {
        onCourierDeselected();
      }
    };
  }

  // === 7. MutationObserver — ловит появление новых полей курьера ===
  // НЕ считается user action — только дедуплицированный fallback
  const cartContainer =
    document.querySelector(".t706") || document.querySelector(".t-store__cart");
  if (cartContainer) {
    let mutationDebounce: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (!isCourierActive(delivery)) return;
      // Дебаунс чтобы не реагировать на каждую мутацию
      if (mutationDebounce) clearTimeout(mutationDebounce);
      mutationDebounce = setTimeout(() => {
        const fullAddress = collectCourierAddress();
        if (fullAddress.length >= 5) {
          scheduleCourierGeocode(false); // NOT user action — будет дедуплицировано
        }
      }, 1500);
    });
    observer.observe(cartContainer, { childList: true, subtree: true });
  }

  console.log("[OzonPatch] Courier: Tilda events patched ✓");
}
