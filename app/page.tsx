// app/page.tsx
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Filter,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  Zap,
  Package,
  Plus,
  Minus,
  RotateCcw,
} from "lucide-react"
import HomeNavbar from "@/components/HomeNavBar"
import { productService, Product } from "@/services/product.service"
import { categoryService, Category } from "@/services/category.service"

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function formatPrice(value: string | number): string {
  const num = Number(value)
  return Number.isNaN(num) ? "$0.00" : priceFormatter.format(num)
}

export default function Home() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [inStockOnly, setInStockOnly] = useState(false)

  // Product Quick-View Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [addingId, setAddingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [productData, catData] = await Promise.all([
        productService.getAll(),
        categoryService.getAll(),
      ])

      if (productData.success && productData.data) {
        setProducts(productData.data)
      } else {
        setError(productData.error || "Failed to load products")
      }

      if (catData.success && catData.data) {
        setCategories(catData.data)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load storefront data")
    } finally {
      setLoading(false)
    }
  }, [])

  // Redirect authenticated users immediately to /dashboard; otherwise load storefront
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      router.replace("/dashboard")
      return
    }

    setCheckingAuth(false)
    loadData()
  }, [router, loadData])

  // Auto-dismiss toast with cleanup so rapid clicks never overlap timers
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [toastMessage])

  // Close Quick-View modal on Escape key
  useEffect(() => {
    if (!selectedProduct) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedProduct(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedProduct])

  // Memoized filtering across search text, category, stock, and archive status
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return products.filter((item) => {
      if (item.isArchived) return false
      if (inStockOnly && item.stock <= 0) return false
      if (selectedCategory && item.categoryId !== selectedCategory) return false

      if (!query) return true
      return (
        item.name.toLowerCase().includes(query) ||
        (item.description?.toLowerCase().includes(query) ?? false)
      )
    })
  }, [products, searchTerm, selectedCategory, inStockOnly])

  // Keep early return AFTER all hooks to obey React's Rules of Hooks
  if (checkingAuth) return null

  const hasActiveFilters = Boolean(searchTerm.trim() || selectedCategory || inStockOnly)

  const resetFilters = () => {
    setSearchTerm("")
    setSelectedCategory("")
    setInStockOnly(false)
  }

  const handleAddToCart = async (product: Product, qty = 1) => {
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
        body: JSON.stringify({ productId: product.id, quantity: qty }),
      })

      if (res.status === 401) {
        localStorage.removeItem("token")
        router.push("/login")
        return
      }

      const contentType = res.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Cart API returned ${res.status} (${res.statusText})`)
      }

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add item to cart")
      }

      setToastMessage(`Added "${product.name}" (×${qty}) to your cart`)
      setSelectedProduct(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add to cart")
    } finally {
      setAddingId(null)
    }
  }

  const handleDirectBuy = (product: Product, qty = 1) => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    router.push(`/checkout?productId=${product.id}&qty=${qty}`)
  }

  const openQuickView = (product: Product) => {
    setSelectedProduct(product)
    setQuantity(1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HomeNavbar />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            <span className="flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              {error}
            </span>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1 font-semibold underline hover:text-red-800"
            >
              <RotateCcw size={14} /> Retry
            </button>
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

        {/* Filter Controls */}
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search products by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-11 pr-9 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-2.5 rounded p-0.5 text-gray-400 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 sm:w-60">
              <Filter size={18} className="shrink-0 text-gray-400" />
              <select
                aria-label="Filter by category"
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

            <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              In Stock Only
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm animate-pulse"
              >
                <div className="h-56 w-full bg-gray-200" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-100" />
                  <div className="h-3 w-1/3 rounded bg-gray-100" />
                  <div className="mt-4 flex gap-2 pt-3">
                    <div className="h-9 w-1/2 rounded-lg bg-gray-200" />
                    <div className="h-9 w-1/2 rounded-lg bg-gray-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((item) => {
              const outOfStock = item.stock <= 0

              return (
                <article
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  {/* Cloudinary Product Image */}
                  <div
                    onClick={() => openQuickView(item)}
                    className="relative h-56 w-full cursor-pointer overflow-hidden bg-gray-100"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
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

                  {/* Product Details */}
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          onClick={() => openQuickView(item)}
                          className="cursor-pointer text-base font-bold text-gray-900 hover:text-blue-600"
                        >
                          {item.name}
                        </h3>
                        <span className="shrink-0 text-base font-extrabold text-blue-600">
                          {formatPrice(item.price)}
                        </span>
                      </div>

                      {item.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">
                          {item.description}
                        </p>
                      )}

                      <p className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                        <Package size={14} />
                        {outOfStock ? "Unavailable" : `${item.stock} in stock`}
                      </p>
                    </div>

                    {/* Cart & Direct Buy Actions */}
                    <div className="mt-5 flex items-center gap-2.5 border-t border-gray-100 pt-4">
                      <button
                        type="button"
                        disabled={outOfStock || addingId === item.id}
                        onClick={() => handleAddToCart(item, 1)}
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
                        onClick={() => handleDirectBuy(item, 1)}
                        className="flex w-1/2 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Zap size={15} />
                        Buy Now
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
                <p className="text-sm font-medium">No matching products found.</p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-50 px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    <RotateCcw size={14} /> Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Product Quick-View & Quantity Modal */}
        {selectedProduct && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quickview-title"
            onClick={() => setSelectedProduct(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            >
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <h2 id="quickview-title" className="text-lg font-bold text-gray-900">
                    {selectedProduct.name}
                  </h2>
                  {selectedProduct.category && (
                    <p className="text-xs text-gray-500">
                      {selectedProduct.category.name}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Close modal"
                  onClick={() => setSelectedProduct(null)}
                  className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <X size={20} />
                </button>
              </div>

              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                className="mt-4 h-52 w-full rounded-lg object-cover"
              />

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xl font-extrabold text-blue-600">
                  {formatPrice(selectedProduct.price)}
                </span>
                <span className="text-xs font-medium text-gray-500">
                  {selectedProduct.stock > 0
                    ? `${selectedProduct.stock} available`
                    : "Out of stock"}
                </span>
              </div>

              {selectedProduct.description && (
                <p className="mt-3 text-sm text-gray-600">
                  {selectedProduct.description}
                </p>
              )}

              {/* Quantity Selector & Subtotal */}
              {selectedProduct.stock > 0 && (
                <div className="mt-5 flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                      Quantity
                    </span>
                    <span className="text-xs text-gray-500">
                      Subtotal:{" "}
                      <strong className="text-gray-900">
                        {formatPrice(Number(selectedProduct.price) * quantity)}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="rounded-md border border-gray-300 bg-white p-1 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-gray-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={quantity >= selectedProduct.stock}
                      onClick={() =>
                        setQuantity((q) => Math.min(selectedProduct.stock, q + 1))
                      }
                      className="rounded-md border border-gray-300 bg-white p-1 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="mt-5 flex items-center gap-3 border-t pt-4">
                <button
                  type="button"
                  disabled={
                    selectedProduct.stock <= 0 ||
                    addingId === selectedProduct.id
                  }
                  onClick={() => handleAddToCart(selectedProduct, quantity)}
                  className="flex w-1/2 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingId === selectedProduct.id ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <ShoppingCart size={16} />
                  )}
                  Add to Cart
                </button>
                <button
                  type="button"
                  disabled={selectedProduct.stock <= 0}
                  onClick={() => handleDirectBuy(selectedProduct, quantity)}
                  className="flex w-1/2 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Zap size={16} />
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}