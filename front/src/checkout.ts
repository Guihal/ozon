/**
 * Checkout — расчёт цены доставки (ПВЗ и курьер)
 */
import { BACKEND, OZON_PICKUP_ID, OZON_COURIER_ID } from "./config";
import { ozonState, updatePurchaseButton } from "./state";
import { getCartItems, getPhone, setHiddenInput } from "./utils";

/**
 * Расчёт цены доставки Ozon (ПВЗ)
 */
export async function updateOzonPrice(
  serviceId: string,
  mapPointId: string,
): Promise<void> {
  if (!mapPointId) return;
  const phone = getPhone();
  if (!phone) {
    console.log("[OzonPatch] Pickup price skipped: no phone");
    return;
  }
  ozonState.checkoutPassed = false;
  ozonState.lastCheckoutError = null;
  updatePurchaseButton();
  window.tcart__preloader?.show();
  try {
    const res = await fetch(`${BACKEND}/v1/delivery/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mapPointId: parseInt(mapPointId),
        items: getCartItems(),
        buyerPhone: phone,
      }),
    });
    const data = await res.json();
    if (data.success) {
      ozonState.checkoutPassed = true;
      ozonState.lastCheckoutError = null;
      const service =
        window.tcart_newDelivery?.deliveryState.services[serviceId];
      if (service) {
        if (data.total_price) service.price = data.total_price.value;
        if (data.delivery_date) service.days = data.delivery_date;
        if (data.daysMin !== undefined && data.daysMax !== undefined) {
          service.days = `${data.daysMin}-${data.daysMax} дн.`;
        }
        window.tcart__updateTotalProductsinCartObj?.();
      }
    } else {
      ozonState.checkoutPassed = false;
      ozonState.lastCheckoutError =
        data.error || "Доставка недоступна для выбранных товаров";
      console.warn("[OzonPatch] Checkout failed:", data.error || data);
    }
  } catch (e) {
    ozonState.checkoutPassed = false;
    ozonState.lastCheckoutError =
      "Ошибка при расчёте доставки. Попробуйте ещё раз.";
    console.warn("[OzonPatch] Price error:", e);
  } finally {
    window.tcart__preloader?.hide();
    updatePurchaseButton();
  }
}

/**
 * Расчёт цены курьерской доставки Ozon
 */
export async function updateCourierPrice(
  serviceId: string,
  lat: number,
  lng: number,
): Promise<void> {
  if (!lat || !lng) return;
  const phone = getPhone();
  if (!phone) {
    console.log("[OzonPatch] Courier price skipped: no phone");
    return;
  }
  ozonState.checkoutPassed = false;
  ozonState.lastCheckoutError = null;
  updatePurchaseButton();
  window.tcart__preloader?.show();
  try {
    const res = await fetch(`${BACKEND}/v1/delivery/courier/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        items: getCartItems(),
        buyerPhone: phone,
      }),
    });
    const data = await res.json();
    if (data.success) {
      ozonState.checkoutPassed = true;
      ozonState.lastCheckoutError = null;
      const service =
        window.tcart_newDelivery?.deliveryState.services[serviceId];
      if (service) {
        if (data.daysMin !== undefined && data.daysMax !== undefined) {
          service.days = `${data.daysMin}-${data.daysMax} дн.`;
        }
        window.tcart__updateTotalProductsinCartObj?.();
      }
    } else {
      ozonState.checkoutPassed = false;
      ozonState.lastCheckoutError =
        data.error || "Курьерская доставка недоступна для этого адреса";
      console.warn("[OzonPatch] Courier price unavailable:", data.error);
    }
  } catch (e) {
    ozonState.checkoutPassed = false;
    ozonState.lastCheckoutError =
      "Ошибка при расчёте курьерской доставки. Попробуйте ещё раз.";
    console.warn("[OzonPatch] Courier price error:", e);
  } finally {
    window.tcart__preloader?.hide();
    updatePurchaseButton();
  }
}

/**
 * Геокодинг адреса → установка координат → расчёт курьерской цены
 */
export async function geocodeAndUpdateCourier(address: string): Promise<void> {
  if (!address || address.trim().length < 5) {
    ozonState.deliverySelected = false;
    ozonState.checkoutPassed = false;
    updatePurchaseButton();
    return;
  }
  ozonState.checkoutPassed = false;
  updatePurchaseButton();
  try {
    const res = await fetch(`${BACKEND}/v1/delivery/geocode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const data = await res.json();
    if (data.success && data.lat && data.lon) {
      const lat = data.lat;
      const lon = data.lon;
      console.log(`[OzonPatch] Geocoded "${address}" → ${lat}, ${lon}`);

      setHiddenInput("ozon_delivery_type", "courier");
      setHiddenInput("ozon_map_point_id", "");
      setHiddenInput("ozon_courier_lat", String(lat));
      setHiddenInput("ozon_courier_lon", String(lon));

      ozonState.deliverySelected = true;
      ozonState.deliveryType = "courier";
      updatePurchaseButton();
      // Не вызываем checkout без проверенного телефона — polling повторит
      if (ozonState.phoneChecked) {
        await updateCourierPrice(OZON_COURIER_ID, lat, lon);
      }
    } else {
      console.warn(`[OzonPatch] Geocode failed for: "${address}"`);
      ozonState.deliverySelected = false;
      ozonState.checkoutPassed = false;
      updatePurchaseButton();
      window.tcart__errorHandler?.show(
        "Не удалось определить адрес. Проверьте правильность ввода.",
      );
    }
  } catch (e) {
    console.warn("[OzonPatch] Geocode error:", e);
    ozonState.deliverySelected = false;
    ozonState.checkoutPassed = false;
    updatePurchaseButton();
    window.tcart__errorHandler?.show(
      "Ошибка при определении адреса. Попробуйте ещё раз.",
    );
  }
}

/**
 * Перезапуск checkout с текущими параметрами доставки
 */
export function rerunCheckout(): void {
  if (ozonState.deliveryType === "pickup") {
    const mapPointId = (
      document.querySelector(
        '.t706 [name="ozon_map_point_id"]',
      ) as HTMLInputElement
    )?.value;
    if (mapPointId) {
      updateOzonPrice(OZON_PICKUP_ID, mapPointId);
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
      updateCourierPrice(OZON_COURIER_ID, parseFloat(lat), parseFloat(lon));
    }
  }
}
