/**
 * State Machine — готовность к покупке
 */

export interface OzonState {
  phoneChecked: boolean;
  phoneValid: boolean;
  phoneTouched: boolean;
  deliverySelected: boolean;
  checkoutPassed: boolean;
  deliveryType: "pickup" | "courier" | null;
  lastCheckoutError: string | null;
  checkoutFailedOnce: boolean;
}

export const ozonState: OzonState = {
  phoneChecked: false,
  phoneValid: false,
  phoneTouched: false,
  deliverySelected: false,
  checkoutPassed: false,
  deliveryType: null,
  lastCheckoutError: null,
  checkoutFailedOnce: false,
};

function getErrorMessage(): string {
  // Если есть конкретная ошибка checkout — всегда показываем
  if (ozonState.lastCheckoutError && !ozonState.checkoutPassed) {
    return ozonState.lastCheckoutError;
  }
  // Если пользователь выбрал доставку, но телефон не введён — подсказываем
  if (ozonState.deliverySelected && !ozonState.phoneTouched) {
    return "Введите номер телефона";
  }
  if (!ozonState.phoneTouched) return "";
  if (!ozonState.phoneValid) return "Введите номер телефона";
  if (!ozonState.phoneChecked)
    return "Доставка Ozon недоступна для этого номера";
  if (!ozonState.deliverySelected)
    return "Выберите пункт выдачи или введите адрес доставки";
  if (!ozonState.checkoutPassed)
    return "Доставка недоступна для выбранных товаров";
  return "";
}

function showOzonError(message: string): void {
  if (!message) return hideOzonError();
  window.tcart__errorHandler?.show(message);
}

function hideOzonError(): void {
  window.tcart__errorHandler?.hide();
}

let errorRedisplayTimer: ReturnType<typeof setTimeout> | null = null;

export function updatePurchaseButton(): void {
  const canPurchase =
    ozonState.phoneTouched &&
    ozonState.phoneChecked &&
    ozonState.deliverySelected &&
    ozonState.checkoutPassed;

  if (errorRedisplayTimer) {
    clearTimeout(errorRedisplayTimer);
    errorRedisplayTimer = null;
  }

  if (canPurchase) {
    window.tcart__unblockSubmitButton?.();
    hideOzonError();
  } else {
    window.tcart__blockSubmitButton?.();
    const errorMsg = getErrorMessage();
    showOzonError(errorMsg);
    // Тильда может затереть ошибку при перерендере — повторно показываем
    if (errorMsg) {
      errorRedisplayTimer = setTimeout(() => showOzonError(errorMsg), 300);
    }
  }
}
