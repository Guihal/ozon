import type { PickupPointInfoItem, TildaPickupPoint } from "./types";

/**
 * Преобразует PickupPointInfoItem в формат Tilda
 * @param point - информация о точке самовывоза от Ozon API
 * @returns преобразованная точка в формате Tilda или null если точка отключена
 */
export function mapToTildaPickupPoint(
  point: PickupPointInfoItem,
): TildaPickupPoint | null {
  if (!point.enabled) return null;

  const dm = point.delivery_method;
  const { lat, long } = dm.coordinates;

  // Формируем строку режима работы из массива working_hours
  // Берём первый день как образец
  const workTime =
    dm.working_hours
      .slice(0, 1)
      .flatMap((wh) =>
        wh.periods.map(
          (p) =>
            `${String(p.min.hours).padStart(2, "0")}:${String(
              p.min.minutes,
            ).padStart(2, "0")}` +
            `–` +
            `${String(p.max.hours).padStart(2, "0")}:${String(
              p.max.minutes,
            ).padStart(2, "0")}`,
        ),
      )
      .join(", ") || "";

  return {
    id: String(dm.map_point_id),
    name: dm.name,
    address: dm.address,
    coordinates: [lat, long],
    workTime,
    phones: [], // Ozon не отдаёт телефоны в этом методе
    addressComment: dm.description ?? "",
    cash: "n", // Ozon не принимает наличные
    postalCode: "", // нет в ответе
  };
}
