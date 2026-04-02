// Types for Ozon Logistics Platform API responses

// --- Ozon API Response Types ---

export interface OzonAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface OzonDeliveryVariant {
  id: string;
  name: string;
  deliveryType: "PickPoint" | "Courier";
  carrier?: string;
  price?: number;
  time?: {
    min: number;
    max: number;
  };
}

export interface OzonCity {
  id: string;
  name: string;
  prepositionalName?: string;
  region?: string;
}

export interface OzonCitiesResponse {
  cities: OzonCity[];
}

export interface OzonPackageDimensions {
  weight: number;
  length: number;
  height: number;
  width: number;
}

export interface OzonPackage {
  count: number;
  dimensions: OzonPackageDimensions;
  price: number;
}

export interface OzonVariantsByAddressRequest {
  deliveryType: "PickPoint" | "Courier";
  address: string;
  radius?: number;
  packages: OzonPackage[];
}

export interface OzonVariantsByAddressResponse {
  variants: OzonDeliveryVariant[];
}

export interface OzonCalculateResponse {
  price: number;
  currency: string;
  deliveryVariantId: string;
  fromPlaceId: string;
}

export interface OzonTimeResponse {
  minDays: number;
  maxDays: number;
}

export interface OzonErrorResponse {
  errorCode: string;
  message: string;
  arguments?: Record<string, string[]>[];
}

// --- Our API Request/Response Types ---

export interface CalculateDeliveryRequest {
  address: string;
  packages: {
    weight: number;
    length: number;
    height: number;
    width: number;
    price: number;
  }[];
}

export interface DeliveryOption {
  variantId: string;
  name: string;
  deliveryType: "pickup" | "address";
  price: number;
  currency: string;
  days: {
    min: number;
    max: number;
  };
  address?: string;
  pickupPointId?: string;
}

export interface CalculateResponse {
  options: DeliveryOption[];
}

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city: string;
}

export interface PickupPointsResponse {
  pickupPoints: PickupPoint[];
}

export interface City {
  id: string;
  name: string;
}

export interface CitiesResponse {
  cities: City[];
}

// --- Delivery Check Types ---

export interface CheckDeliveryRequest {
  client_phone: string;
}

export interface CheckDeliveryResponse {
  is_possible: boolean;
}

// --- Pickup Points List Types ---

export interface PickupPointCoordinate {
  lat: number;
  long: number;
}

export interface PickupPointItem {
  coordinate: PickupPointCoordinate;
  map_point_id: number;
}

export interface PickupPointsListResponse {
  points: PickupPointItem[];
}

// --- Pickup Point Info Types ---

export interface PickupPointInfoRequest {
  map_point_ids: string[];
}

export interface PickupPointAddressDetails {
  city: string;
  house: string;
  region: string;
  street: string;
}

export interface PickupPointDeliveryType {
  id: number;
  name: string;
}

export interface PickupPointTimeBounds {
  hours: number;
  minutes: number;
}

export interface PickupPointWorkingPeriod {
  max: PickupPointTimeBounds;
  min: PickupPointTimeBounds;
}

export interface PickupPointWorkingHours {
  date: string;
  periods: PickupPointWorkingPeriod[];
}

export interface PickupPointHoliday {
  begin: string;
  end: string;
}

export interface PickupPointProperty {
  enabled: boolean;
  name: string;
}

export interface PickupPointDeliveryMethod {
  address: string;
  address_details: PickupPointAddressDetails;
  coordinates: PickupPointCoordinate;
  delivery_type: PickupPointDeliveryType;
  description: string;
  fitting_rooms_count: number;
  holidays: PickupPointHoliday[];
  holidays_filled: boolean;
  images: string[];
  location_id: string;
  map_point_id: number;
  name: string;
  properties: PickupPointProperty[];
  pvz_rating: number;
  storage_period: number;
  working_hours: PickupPointWorkingHours[];
}

export interface PickupPointInfoItem {
  delivery_method: PickupPointDeliveryMethod;
  enabled: boolean;
}

export interface PickupPointsInfoResponse {
  points: PickupPointInfoItem[];
}

// --- Tilda Integration Types ---

export interface TildaPickupPoint {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [lat, lng]
  workTime: string;
  phones: string[];
  addressComment: string;
  cash: "y" | "n";
  postalCode: string;
}
