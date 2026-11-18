// services/product.service.ts

export interface Product {
  id: string
  name: string
  description: string | null
  price: string | number
  stock: number
  imageUrl: string
  imagePublicId?: string | null
  isArchived: boolean
  userId: string
  categoryId: string | null
  category?: {
    id: string
    name: string
    slug: string
  } | null
  user?: {
    id: string
    name: string
  }
}

export interface ProductPayload {
  name: string
  description?: string | null
  price: number
  stock?: number
  categoryId?: string | null
  imageUrl: string
  imagePublicId?: string | null
  isArchived?: boolean
}

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

async function safeParse<T>(res: Response, endpoint: string): Promise<T> {
  const contentType = res.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    return {
      success: false,
      error: `${endpoint} returned ${res.status} (${res.statusText}) instead of JSON`,
    } as T
  }
  return res.json()
}

export const productService = {
  async getAll(params?: { category?: string; categoryId?: string; search?: string }) {
    const query = new URLSearchParams()
    if (params?.category) query.set("category", params.category)
    if (params?.categoryId) query.set("categoryId", params.categoryId)
    if (params?.search) query.set("search", params.search)

    const qs = query.toString()
    const url = `/api/products${qs ? `?${qs}` : ""}`
    const res = await fetch(url)
    return safeParse<{ success: boolean; data?: Product[]; error?: string }>(
      res,
      `GET ${url}`
    )
  },

  async getById(id: string) {
    const res = await fetch(`/api/products/${id}`)
    return safeParse<{ success: boolean; data?: Product; error?: string }>(
      res,
      `GET /api/products/${id}`
    )
  },

  async create(payload: ProductPayload) {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    return safeParse<{ success: boolean; data?: Product; error?: string }>(
      res,
      "POST /api/products"
    )
  },

  async update(id: string, payload: Partial<ProductPayload>) {
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    return safeParse<{ success: boolean; data?: Product; error?: string }>(
      res,
      `PUT /api/products/${id}`
    )
  },

  async delete(id: string) {
    const res = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    return safeParse<{ success: boolean; message?: string; error?: string }>(
      res,
      `DELETE /api/products/${id}`
    )
  },
}