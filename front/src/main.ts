/**
 * Ozon Tilda Patch — точка входа
 * Перехватывает доставку Tilda и подключает Ozon Logistics API
 */
import "./types";
import { waitFor } from "./utils";
import { updatePurchaseButton } from "./state";
import { initPhoneListeners } from "./phone";
import { patchPickupHandler } from "./pickup";
import { patchSearchHandler, patchGetPickupList, patchMapInit } from "./map";
import { initCourier } from "./courier";
import { initCartPolling } from "./cart-polling";
import type { TildaDelivery } from "./types";

waitFor(
  () => window.tcart_newDelivery,
  (delivery: TildaDelivery) => {
    // 1. Патч выбора ПВЗ
    patchPickupHandler(delivery);

    // 2. Патч поиска ПВЗ
    patchSearchHandler(delivery);

    // 3. Заглушка штатной загрузки ПВЗ
    patchGetPickupList(delivery);

    // 4. Патч инициализации карты
    patchMapInit(delivery);

    // 5. Проверка телефона
    initPhoneListeners();

    // 6. Блокируем кнопку при инициализации
    updatePurchaseButton();

    // 7. Cart polling
    initCartPolling();

    // 8. Курьерская доставка
    initCourier(delivery);

    console.log("[OzonPatch] V6 — modular TS build ✓");
  },
);
