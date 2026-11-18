"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ShoppingBag,
  MapPin,
  CreditCard,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Package,
  ShieldCheck,
  Plus,
  Minus,
} from "lucide-react"
import Navbar from "@/components/NavBar"

interface CheckoutItem {
  productId: string
  name: string
  price: number
  quantity: number
  stock: number
  imageUrl: string
}

interface ProductApiData {
  id: string
  name: string
  price: string | number
  stock: number
  imageUrl: string
  isArchived?: boolean
}

interface CartApiItem {
  id: string
  productId: string
  quantity: number
  product: ProductApiData
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

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const productId = searchParams.get("productId")
  const initialQty = Math.max(1, Number(searchParams.get("qty") || "1") || 1)
  const isDirectBuy = Boolean(productId)

  const [items, setItems] = useState<CheckoutItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shippingAddress, setShippingAddress] = useState("")

  const loadCheckoutItems = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (isDirectBuy && productId) {
        const res = await fetch(`/api/products/${productId}`)
        const data = await safeJson<{
          success: boolean
          data?: ProductApiData
          error?: string
        }>(res, `GET /api/products/${productId}`)

        if (!res.ok || !data.success || !data.data) {
          throw new Error(data.error || "Product not found")
        }

        const prod = data.data
        if (prod.isArchived || prod.stock <= 0) {
          throw new Error("This product is currently out of stock")
        }

        setItems([
          {
            productId: prod.id,
            name: prod.name,
            price: Number(prod.price),
            quantity: Math.min(initialQty, prod.stock),
            stock: prod.stock,
            imageUrl: prod.imageUrl,
          },
        ])
      } else {
        const res = await fetch("/api/cart", {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.status === 401) {
          localStorage.removeItem("token")
          router.replace("/login")
          return
        }

        const data = await safeJson<{
          success: boolean
          data?: CartApiItem[]
          error?: string
        }>(res, "GET /api/cart")

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load cart items")
        }

        const mapped: CheckoutItem[] = (data.data || [])
          .filter((c) => c.product && !c.product.isArchived)
          .map((c) => ({
            productId: c.productId,
            name: c.product.name,
            price: Number(c.product.price),
            quantity: c.quantity,
            stock: c.product.stock,
            imageUrl: c.product.imageUrl,
          }))

        setItems(mapped)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load checkout")
    } finally {
      setLoading(false)
    }
  }, [isDirectBuy, productId, initialQty, router])

  useEffect(() => {
    loadCheckoutItems()
  }, [loadCheckoutItems])

  const updateDirectBuyQty = (delta: number) => {
    if (!isDirectBuy) return
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        quantity: Math.min(item.stock, Math.max(1, item.quantity + delta)),
      }))
    )
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()

    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    if (items.length === 0) {
      setError("No items to checkout")
      return
    }

    if (!shippingAddress.trim()) {
      setError("Please enter a shipping address")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = isDirectBuy
        ? {
            items: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
            shippingAddress: shippingAddress.trim(),
          }
        : {
            fromCart: true,
            shippingAddress: shippingAddress.trim(),
          }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (res.status === 401) {
        localStorage.removeItem("token")
        router.replace("/login")
        return
      }

      const data = await safeJson<{
        success: boolean
        data?: { id: string }
        error?: string
      }>(res, "POST /api/orders")

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to place order")
      }

      router.replace("/orders")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not complete order")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isDirectBuy
              ? "Review your item and confirm delivery details."
              : "Review your cart items and complete your purchase."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={15} />
          Back
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-72 items-center justify-center text-gray-500">
          <Loader2 className="mr-2 animate-spin" size={24} /> Preparing checkout...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <ShoppingBag className="mx-auto mb-3 text-gray-400" size={36} />
          <h2 className="text-base font-bold text-gray-900">Your checkout is empty</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add products to your cart or select Buy Now on a product first.
          </p>
          <button
            type="button"
            onClick={() => router.push("/products")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Browse Products
          </button>
        </div>
      ) : (
        <form
          onSubmit={handlePlaceOrder}
          className="grid grid-cols-1 gap-6 lg:grid-cols-3"
        >
          {/* Left: Shipping & Items */}
          <div className="space-y-6 lg:col-span-2">
            {/* Shipping Address */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
                <MapPin size={18} className="text-blue-600" />
                Shipping Address
              </h2>

              <label
                htmlFor="shippingAddress"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
              >
                Full Delivery Address *
              </label>
              <textarea
                id="shippingAddress"
                required
                rows={3}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Street address, apartment/suite, city, postal code, country..."
                className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Order Items */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
                <Package size={18} className="text-blue-600" />
                Order Items ({items.length})
              </h2>

              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-16 w-16 shrink-0 rounded-lg border border-gray-200 bg-gray-100 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(item.price)} each
                        </p>

                        {isDirectBuy ? (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              disabled={item.quantity <= 1}
                              onClick={() => updateDirectBuyQty(-1)}
                              className="rounded border border-gray-300 p-1 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-gray-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              disabled={item.quantity >= item.stock}
                              onClick={() => updateDirectBuyQty(1)}
                              className="rounded border border-gray-300 p-1 text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        ) : (
                          <p className="mt-1 text-xs font-medium text-gray-600">
                            Qty: {item.quantity}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
                <CreditCard size={18} className="text-blue-600" />
                Order Summary
              </h2>

              <div className="space-y-2.5 border-b border-gray-100 pb-4 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
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
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-xl font-extrabold text-blue-600">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={17} />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={17} />
                    Place Order
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-xs text-gray-400">
                Stock is reserved immediately upon order confirmation.
              </p>
            </div>
          </div>
        </form>
      )}
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Suspense
        fallback={
          <div className="flex h-80 items-center justify-center text-gray-500">
            <Loader2 className="mr-2 animate-spin" size={24} /> Loading checkout...
          </div>
        }
      >
        <CheckoutContent />
      </Suspense>
    </div>
  )
}