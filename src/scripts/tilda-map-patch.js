(function () {
  const BACKEND = "https://orderinme.fvds.ru";

  function waitFor(getter, cb, ms = 200, max = 75) {
    let n = 0;
    const t = setInterval(() => {
      const val = getter();
      if (val) {
        clearInterval(t);
        cb(val);
      }
      if (++n >= max) clearInterval(t);
    }, ms);
  }

  let pendingMapToken = null;

  async function loadPointsForViewport(map, delivery) {
    const zoom = map.getZoom();

    if (zoom < 10) {
      delivery.mapAddPoints(null, [], null);
      return;
    }

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

      const points = await res.json();
      delivery.mapAddPoints(null, points, null);
    } catch (e) {
      console.warn("[OzonPatch] ошибка загрузки карты:", e);
    }
  }

  waitFor(
    () => window.tcart_newDelivery,
    (delivery) => {
      // Перехват mapInit — вешаем boundschange после создания карты
      const origMapInit = delivery.mapInit?.bind(delivery);
      delivery.mapInit = function (...args) {
        const result = origMapInit?.(...args);

        waitFor(
          () => window.t_delivery__map,
          (map) => {
            let debounce = null;
            map.events.add("boundschange", () => {
              clearTimeout(debounce);
              debounce = setTimeout(
                () => loadPointsForViewport(map, delivery),
                400,
              );
            });
            loadPointsForViewport(map, delivery);
          },
        );

        return result;
      };

      // Разделяем поиск и карту по наличию pattern в объекте
      delivery.getPickupList = function (params) {
        if ("pattern" in params) {
          // Текстовый поиск → бэк → searchbox
          fetch(
            `${BACKEND}/v1/delivery/pvz?q=${encodeURIComponent(params.pattern)}&limit=50`,
          )
            .then((r) => r.json())
            .then((data) => params.onDone(data.pvz ?? []))
            .catch(() => params.onFail?.());
        } else {
          // Инициализация карты → пустой массив, точки грузим сами
          params.onDone([]);
        }
      };

      console.log("[OzonPatch] Патч применён ✓");
    },
  );
})();
