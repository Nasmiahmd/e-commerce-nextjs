"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Filter,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Package,
  ShoppingCart,
  Zap,
  Upload,
  ImageIcon,
} from "lucide-react"
import HomeNavbar from "@/components/HomeNavBar"
import Navbar from "@/components/NavBar"

interface CategoryOption {
  id: string
  name: string
  slug: string
}

interface ProductItem {
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
  category?: CategoryOption | null
  user?: {
    id: string
    name: string
  }
}

interface CurrentUser {
  id: string | null
  role: "USER" | "SELLER" | "ADMIN" | null
}

// Safely parse JSON responses so HTML 404/500 pages never crash the UI
async function safeJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Server returned ${res.status} (${res.statusText}) instead of JSON`)
  }
  return res.json()
}

// Decode user ID and role from JWT stored in localStorage
function getCurrentUser(): CurrentUser {
  if (typeof window === "undefined") return { id: null, role: null }
  const token = localStorage.getItem("token")
  if (!token) return { id: null, role: null }

  try {
    const base64Payload = token.split(".")[1]
    if (!base64Payload) return { id: null, role: null }
    const decoded = JSON.parse(atob(base64Payload))
    return {
      id: decoded?.id || decoded?.userId || decoded?.sub || null,
      role: decoded?.role || null,
    }
  } catch {
    return { id: null, role: null }
  }
}

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductItem[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser>({ id: null, role: null })

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [inStockOnly, setInStockOnly] = useState(false)
  const [myProductsOnly, setMyProductsOnly] = useState(false)

  // Feedback banners
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Create / Edit Product Modal (SELLER & ADMIN)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [nameInput, setNameInput] = useState("")
  const [descriptionInput, setDescriptionInput] = useState("")
  const [priceInput, setPriceInput] = useState("")
  const [stockInput, setStockInput] = useState("0")
  const [categoryIdInput, setCategoryIdInput] = useState("")
  const [imageUrlInput, setImageUrlInput] = useState("")
  const [imagePublicIdInput, setImagePublicIdInput] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const isSellerOrAdmin =
    currentUser.role === "SELLER" || currentUser.role === "ADMIN"

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [prodRes, catRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories"),
      ])

      const prodData = await safeJson<{
        success: boolean
        data?: ProductItem[]
        error?: string
      }>(prodRes)

      if (!prodRes.ok || !prodData.success) {
        throw new Error(prodData.error || "Failed to load products")
      }
      setProducts(prodData.data || [])

      const catData = await safeJson<{
        success: boolean
        data?: CategoryOption[]
        error?: string
      }>(catRes)

      if (catRes.ok && catData.success) {
        setCategories(catData.data || [])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    setCurrentUser(getCurrentUser())
    loadData()
  }, [])

  // Check if current user owns the product or is ADMIN
  const canManageProduct = (product: ProductItem) => {
    if (!currentUser.id) return false
    if (currentUser.role === "ADMIN") return true
    return currentUser.role === "SELLER" && product.userId === currentUser.id
  }

  // Open Create modal
  const openCreateModal = () => {
    setEditingProduct(null)
    setNameInput("")
    setDescriptionInput("")
    setPriceInput("")
    setStockInput("1")
    setCategoryIdInput("")
    setImageUrlInput("")
    setImagePublicIdInput("")
    setFormError(null)
    setFormOpen(true)
  }

  // Open Edit modal prefilled with existing product data
  const openEditModal = (product: ProductItem) => {
    setEditingProduct(product)
    setNameInput(product.name)
    setDescriptionInput(product.description || "")
    setPriceInput(String(product.price))
    setStockInput(String(product.stock))
    setCategoryIdInput(product.categoryId || "")
    setImageUrlInput(product.imageUrl)
    setImagePublicIdInput(product.imagePublicId || "")
    setFormError(null)
    setFormOpen(true)
  }

  // Upload image file to Cloudinary via /api/upload
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    setUploadingImage(true)
    setFormError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const json = await safeJson<{
        success: boolean
        data?: { url: string; publicId?: string }
        error?: string
      }>(res)

      if (!res.ok || !json.success || !json.data?.url) {
        throw new Error(json.error || "Image upload failed")
      }

      setImageUrlInput(json.data.url)
      if (json.data.publicId) {
        setImagePublicIdInput(json.data.publicId)
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Image upload failed")
    } finally {
      setUploadingImage(false)
      e.target.value = ""
    }
  }

  // Submit Create (POST) or Edit (PUT)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    const numericPrice = Number(priceInput)
    const numericStock = Number(stockInput)

    if (!nameInput.trim()) {
      setFormError("Product name is required")
      return
    }
    if (priceInput === "" || Number.isNaN(numericPrice) || numericPrice < 0) {
      setFormError("Enter a valid non-negative price")
      return
    }
    if (!Number.isInteger(numericStock) || numericStock < 0) {
      setFormError("Stock must be a valid non-negative integer")
      return
    }
    if (!imageUrlInput.trim()) {
      setFormError("Product image URL is required")
      return
    }

    setSubmitting(true)

    try {
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : "/api/products"
      const method = editingProduct ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: nameInput.trim(),
          description: descriptionInput.trim() || null,
          price: numericPrice,
          stock: numericStock,
          categoryId: categoryIdInput || null,
          imageUrl: imageUrlInput.trim(),
          imagePublicId: imagePublicIdInput.trim() || null,
        }),
      })

      const data = await safeJson<{
        success: boolean
        data?: ProductItem
        error?: string
      }>(res)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save product")
      }

      setFormOpen(false)
      showToast(
        editingProduct
          ? `Updated "${nameInput.trim()}"`
          : `Created "${nameInput.trim()}"`
      )
      await loadData()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save product")
    } finally {
      setSubmitting(false)
    }
  }

  // Delete or Archive product (DELETE /api/products/[id])
  const handleDeleteProduct = async (product: ProductItem) => {
    const confirmed = window.confirm(
      `Delete "${product.name}"? Products with past orders will be archived automatically.`
    )
    if (!confirmed) return

    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    setDeletingId(product.id)
    setError(null)

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await safeJson<{
        success: boolean
        archived?: boolean
        message?: string
        error?: string
      }>(res)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete product")
      }

      showToast(data.message || `Removed "${product.name}"`)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete product")
    } finally {
      setDeletingId(null)
    }
  }

  // Add to cart (Buyer action)
  const handleAddToCart = async (product: ProductItem) => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    setAddingId(product.id)
    setError(null)

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      })

      const data = await safeJson<{ success: boolean; error?: string }>(res)
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add item to cart")
      }

      showToast(`Added "${product.name}" to your cart`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add to cart")
    } finally {
      setAddingId(null)
    }
  }

  const handleDirectBuy = (product: ProductItem) => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }
    router.push(`/checkout?productId=${product.id}&qty=1`)
  }

  const filteredProducts = products.filter((item) => {
    if (item.isArchived) return false
    if (myProductsOnly && currentUser.id && item.userId !== currentUser.id) {
      return false
    }
    if (inStockOnly && item.stock <= 0) return false
    if (selectedCategory && item.categoryId !== selectedCategory) return false

    const q = searchTerm.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q) ?? false)
    )
  })

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {currentUser.id ? <Navbar /> : <HomeNavbar />}

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products Catalog</h1>
            <p className="mt-1 text-sm text-gray-500">
              {isSellerOrAdmin
                ? "Browse the marketplace or manage your listed products."
                : "Explore all available products across categories."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentUser.id && (
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                Dashboard
              </button>
            )}

            {isSellerOrAdmin && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus size={18} />
                New Product
              </button>
            )}
          </div>
        </div>

        {/* Error & Toast Banners */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        {toastMessage && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0" />
              {toastMessage}
            </span>
            <button
              type="button"
              onClick={() => router.push("/cart")}
              className="font-semibold underline hover:text-green-900"
            >
              View Cart
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 sm:w-56">
              <Filter size={18} className="shrink-0 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              In Stock Only
            </label>

            {currentUser.role === "SELLER" && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={myProductsOnly}
                  onChange={(e) => setMyProductsOnly(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                My Listings
              </label>
            )}
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="flex h-80 items-center justify-center text-gray-500">
            <Loader2 className="mr-2 animate-spin" size={24} /> Loading products...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((item) => {
              const outOfStock = item.stock <= 0
              const ownerOrAdmin = canManageProduct(item)

              return (
                <div
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="relative h-52 w-full bg-gray-100">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                    {item.category && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-800 shadow-sm">
                        {item.category.name}
                      </span>
                    )}
                    {outOfStock && (
                      <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
                        Out of Stock
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-base font-bold text-gray-900">
                          {item.name}
                        </h2>
                        <span className="text-base font-extrabold text-blue-600">
                          ${Number(item.price).toFixed(2)}
                        </span>
                      </div>

                      {item.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">
                          {item.description}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Package size={14} />
                          {outOfStock ? "Unavailable" : `${item.stock} in stock`}
                        </span>
                        {item.user?.name && (
                          <span className="max-w-[140px] truncate">
                            by {item.user.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Owner/Admin Management Controls */}
                    {ownerOrAdmin && (
                      <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="flex w-1/2 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-gray-50 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDeleteProduct(item)}
                          className="flex w-1/2 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Delete
                        </button>
                      </div>
                    )}

                    {/* Buyer Purchase Controls */}
                    <div className="mt-3 flex items-center gap-2.5 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        disabled={outOfStock || addingId === item.id}
                        onClick={() => handleAddToCart(item)}
                        className="flex w-1/2 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {addingId === item.id ? (
                          <Loader2 className="animate-spin" size={15} />
                        ) : (
                          <ShoppingCart size={15} />
                        )}
                        Add to Cart
                      </button>

                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => handleDirectBuy(item)}
                        className="flex w-1/2 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Zap size={15} />
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
                No matching products found.
              </div>
            )}
          </div>
        )}

        {/* Create / Edit Product Modal (SELLER & ADMIN) */}
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingProduct ? "Edit Product" : "Add New Product"}
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

              <form onSubmit={handleSaveProduct} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g., Wireless Mechanical Keyboard"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    placeholder="Key specs, condition, or details..."
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                      Price ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      placeholder="49.99"
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                      Stock *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={stockInput}
                      onChange={(e) => setStockInput(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Category
                  </label>
                  <select
                    value={categoryIdInput}
                    onChange={(e) => setCategoryIdInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cloudinary File Upload + Direct URL Input */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Product Image *
                  </label>

                  <div className="mt-1 flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100">
                      {uploadingImage ? (
                        <Loader2 className="animate-spin" size={15} />
                      ) : (
                        <Upload size={15} />
                      )}
                      {uploadingImage ? "Uploading..." : "Upload File"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-gray-400">
                      or paste Cloudinary URL below
                    </span>
                  </div>

                  <div className="relative mt-2">
                    <ImageIcon
                      className="absolute left-3 top-3 text-gray-400"
                      size={16}
                    />
                    <input
                      type="url"
                      required
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://res.cloudinary.com/..."
                      className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {imageUrlInput && (
                    <img
                      src={imageUrlInput}
                      alt="Preview"
                      className="mt-2 h-32 w-full rounded-lg border border-gray-200 object-cover"
                    />
                  )}
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
                    disabled={submitting || uploadingImage}
                    className="flex w-1/2 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="animate-spin" size={16} />}
                    {editingProduct ? "Save Changes" : "Create Product"}
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