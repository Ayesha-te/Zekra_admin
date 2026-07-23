export type Product = {
  id: string;
  name: string;
  imageUrl: string;
  imageUrls?: string[];
  sizes?: ProductSizeOption[];
  price: number;
  originalPrice?: number | null;
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
};

export type ProductSizeOption = {
  id?: string;
  label: string;
  price: number;
  originalPrice?: number | null;
};

export type DeliveryLocation = {
  id: string;
  name: string;
  charge: number;
  isActive?: boolean;
};

export type OrderStatus = "new" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

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
    preferredDate?: string;
    preferredTime?: string;
  };
  notes?: string;
  items: {
    productId?: string;
    id?: string;
    name: string;
    category?: string;
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
  };
  payment?: {
    method?: string;
    provider?: string;
    status?: string;
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
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
  if (!path) return "";
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
