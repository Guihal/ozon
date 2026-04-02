(function () {
  const BACKEND = "https://your-backend.com";

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

  let pendingRequest = null;

  async function loadPointsForViewport(map, delivery) {
    const zoom = map.getZoom();

    if (zoom < 10) {
      delivery.mapAddPoints([]);
      return;
    }

    const bounds = map.getBounds();
    const token = Symbol(); // уникальный токен для отмены устаревших запросов
    pendingRequest = token;

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

      // Карта уже сдвинулась пока ждали — выбрасываем ответ
      if (pendingRequest !== token) return;

      const points = await res.json();
      delivery.mapAddPoints(points);
    } catch (e) {
      console.warn("[OzonPatch] ошибка загрузки карты:", e);
    }
  }

  waitFor(
    () => window.tcart_newDelivery,
    (delivery) => {
      // Перехватываем mapInit — вешаем boundschange после создания карты
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

            // Загружаем сразу для начального viewport
            loadPointsForViewport(map, delivery);
          },
        );

        return result;
      };

      // getPickupList — текстовый поиск идёт на бэк, без pattern — пусто
      // карта сама загрузит точки через boundschange
      delivery.getPickupList = function (params) {
        if (params.pattern) {
          const url = `${BACKEND}/v1/delivery/pvz?q=${encodeURIComponent(params.pattern)}&limit=50`;
          fetch(url)
            .then((r) => r.json())
            .then((data) => params.onDone(data.pvz ?? []))
            .catch(() => params.onFail?.());
        } else {
          params.onDone([]);
        }
      };

      console.log("[OzonPatch] Патч применён ✓");
    },
  );
})();
