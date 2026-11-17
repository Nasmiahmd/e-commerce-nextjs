// src/services/resourceService.ts
import { api, ApiResponse } from "@/lib/apiClient"

export interface Product {
  id: string
  name: string
  description?: string | null
  price: number
  imageUrl?: string | null
  categoryId: string
  category?: {
    id: string
    name: string
    description?: string | null
    imageUrl?: string | null
  }
  createdAt?: string
  updatedAt?: string
}

export interface CreateProductInput {
  name: string
  description?: string
  price: number
  stock: number
  categoryId: string
  imageUrl?: string
}

export interface UpdateProductInput {
  name?: string
  description?: string
  price?: number
  stock?: number
  categoryId?: string
  imageUrl?: string
}

export const productService = {
  getAll: (): Promise<ApiResponse<Product[]>> => {
    return api.get<Product[]>("/api/resources")
  },
  getById: (id: string): Promise<ApiResponse<Product>> => {
    return api.get<Product>(`/api/resources/${id}`)
  },
  create: (data: CreateProductInput): Promise<ApiResponse<Product>> => {
    return api.post<Product>("/api/resources", data)
  },
  update: (id: string, data: UpdateProductInput): Promise<ApiResponse<Product>> => {
    return api.put<Product>(`/api/resources/${id}`, data)
  },
  delete: (id: string): Promise<ApiResponse<{ id: string }>> => {
    return api.delete<{ id: string }>(`/api/resources/${id}`)
  },
}