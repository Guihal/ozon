/**
 * Cart Polling — агрессивная проверка корзины каждую секунду
 */
import { OZON_PICKUP_ID, OZON_COURIER_ID } from "./config";
import { ozonState, updatePurchaseButton } from "./state";
import { getCartItems } from "./utils";
import { updateOzonPrice, updateCourierPrice } from "./checkout";
import { handlePhoneChange, resetLastCheckedPhone } from "./phone";
import { resetCourierFailed } from "./courier";

export function initCartPolling(): void {
  let cartSnapshotJson = JSON.stringify(getCartItems());
  let checkoutInFlight = false;

  setInterval(() => {
    const items = getCartItems();
    const newSnapshot = JSON.stringify(items);
    const cartChanged = newSnapshot !== cartSnapshotJson;

    if (cartChanged) {
      cartSnapshotJson = newSnapshot;
      console.log("[OzonPatch] Корзина изменилась, сброс checkout");
      ozonState.checkoutPassed = false;
      ozonState.lastCheckoutError = null;
      ozonState.checkoutFailedOnce = false;
      resetCourierFailed();
      updatePurchaseButton();
    }

    if (items.length === 0) return;

    // Если телефон не проверен, но введён — перезапускаем проверку
    if (!ozonState.phoneChecked && ozonState.phoneValid) {
      resetLastCheckedPhone();
      handlePhoneChange();
      return;
    }

    // Если checkout не пройден и доставка выбрана и телефон ок — перезапускаем
    // Но только если предыдущий запрос не упал с ошибкой
    if (
      !ozonState.checkoutPassed &&
      ozonState.phoneChecked &&
      ozonState.deliverySelected &&
      !checkoutInFlight &&
      !ozonState.checkoutFailedOnce
    ) {
      console.log("[OzonPatch] Polling: checkout не пройден, перезапуск");
      checkoutInFlight = true;
      const done = () => {
        checkoutInFlight = false;
        if (!ozonState.checkoutPassed) {
          ozonState.checkoutFailedOnce = true;
        }
      };

      if (ozonState.deliveryType === "pickup") {
        const mapPointId = (
          document.querySelector(
            '.t706 [name="ozon_map_point_id"]',
          ) as HTMLInputElement
        )?.value;
        if (mapPointId) {
          updateOzonPrice(OZON_PICKUP_ID, mapPointId).finally(done);
        } else {
          done();
        }
      } else if (ozonState.deliveryType === "courier") {
        const lat = (
          document.querySelector(
            '.t706 [name="ozon_courier_lat"]',
          ) as HTMLInputElement
        )?.value;
        const lon = (
          document.querySelector(
            '.t706 [name="ozon_courier_lon"]',
          ) as HTMLInputElement
        )?.value;
        if (lat && lon) {
          updateCourierPrice(
            OZON_COURIER_ID,
            parseFloat(lat),
            parseFloat(lon),
          ).finally(done);
        } else {
          done();
        }
      } else {
        done();
      }
    }
  }, 1000);
}
