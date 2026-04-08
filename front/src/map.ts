/**
 * Карта ПВЗ — загрузка точек, поиск, инициализация
 */
import { BACKEND } from "./config";
import type { TildaDelivery, TildaPickupPoint, YandexMap } from "./types";
import { waitFor } from "./utils";

let pendingMapToken: symbol | null = null;
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

function mergePickupList(
  delivery: TildaDelivery,
  newPoints: TildaPickupPoint[],
): void {
  const existing = delivery.deliveryState.pickupList || [];
  const map = new Map<string, TildaPickupPoint>();
  for (const p of existing) map.set(String(p.id), p);
  for (const p of newPoints) map.set(String(p.id), p);
  delivery.deliveryState.pickupList = Array.from(map.values());
}

async function loadPointsForViewport(
  map: YandexMap,
  delivery: TildaDelivery,
): Promise<void> {
  const zoom = map.getZoom();
  if (zoom < 10) return;

  const bounds = map.getBounds();
  const token = Symbol();
  pendingMapToken = token;

  try {
    const res = await fetch(`${BACKEND}/v1/delivery/map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewport: {
          left_bottom: { lat: bounds[0][0], long: bounds[0][1] },
          right_top: { lat: bounds[1][0], long: bounds[1][1] },
        },
        zoom,
      }),
    });

    if (pendingMapToken !== token) return;
    const points: TildaPickupPoint[] = await res.json();

    mergePickupList(delivery, points);

    // Обновляем autocompleteAddress для поиска по тексту
    const sb = document.getElementById("pickup-searchbox");
    if (sb) {
      const sbId = sb.getAttribute("id")!;
      if (!delivery.deliveryState.searchboxes[sbId])
        delivery.deliveryState.searchboxes[sbId] = {};
      const existing =
        delivery.deliveryState.searchboxes[sbId].autocompleteAddress || [];
      const map2 = new Map<string, TildaPickupPoint>();
      for (const p of existing) map2.set(String(p.id), p);
      for (const p of points) map2.set(String(p.id), p);
      delivery.deliveryState.searchboxes[sbId].autocompleteAddress = Array.from(
        map2.values(),
      );
    }

    const deliveryWrapper =
      document.getElementById("pickup-searchbox") ||
      document.getElementById("customdelivery") ||
      document.querySelector(".t-radio__wrapper-delivery");

    if (!deliveryWrapper) {
      console.error("[OzonPatch] Не удалось найти контейнер доставки");
      return;
    }

    // Отключаем прыжки камеры
    const originalSetBounds = map.setBounds;
    map.setBounds = () => Promise.resolve();

    const geoObjects = map.geoObjects;
    if (geoObjects) geoObjects.removeAll();

    delivery.mapAddPoints(null, points, deliveryWrapper as HTMLElement);

    setTimeout(() => {
      map.setBounds = originalSetBounds;
    }, 150);
  } catch (e) {
    console.warn("[OzonPatch] Ошибка загрузки точек:", e);
  }
}

/**
 * Патч changeSearchboxInputHandler — перехват поиска ПВЗ
 */
export function patchSearchHandler(delivery: TildaDelivery): void {
  const origSearch = delivery.changeSearchboxInputHandler;
  delivery.changeSearchboxInputHandler = function (
    this: TildaDelivery,
    t: unknown,
    r: HTMLElement | null,
    n: string,
  ) {
    const input = r?.querySelector(
      ".searchbox-input",
    ) as HTMLInputElement | null;
    const sbId = r?.getAttribute("id") ?? null;

    if (n !== "pickup" || !input || input.value.trim().length < 3) {
      return origSearch.apply(this, [t, r, n]);
    }

    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      fetch(`${BACKEND}/v1/delivery/pvz?q=${encodeURIComponent(input.value)}`)
        .then((resp) => resp.json())
        .then((data) => {
          const points: TildaPickupPoint[] = data.pvz || [];

          r!.classList.remove("load");
          input.readOnly = false;

          if (points.length === 0) {
            const listEl = r!.querySelector(".searchbox-list");
            if (listEl) {
              listEl.innerHTML =
                '<div class="searchbox-list-item t-text" style="user-select: none; pointer-events: none;">Ничего не найдено</div>';
            }
            return;
          }

          if (sbId) {
            if (!this.deliveryState.searchboxes[sbId])
              this.deliveryState.searchboxes[sbId] = {};
            this.deliveryState.searchboxes[sbId].autocompleteAddress = points;
          }
          this.searchList = points;
          mergePickupList(this, points);

          const listEl = r!.querySelector(".searchbox-list");
          this.fillSearchList(listEl, points, "pickup");
          this.choseSearchListItemHandler(r!, n);
        })
        .catch((err) => {
          console.warn("[OzonPatch] Search error:", err);
          r!.classList.remove("load");
          input.readOnly = false;
        });
    }, 400);
  };
}

/**
 * Заглушка getPickupList — Тильда не грузит ПВЗ через свой API
 */
export function patchGetPickupList(delivery: TildaDelivery): void {
  delivery.getPickupList = (p) => {
    if (!("pattern" in p)) {
      p.onDone([]);
    }
  };
}

/**
 * Патч инициализации карты
 */
export function patchMapInit(delivery: TildaDelivery): void {
  const origMapInit = delivery.mapInit;
  delivery.mapInit = function (this: TildaDelivery, ...args: unknown[]) {
    const res = origMapInit.apply(this, args);
    waitFor(
      () => window.t_delivery__map,
      (map) => {
        let boundsDebounce: ReturnType<typeof setTimeout> | null = null;
        map.events.add("boundschange", () => {
          if (boundsDebounce) clearTimeout(boundsDebounce);
          boundsDebounce = setTimeout(
            () => loadPointsForViewport(map, delivery),
            700,
          );
        });
        loadPointsForViewport(map, delivery);
      },
    );
    return res;
  };
}
