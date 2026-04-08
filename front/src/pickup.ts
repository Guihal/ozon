/**
 * Патч changePickupHandler — выбор ПВЗ на карте/из списка
 */
import { OZON_PICKUP_ID } from "./config";
import { ozonState, updatePurchaseButton } from "./state";
import { setHiddenInput } from "./utils";
import { updateOzonPrice } from "./checkout";
import type { TildaDelivery } from "./types";

export function patchPickupHandler(delivery: TildaDelivery): void {
  const origChangePickup = delivery.changePickupHandler;
  delivery.changePickupHandler = function (
    this: TildaDelivery,
    pointId: string,
    name: string,
    postalCode: string,
    wrapper: HTMLElement,
    address: string,
    coords: unknown,
  ) {
    origChangePickup.apply(this, [
      pointId,
      name,
      postalCode,
      wrapper,
      address,
      coords,
    ]);

    setHiddenInput("ozon_map_point_id", pointId || "");
    setHiddenInput("ozon_delivery_type", "pickup");

    const nameInput = document.querySelector(
      '.t706 [name="tildadelivery-pickup-name"]',
    ) as HTMLInputElement | null;
    const addrInput = document.querySelector(
      '.t706 [name="tildadelivery-pickup-address"]',
    ) as HTMLInputElement | null;

    if (nameInput && name) {
      nameInput.value = name;
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (addrInput && address) {
      addrInput.value = address;
      addrInput.dispatchEvent(new Event("input", { bubbles: true }));
      addrInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    window.tcart__cart_save?.();

    ozonState.deliverySelected = !!pointId;
    ozonState.deliveryType = "pickup";
    ozonState.checkoutFailedOnce = false;
    updatePurchaseButton();

    updateOzonPrice(OZON_PICKUP_ID, pointId);
  };
}
