import { api, ApiResponse } from "@/lib/apiClient"

export interface Category {
  id: string
  name: string
  slug?: string | null
  createdAt?: string
  updatedAt?: string
  product?: any[]
}

export interface CreateCategoryInput {
  name: string
  slug?: string
}

export interface UpdateCategoryInput {
  name?: string
  slug?: string
}


async function parseResponse<T>(res: Response, endpoint: string): Promise<T> {
  const contentType = res.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    return {
      success: false,
      error: `${endpoint} returned ${res.status} (${res.statusText}) instead of JSON`,
    } as T
  }
  return res.json()
}


export const categoryService = {
  // READ (All)
  async getAll():Promise<ApiResponse<Category[]>> {
    const res = await fetch("/api/categories")
    return parseResponse<{ success: boolean; data?: Category[]; error?: string }>(
      res,
      "GET /api/categories"
    )
  },

  // GET by ID
  async getById(id: string) {
    const res = await fetch(`/api/categories/${id}`)
    return parseResponse<{ success: boolean; data?: Category; error?: string }>(
      res,
      `GET /api/categories/${id}`
    )
  },

  // CREATE (Admin)
  create: (data: CreateCategoryInput): Promise<ApiResponse<Category>> => {
    return api.post<Category>("/api/categories", data)
  },

  // UPDATE (Admin)
  update: (id: string, data: UpdateCategoryInput): Promise<ApiResponse<Category>> => {
    return api.put<Category>(`/api/categories/${id}`, data)
  },

  // DELETE (Admin)
  delete: (id: string): Promise<ApiResponse<{ id: string }>> => {
    return api.delete<{ id: string }>(`/api/categories/${id}`)
  },
}
