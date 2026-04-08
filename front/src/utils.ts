/**
 * Ожидание появления значения (polling)
 */
export function waitFor<T>(
  getter: () => T | null | undefined,
  cb: (val: T) => void,
  ms = 200,
  max = 75,
): void {
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

/**
 * Устанавливает hidden input для передачи через webhook
 */
export function setHiddenInput(name: string, value: string): void {
  let input = document.querySelector(
    `.t706 [name="${name}"]`,
  ) as HTMLInputElement | null;
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    const form = document.querySelector(".t706 form");
    if (form) form.appendChild(input);
  }
  input.value = value;
}

/**
 * Получает items корзины в формате для API
 */
export function getCartItems(): { sku: number; quantity: number }[] {
  const products = window.tcart?.products || [];
  console.log(
    "[OzonPatch] Raw cart products:",
    JSON.stringify(
      products.map((p) => ({
        name: p.name,
        sku: p.sku,
        externalid: p.externalid,
        uid: p.uid,
        options: p.options,
        quantity: p.quantity,
      })),
    ),
  );
  return products
    .map((p) => {
      const skuRaw = (p.sku || p.externalid || "").toString().trim();
      const skuNum = parseInt(skuRaw, 10);
      if (isNaN(skuNum)) return null;
      return {
        sku: skuNum,
        quantity: parseInt(String(p.quantity)) || 1,
      };
    })
    .filter((p): p is { sku: number; quantity: number } => p !== null);
}

/**
 * Получает телефон покупателя
 */
export function getPhone(): string {
  // Тильда хранит реальный телефон в js-phonemask-result
  const maskResult = document.querySelector(
    ".t706 .js-phonemask-result",
  ) as HTMLInputElement | null;
  if (maskResult?.value) {
    return maskResult.value.replace(/\D/g, "");
  }
  return (
    (
      document.querySelector('input[name="phone"]') as HTMLInputElement
    )?.value.replace(/\D/g, "") || ""
  );
}
