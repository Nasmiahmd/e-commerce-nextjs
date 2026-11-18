"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
  Package,
  ShieldCheck,
} from "lucide-react"
import Navbar from "@/components/NavBar"

interface CartProduct {
  id: string
  name: string
  price: string | number
  stock: number
  imageUrl: string
  isArchived?: boolean
  category?: {
    id: string
    name: string
  } | null
}

interface CartItemRecord {
  id: string
  productId: string
  quantity: number
  product: CartProduct
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function formatCurrency(amount: number): string {
  return Number.isNaN(amount) ? "$0.00" : currencyFormatter.format(amount)
}

async function safeJson<T>(res: Response, label: string): Promise<T> {
  const contentType = res.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`${label} returned ${res.status} (${res.statusText}) instead of JSON`)
  }
  return res.json()
}

export default function CartPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [items, setItems] = useState<CartItemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const loadCart = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/cart", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 401) {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        router.replace("/login")
        return
      }

      const data = await safeJson<{
        success: boolean
        data?: CartItemRecord[]
        error?: string
      }>(res, "GET /api/cart")

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load shopping cart")
      }

      setItems(data.data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load cart")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    setMounted(true)
    loadCart()
  }, [loadCart])

  const handleUpdateQuantity = async (item: CartItemRecord, newQty: number) => {
    if (newQty < 1 || newQty > item.product.stock) return

    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    setUpdatingId(item.id)
    setError(null)

    try {
      const res = await fetch(`/api/cart/${item.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity: newQty }),
      })

      if (res.status === 401) {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        router.replace("/login")
        return
      }

      const data = await safeJson<{
        success: boolean
        data?: CartItemRecord
        error?: string
      }>(res, `PUT /api/cart/${item.id}`)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update quantity")
      }

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, quantity: newQty } : row
        )
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update quantity")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRemoveItem = async (item: CartItemRecord) => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    setUpdatingId(item.id)
    setError(null)

    try {
      const res = await fetch(`/api/cart/${item.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 401) {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        router.replace("/login")
        return
      }

      const data = await safeJson<{
        success: boolean
        error?: string
      }>(res, `DELETE /api/cart/${item.id}`)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to remove item")
      }

      setItems((prev) => prev.filter((row) => row.id !== item.id))
      setToastMessage(`Removed "${item.product.name}" from cart`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not remove item")
    } finally {
      setUpdatingId(null)
    }
  }

  if (!mounted) return null

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  )

  const hasUnavailableItems = items.some(
    (item) =>
      item.product.isArchived ||
      item.product.stock <= 0 ||
      item.quantity > item.product.stock
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
            <p className="mt-1 text-sm text-gray-500">
              {items.length === 0
                ? "Your cart is currently empty."
                : `${totalUnits} ${totalUnits === 1 ? "item" : "items"} ready for checkout.`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/products")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <ShoppingBag size={17} />
            Continue Shopping
          </button>
        </div>

        {/* Alerts */}
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

        {hasUnavailableItems && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle size={18} className="shrink-0" />
            Some items in your cart are out of stock or exceed available inventory. Remove or adjust them before checking out.
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex h-72 items-center justify-center text-gray-500">
            <Loader2 className="mr-2 animate-spin" size={24} /> Loading cart...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-14 text-center">
            <ShoppingCart className="mx-auto mb-3 text-gray-400" size={40} />
            <h2 className="text-base font-bold text-gray-900">Your cart is empty</h2>
            <p className="mt-1 text-sm text-gray-500">
              Browse the product catalog to add items to your cart.
            </p>
            <button
              type="button"
              onClick={() => router.push("/products")}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Explore Products
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: Cart Items List */}
            <div className="space-y-4 lg:col-span-2">
              {items.map((item) => {
                const unitPrice = Number(item.product.price)
                const lineSubtotal = unitPrice * item.quantity
                const isBusy = updatingId === item.id
                const isUnavailable =
                  Boolean(item.product.isArchived) || item.product.stock <= 0
                const exceedsStock = item.quantity > item.product.stock

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      {item.product.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="h-20 w-20 shrink-0 rounded-lg border border-gray-200 bg-gray-100 object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 text-gray-400">
                          <Package size={24} />
                        </div>
                      )}

                      <div className="min-w-0">
                        {item.product.category && (
                          <span className="mb-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                            {item.product.category.name}
                          </span>
                        )}

                        <h2 className="truncate text-base font-bold text-gray-900">
                          {item.product.name}
                        </h2>

                        <p className="mt-0.5 text-sm font-semibold text-blue-600">
                          {formatCurrency(unitPrice)}{" "}
                          <span className="text-xs font-normal text-gray-400">
                            each
                          </span>
                        </p>

                        {isUnavailable ? (
                          <p className="mt-1 text-xs font-semibold text-red-600">
                            No longer available
                          </p>
                        ) : exceedsStock ? (
                          <p className="mt-1 text-xs font-semibold text-amber-600">
                            Only {item.product.stock} left in stock
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500">
                            {item.product.stock} in stock
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quantity Controls & Line Total */}
                    <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          disabled={isBusy || item.quantity <= 1}
                          onClick={() =>
                            handleUpdateQuantity(item, item.quantity - 1)
                          }
                          className="rounded-md bg-white p-1.5 text-gray-700 shadow-xs transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus size={14} />
                        </button>

                        <span className="w-7 text-center text-sm font-bold text-gray-900">
                          {isBusy ? (
                            <Loader2 className="mx-auto animate-spin" size={14} />
                          ) : (
                            item.quantity
                          )}
                        </span>

                        <button
                          type="button"
                          aria-label="Increase quantity"
                          disabled={
                            isBusy ||
                            isUnavailable ||
                            item.quantity >= item.product.stock
                          }
                          onClick={() =>
                            handleUpdateQuantity(item, item.quantity + 1)
                          }
                          className="rounded-md bg-white p-1.5 text-gray-700 shadow-xs transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="block text-sm font-extrabold text-gray-900">
                          {formatCurrency(lineSubtotal)}
                        </span>
                      </div>

                      <button
                        type="button"
                        aria-label={`Remove ${item.product.name}`}
                        disabled={isBusy}
                        onClick={() => handleRemoveItem(item)}
                        className="rounded-lg border border-red-100 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-base font-bold text-gray-900">
                  Order Summary
                </h2>

                <div className="space-y-2.5 border-b border-gray-100 pb-4 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Items ({totalUnits})</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className="font-semibold text-green-600">Free</span>
                  </div>
                </div>

                <div className="my-4 flex items-center justify-between">
                  <span className="text-base font-bold text-gray-900">
                    Estimated Total
                  </span>
                  <span className="text-xl font-extrabold text-blue-600">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={hasUnavailableItems || updatingId !== null}
                  onClick={() => router.push("/checkout")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldCheck size={17} />
                  Proceed to Checkout
                </button>

                <p className="mt-3 text-center text-xs text-gray-400">
                  Shipping address is confirmed on the next step.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}