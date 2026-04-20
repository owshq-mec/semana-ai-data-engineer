import type { Category, Product, ProductDetail } from "./types";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8010";

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function getFeatured(): Promise<Product[]> {
  return fetchJSON<Product[]>("/commerce/featured");
}

export async function getTrending(): Promise<Product[]> {
  return fetchJSON<Product[]>("/commerce/trending");
}

export async function getCategories(): Promise<Category[]> {
  return fetchJSON<Category[]>("/commerce/categories");
}

export async function getProducts(params: {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
} = {}): Promise<{ items: Product[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  if (params.category) qs.set("category", params.category);
  if (params.search) qs.set("search", params.search);
  return fetchJSON<{ items: Product[]; total: number }>(`/commerce/products?${qs}`);
}

export async function getProduct(id: string): Promise<ProductDetail> {
  return fetchJSON<ProductDetail>(`/commerce/products/${id}`);
}
