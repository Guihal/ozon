/** Типы для глобальных объектов Тильды */

export interface TildaProduct {
  name?: string;
  sku?: string;
  externalid?: string;
  uid?: string;
  options?: unknown;
  quantity?: string | number;
}

export interface TildaCart {
  products: TildaProduct[];
}

export interface TildaDeliveryService {
  price?: number;
  days?: string;
}

export interface TildaDeliveryState {
  services: Record<string, TildaDeliveryService>;
  pickupList: TildaPickupPoint[];
  searchboxes: Record<string, { autocompleteAddress?: TildaPickupPoint[] }>;
  activeServiceUid: number | string | null;
  city: string | null;
}

export interface TildaPickupPoint {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number];
  workTime: string;
  phones: string[];
  addressComment: string;
  cash: string;
  postalCode: string;
}

export interface TildaDelivery {
  deliveryState: TildaDeliveryState;
  searchList: TildaPickupPoint[];
  changePickupHandler: (
    pointId: string,
    name: string,
    postalCode: string,
    wrapper: HTMLElement,
    address: string,
    coords: unknown,
  ) => void;
  changeSearchboxInputHandler: (
    t: unknown,
    r: HTMLElement | null,
    n: string,
  ) => void;
  getPickupList: (p: {
    pattern?: string;
    onDone: (list: TildaPickupPoint[]) => void;
  }) => void;
  mapInit: (...args: unknown[]) => unknown;
  mapAddPoints: (
    a: unknown,
    points: TildaPickupPoint[],
    wrapper: HTMLElement,
  ) => void;
  fillSearchList: (
    listEl: Element | null,
    points: TildaPickupPoint[],
    type: string,
  ) => void;
  choseSearchListItemHandler: (wrapper: HTMLElement, type: string) => void;
  selectDeliveryService: (...args: unknown[]) => void;
  onAddressChange: (e: Event) => void;
  saveTcartDelivery: () => void;
  getFullAddress: () => string;
  getInputValues: () => Record<string, string>;
}

export interface YandexMap {
  getZoom: () => number;
  getBounds: () => [[number, number], [number, number]];
  setBounds: (...args: unknown[]) => Promise<void>;
  geoObjects: { removeAll: () => void };
  events: { add: (event: string, handler: () => void) => void };
}

declare global {
  interface Window {
    tcart: TildaCart;
    tcart_newDelivery: TildaDelivery;
    tcart__errorHandler?: {
      show: (msg: string) => void;
      hide: () => void;
    };
    tcart__blockSubmitButton?: () => void;
    tcart__unblockSubmitButton?: () => void;
    tcart__preloader?: { show: () => void; hide: () => void };
    tcart__updateTotalProductsinCartObj?: () => void;
    tcart__cart_save?: () => void;
    t_delivery__map?: YandexMap;
  }
}
