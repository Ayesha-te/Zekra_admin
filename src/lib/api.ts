export type Product = {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  originalPrice?: number | null;
  tag?: string;
  description?: string;
  urlSlug?: string;
  metaTitle?: string;
  metaDescription?: string;
  imageAlt?: string;
  isActive?: boolean;
  category: "Cookies" | "Sweets" | "Rusk" | "Puff" | string;
};

export type DeliveryLocation = {
  id: string;
  name: string;
  charge: number;
  isActive?: boolean;
};

export const API_BASE = import.meta.env.VITE_API_URL || "https://api.zekrasweets.com";

export function assetUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(body?.message || "Request failed");
  }

  return body as T;
}
