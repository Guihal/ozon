/**
 * Проверка телефона через Ozon API
 */
import { BACKEND } from "./config";
import { ozonState, updatePurchaseButton } from "./state";
import { waitFor } from "./utils";
import { rerunCheckout } from "./checkout";

let phoneCheckDebounce: ReturnType<typeof setTimeout> | null = null;
let lastCheckedPhone = "";

async function checkPhoneWithOzon(phone: string): Promise<void> {
  if (phone === lastCheckedPhone && ozonState.phoneChecked) return;
  lastCheckedPhone = phone;

  try {
    const res = await fetch(`${BACKEND}/v1/delivery/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_phone: phone }),
    });
    const d = await res.json();
    ozonState.phoneChecked = d.is_possible === true;
  } catch (err) {
    console.warn("[OzonPatch] Phone check error:", err);
    ozonState.phoneChecked = false;
  }
  updatePurchaseButton();

  // После успешного check — перезапускаем checkout если доставка уже выбрана
  if (ozonState.phoneChecked && ozonState.deliverySelected) {
    rerunCheckout();
  }
}

export function handlePhoneChange(): void {
  ozonState.phoneTouched = true;

  const phoneMaskInput = document.querySelector(
    ".t706 .js-phonemask-result",
  ) as HTMLInputElement | null;
  let phone = "";
  if (phoneMaskInput?.value) {
    phone = phoneMaskInput.value.replace(/\D/g, "");
  } else {
    const phoneInput = document.querySelector(
      '.t706 input[name="phone"]',
    ) as HTMLInputElement | null;
    if (phoneInput) phone = phoneInput.value.replace(/\D/g, "");
  }

  // Нормализуем: 8xxx → 7xxx
  if (phone.startsWith("8") && phone.length === 11) {
    phone = "7" + phone.slice(1);
  }

  const isValid = phone.length === 11 && phone.startsWith("7");
  ozonState.phoneValid = isValid;

  if (isValid) {
    ozonState.checkoutPassed = false;
    if (phoneCheckDebounce) clearTimeout(phoneCheckDebounce);
    phoneCheckDebounce = setTimeout(() => checkPhoneWithOzon(phone), 600);
  } else {
    ozonState.phoneChecked = false;
    ozonState.checkoutPassed = false;
    lastCheckedPhone = "";
  }
  updatePurchaseButton();
}

export function resetLastCheckedPhone(): void {
  lastCheckedPhone = "";
}

/**
 * Инициализация слушателей телефона
 */
export function initPhoneListeners(): void {
  // Слушаем input на поле телефона
  document.body.addEventListener(
    "input",
    (e) => {
      const el = e.target as HTMLInputElement;
      if (
        el.name === "phone" ||
        el.classList.contains("js-phonemask-result") ||
        el.name?.startsWith("tildaspec-phone")
      ) {
        handlePhoneChange();
      }
    },
    true,
  );

  // На blur тоже проверяем
  document.body.addEventListener(
    "blur",
    (e) => {
      const el = e.target as HTMLInputElement;
      if (el.name === "phone" || el.classList.contains("js-phonemask-result")) {
        handlePhoneChange();
      }
    },
    true,
  );

  // MutationObserver на js-phonemask-result
  waitFor(
    () =>
      document.querySelector(
        ".t706 .js-phonemask-result",
      ) as HTMLInputElement | null,
    (phoneMaskEl) => {
      const phoneObserver = new MutationObserver(() => handlePhoneChange());
      phoneObserver.observe(phoneMaskEl, {
        attributes: true,
        attributeFilter: ["value"],
      });
      // Перехватываем value setter
      const desc = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      );
      if (desc?.set) {
        const origSet = desc.set;
        Object.defineProperty(phoneMaskEl, "value", {
          get: desc.get,
          set(val: string) {
            origSet.call(this, val);
            handlePhoneChange();
          },
          configurable: true,
        });
      }
    },
  );

  // Проверяем предзаполненный телефон из ЛК Тильды
  setTimeout(() => {
    const phoneMaskInput = document.querySelector(
      ".t706 .js-phonemask-result",
    ) as HTMLInputElement | null;
    const phoneInput = document.querySelector(
      '.t706 [name="phone"]',
    ) as HTMLInputElement | null;
    const prefilled = phoneMaskInput?.value || phoneInput?.value || "";
    if (prefilled.replace(/\D/g, "").length >= 10) {
      console.log("[OzonPatch] Предзаполненный телефон найден:", prefilled);
      handlePhoneChange();
    }
  }, 1000);
}
