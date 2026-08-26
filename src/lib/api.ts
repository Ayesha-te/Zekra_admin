export type Product = {
  id: string;
  name: string;
  imageUrl: string;
  imageUrls?: string[];
  image?: ProductImageMetadata | null;
  images?: ProductImageMetadata[];
  sizes?: ProductSizeOption[];
  price: number;
  originalPrice?: number | null;
  isComboPack?: boolean;
  comboProductIds?: string[];
  comboSize?: number | null;
  preparationHours?: number;
  tag?: string;
  description?: string;
  urlSlug?: string;
  metaTitle?: string;
  metaDescription?: string;
  imageAlt?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  redirectSlugs?: string[];
  isActive?: boolean;
  updatedAt?: string;
  category: "Cookies" | "Sweets" | "Rusk" | "Puff" | string;
  mainCategory?: string;
  subcategory?: string;
};

export type ProductImageMetadata = {
  url: string;
  path?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  isPrimary?: boolean;
};

export type ProductSizeOption = {
  id?: string;
  label: string;
  price: number;
  originalPrice?: number | null;
};

export type ProductCategory = {
  id: string;
  name: string;
  subcategories?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DeliveryLocation = {
  id: string;
  name: string;
  charge: number;
  isActive?: boolean;
};

export type Coupon = { id: string; code: string; percentageOff: number; isActive?: boolean; updatedAt?: string };
export type Driver = { id: string; name: string; username: string; contact: string; isActive?: boolean; updatedAt?: string };
export type PickupLocation = { id: string; name: string; address: string; contact: string; username: string; isActive?: boolean; createdAt?: string; updatedAt?: string };

export type OrderStatus = "new" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "completed" | "collected" | "cancelled";

export type AdminOrder = {
  id: string;
  status: OrderStatus;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  fulfillment: {
    type?: "delivery" | "pickup" | string;
    mode?: "delivery" | "pickup" | string;
    locationId?: string;
    locationName?: string;
    address?: string;
    pickupLocationId?: string;
    pickupLocation?: Omit<PickupLocation, "username"> | null;
    preferredDate?: string;
    preferredTime?: string;
  };
  notes?: string;
  items: {
    productId?: string;
    id?: string;
    name: string;
    category?: string;
    sizeId?: string;
    sizeLabel?: string;
    imageUrl?: string;
    quantity: number;
    unitPrice: number;
    lineTotal?: number;
  }[];
  totals: {
    currency?: string;
    subtotal?: number;
    delivery?: number;
    deliveryFee?: number;
    total?: number;
    discount?: number;
  };
  coupon?: { code: string; percentageOff: number } | null;
  timeline?: {
    preparationHours?: number;
    receivedAt?: string;
    confirmedAt?: string;
    makingStartedAt?: string;
    preparationEndsAt?: string;
    deliveryEndsAt?: string;
    estimatedCompletionAt?: string;
  };
  progressPercent?: number;
  statusHistory?: Array<{ status: OrderStatus | string; at: string }>;
  notification?: { status: "sent" | "skipped" | "failed"; reason?: string; id?: string };
  assignedDriver?: { id: string; name: string; contact: string } | null;
  assignedPickupLocation?: Omit<PickupLocation, "username"> | null;
  payment?: {
    method?: string;
    provider?: string;
    status?: string;
    currency?: string;
    amount?: number;
    paidAt?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  createdAt: string;
  updatedAt?: string;
};

export const API_BASE = import.meta.env.VITE_API_URL || "https://api.zekrasweets.com";

export function assetUrl(path: string) {
  if (!path) return "/favicon.png";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${freshApiPath(path, options)}`, {
    cache: "no-store",
    ...options,
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(body?.message || "Request failed");
  }

  return body as T;
}

export function productImageError(event: { currentTarget: HTMLImageElement }) {
  const image = event.currentTarget;
  if (!image.src.endsWith("/favicon.png")) image.src = "/favicon.png";
}

function freshApiPath(path: string, options: RequestInit) {
  const method = String(options.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return path;
  return `${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`;
}

export function fetchAdminOrders(token: string) {
  return apiFetch<AdminOrder[]>("/api/admin/orders", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateAdminOrderStatus(token: string, id: string, status: OrderStatus) {
  return apiFetch<AdminOrder>(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
}

export function fetchDriverOrders(token: string) {
  return apiFetch<AdminOrder[]>("/api/driver/orders", { headers: { Authorization: `Bearer ${token}` } });
}

export function fetchPickupOrders(token: string) { return apiFetch<AdminOrder[]>("/api/pickup-location/orders", { headers: { Authorization: `Bearer ${token}` } }); }
export function markPickupOrderCollected(token: string, id: string) { return apiFetch<AdminOrder>(`/api/pickup-location/orders/${encodeURIComponent(id)}/collected`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } }); }

export function markDriverOrderDelivered(token: string, id: string) {
  return apiFetch<AdminOrder>(`/api/driver/orders/${encodeURIComponent(id)}/delivered`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
}
