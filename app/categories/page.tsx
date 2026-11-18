"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Package,
  ArrowRight,
  ShoppingCart,
} from "lucide-react"
import HomeNavbar from "@/components/HomeNavBar"
import Navbar from "@/components/NavBar"

interface CategoryProduct {
  id: string
  name: string
  description: string | null
  price: string | number
  stock: number
  imageUrl: string
}

interface CategoryItem {
  id: string
  name: string
  slug: string
  products?: CategoryProduct[]
  _count?: {
    products: number
  }
}

// Safely parse JSON responses so HTML 404/500 pages never crash the UI
async function safeJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Server returned ${res.status} (${res.statusText}) instead of JSON`)
  }
  return res.json()
}

// Check if logged-in JWT belongs to an ADMIN
function checkIsAdmin(): boolean {
  if (typeof window === "undefined") return false
  const token = localStorage.getItem("token")
  if (!token) return false

  try {
    const base64Payload = token.split(".")[1]
    if (!base64Payload) return false
    const decoded = JSON.parse(atob(base64Payload))
    return decoded?.role === "ADMIN"
  } catch {
    return false
  }
}

export default function CategoriesPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Category Products Preview Modal (uses GET /api/categories/[id])
  const [activeCategory, setActiveCategory] = useState<CategoryItem | null>(null)
  const [loadingCategoryProducts, setLoadingCategoryProducts] = useState(false)

  // Admin Create / Edit Modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null)
  const [nameInput, setNameInput] = useState("")
  const [slugInput, setSlugInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const loadCategories = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/categories")
      const data = await safeJson<{
        success: boolean
        data?: CategoryItem[]
        error?: string
      }>(res)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load categories")
      }

      setCategories(data.data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    setIsAdmin(checkIsAdmin())
    loadCategories()
  }, [])

  // Fetch single category + its active products via GET /api/categories/[id]
  const handleInspectCategory = async (category: CategoryItem) => {
    setActiveCategory(category)
    setLoadingCategoryProducts(true)

    try {
      const res = await fetch(`/api/categories/${category.id}`)
      const data = await safeJson<{
        success: boolean
        data?: CategoryItem
        error?: string
      }>(res)

      if (res.ok && data.success && data.data) {
        setActiveCategory(data.data)
      }
    } catch (err) {
      console.error("Error loading category products:", err)
    } finally {
      setLoadingCategoryProducts(false)
    }
  }

  // Open Create or Edit modal (ADMIN)
  const openCreateModal = () => {
    setEditingCategory(null)
    setNameInput("")
    setSlugInput("")
    setFormError(null)
    setFormOpen(true)
  }

  const openEditModal = (e: React.MouseEvent, category: CategoryItem) => {
    e.stopPropagation()
    setEditingCategory(category)
    setNameInput(category.name)
    setSlugInput(category.slug)
    setFormError(null)
    setFormOpen(true)
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    if (!nameInput.trim()) {
      setFormError("Category name is required")
      return
    }

    setSubmitting(true)

    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : "/api/categories"
      const method = editingCategory ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: nameInput.trim(),
          ...(slugInput.trim() && { slug: slugInput.trim() }),
        }),
      })

      const data = await safeJson<{
        success: boolean
        data?: CategoryItem
        error?: string
      }>(res)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save category")
      }

      setFormOpen(false)
      showToast(
        editingCategory
          ? `Category "${nameInput.trim()}" updated`
          : `Category "${nameInput.trim()}" created`
      )
      await loadCategories()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save category")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCategory = async (e: React.MouseEvent, category: CategoryItem) => {
    e.stopPropagation()

    const confirmed = window.confirm(
      `Delete "${category.name}"? Products in this category will remain on the storefront uncategorized.`
    )
    if (!confirmed) return

    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    setDeletingId(category.id)
    setError(null)

    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await safeJson<{
        success: boolean
        message?: string
        error?: string
      }>(res)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete category")
      }

      showToast(`Deleted category "${category.name}"`)
      setCategories((prev) => prev.filter((c) => c.id !== category.id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete category")
    } finally {
      setDeletingId(null)
    }
  }

  const filteredCategories = categories.filter((cat) => {
    const q = searchTerm.toLowerCase()
    return (
      cat.name.toLowerCase().includes(q) ||
      cat.slug.toLowerCase().includes(q)
    )
  })

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Categories</h1>
            <p className="mt-1 text-sm text-gray-500">
              Browse collections or select a category to view available products.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={18} />
              New Category
            </button>
          )}
        </div>

        {/* Error & Toast Banners */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        {toastMessage && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 size={18} className="shrink-0" />
            {toastMessage}
          </div>
        )}

        {/* Search Input */}
        <div className="mb-8 relative max-w-md">
          <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Categories Grid */}
        {loading ? (
          <div className="flex h-64 items-center justify-center text-gray-500">
            <Loader2 className="mr-2 animate-spin" size={24} /> Loading categories...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCategories.map((cat) => {
              const productCount = cat._count?.products ?? 0

              return (
                <div
                  key={cat.id}
                  onClick={() => handleInspectCategory(cat)}
                  className="group flex cursor-pointer flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <FolderOpen size={20} />
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-gray-900 group-hover:text-blue-600">
                            {cat.name}
                          </h2>
                          <span className="text-xs text-gray-400">/{cat.slug}</span>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => openEditModal(e, cat)}
                            title="Edit category"
                            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-blue-600"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === cat.id}
                            onClick={(e) => handleDeleteCategory(e, cat)}
                            title="Delete category"
                            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            {deletingId === cat.id ? (
                              <Loader2 className="animate-spin" size={15} />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-3.5 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-gray-600">
                      <Package size={14} className="text-gray-400" />
                      {productCount} {productCount === 1 ? "product" : "products"}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                      View items <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              )
            })}

            {filteredCategories.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
                No categories found.
              </div>
            )}
          </div>
        )}

        {/* Category Products Modal (Public Preview) */}
        {activeCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {activeCategory.name}
                  </h2>
                  <p className="text-xs text-gray-500">/{activeCategory.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingCategoryProducts ? (
                  <div className="flex h-40 items-center justify-center text-gray-500">
                    <Loader2 className="mr-2 animate-spin" size={20} /> Loading products...
                  </div>
                ) : !activeCategory.products || activeCategory.products.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                    No active products in this category yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {activeCategory.products.map((prod) => (
                      <div
                        key={prod.id}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
                      >
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="h-16 w-16 shrink-0 rounded-md object-cover bg-gray-100"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-bold text-gray-900">
                            {prod.name}
                          </h4>
                          <p className="text-xs font-semibold text-blue-600">
                            ${Number(prod.price).toFixed(2)}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {prod.stock > 0 ? `${prod.stock} in stock` : "Out of stock"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t bg-gray-50 px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <ShoppingCart size={14} />
                  Shop All Products
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create / Edit Category Modal (ADMIN) */}
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingCategory ? "Edit Category" : "Create New Category"}
                </h2>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  <X size={20} />
                </button>
              </div>

              {formError && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                  <AlertCircle size={16} className="shrink-0" />
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Electronics"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Custom Slug (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="auto-generated-from-name"
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="w-1/2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-1/2 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="animate-spin" size={16} />}
                    {editingCategory ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}