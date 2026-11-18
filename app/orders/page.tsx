"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Package,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  Calendar,
} from "lucide-react"
import Navbar from "@/components/NavBar"

interface OrderLineItem {
  id: string
  quantity: number
  priceAtPurchase: string | number
  productName: string
  productId: string | null
  product?: {
    id: string
    name: string
    imageUrl: string
  } | null
}

interface OrderRecord {
  id: string
  userId: string
  status: string
  totalAmount?: string | number
  total?: string | number
  shippingAddress?: string | null
  createdAt: string
  user?: {
    id: string
    name: string
    email: string
  } | null
  items?: OrderLineItem[]
  orderItems?: OrderLineItem[]
}

interface CurrentUser {
  id: string | null
  role: "USER" | "SELLER" | "ADMIN" | null
}

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const

// Safely parse JSON responses so HTML 404/500 pages never crash the UI
async function safeJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Server returned ${res.status} (${res.statusText}) instead of JSON`)
  }
  return res.json()
}

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

function getStatusBadge(status: string) {
  const normalized = status?.toUpperCase() || "PENDING"

  switch (normalized) {
    case "DELIVERED":
      return {
        label: "Delivered",
        classes: "bg-green-50 text-green-700 border-green-200",
        icon: <CheckCircle2 size={13} />,
      }
    case "SHIPPED":
      return {
        label: "Shipped",
        classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
        icon: <Truck size={13} />,
      }
    case "CONFIRMED":
    case "PROCESSING":
      return {
        label: normalized === "CONFIRMED" ? "Confirmed" : "Processing",
        classes: "bg-blue-50 text-blue-700 border-blue-200",
        icon: <Package size={13} />,
      }
    case "CANCELLED":
      return {
        label: "Cancelled",
        classes: "bg-red-50 text-red-700 border-red-200",
        icon: <XCircle size={13} />,
      }
    default:
      return {
        label: "Pending",
        classes: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <Clock size={13} />,
      }
  }
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser>({ id: null, role: null })

  // Filters & UI state
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const isAdmin = currentUser.role === "ADMIN"

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const loadOrders = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/orders", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 401) {
        localStorage.removeItem("token")
        router.replace("/login")
        return
      }

      const data = await safeJson<{
        success: boolean
        data?: OrderRecord[]
        error?: string
      }>(res)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load orders")
      }

      const fetchedOrders = data.data || []
      setOrders(fetchedOrders)

      // Expand the most recent 3 orders by default
      const initialExpanded: Record<string, boolean> = {}
      fetchedOrders.slice(0, 3).forEach((o) => {
        initialExpanded[o.id] = true
      })
      setExpandedOrders(initialExpanded)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    setMounted(true)
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }
    setCurrentUser(getCurrentUser())
    loadOrders()
  }, [router, loadOrders])

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }))
  }

  // Update order status (ADMIN status progression or USER cancelling a PENDING order)
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (newStatus === "CANCELLED") {
      const confirmed = window.confirm(
        "Are you sure you want to cancel this order?"
      )
      if (!confirmed) return
    }

    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    setUpdatingId(orderId)
    setError(null)

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await safeJson<{
        success: boolean
        data?: OrderRecord
        error?: string
      }>(res)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update order status")
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      )
      setToastMessage(`Order #${orderId.slice(-6).toUpperCase()} updated to ${newStatus}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update order")
    } finally {
      setUpdatingId(null)
    }
  }

  // Support both `order.items` and `order.orderItems` depending on Prisma relation naming
  const getLineItems = (order: OrderRecord): OrderLineItem[] => {
    return order.items || order.orderItems || []
  }

  const getOrderTotal = (order: OrderRecord): number => {
    if (order.totalAmount !== undefined && order.totalAmount !== null) {
      return Number(order.totalAmount)
    }
    if (order.total !== undefined && order.total !== null) {
      return Number(order.total)
    }
    return getLineItems(order).reduce(
      (sum, item) => sum + Number(item.priceAtPurchase) * item.quantity,
      0
    )
  }

  const filteredOrders = orders.filter((order) => {
    if (
      statusFilter !== "ALL" &&
      order.status?.toUpperCase() !== statusFilter
    ) {
      return false
    }

    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    const lineItems = getLineItems(order)

    const matchesId = order.id.toLowerCase().includes(q)
    const matchesCustomer =
      order.user?.name?.toLowerCase().includes(q) ||
      order.user?.email?.toLowerCase().includes(q)
    const matchesProduct = lineItems.some((item) =>
      (item.productName || item.product?.name)?.toLowerCase().includes(q)
    )

    return matchesId || matchesCustomer || matchesProduct
  })

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isAdmin ? "All Customer Orders" : "My Orders"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isAdmin
                ? "Monitor store orders and update fulfillment statuses."
                : "Track your purchases, view receipts, and check delivery status."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/products")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <ShoppingBag size={18} />
            Continue Shopping
          </button>
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

        {/* Search & Status Filter Pills */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={
                isAdmin
                  ? "Search by order ID, customer, or product..."
                  : "Search by order ID or product name..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {["ALL", ...ORDER_STATUSES].map((status) => {
              const active = statusFilter === status
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {status === "ALL"
                    ? "All"
                    : status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              )
            })}
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex h-72 items-center justify-center text-gray-500">
            <Loader2 className="mr-2 animate-spin" size={24} /> Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <Package className="mx-auto mb-3 text-gray-400" size={36} />
            <h3 className="text-base font-bold text-gray-900">No orders found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {orders.length === 0
                ? "You haven't placed any orders yet."
                : "No orders match your current search or status filter."}
            </p>
            {orders.length === 0 && (
              <button
                type="button"
                onClick={() => router.push("/products")}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Browse Catalog
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const lineItems = getLineItems(order)
              const total = getOrderTotal(order)
              const badge = getStatusBadge(order.status)
              const isExpanded = !!expandedOrders[order.id]
              const isPending = order.status?.toUpperCase() === "PENDING"

              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  {/* Order Summary Header */}
                  <div className="flex flex-col gap-4 border-b border-gray-100 bg-gray-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                          Order ID
                        </span>
                        <span className="font-mono text-sm font-bold text-gray-900">
                          #{order.id.slice(-8).toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                          Date Placed
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-700">
                          <Calendar size={13} className="text-gray-400" />
                          {new Date(order.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                          Total
                        </span>
                        <span className="text-sm font-extrabold text-blue-600">
                          ${total.toFixed(2)}
                        </span>
                      </div>

                      {isAdmin && order.user && (
                        <div>
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Customer
                          </span>
                          <span className="flex items-center gap-1 text-xs font-medium text-gray-700">
                            <UserIcon size={13} className="text-gray-400" />
                            {order.user.name} ({order.user.email})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Status Badge & Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badge.classes}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>

                      {/* Admin Status Selector */}
                      {isAdmin && (
                        <select
                          disabled={updatingId === order.id}
                          value={order.status?.toUpperCase() || "PENDING"}
                          onChange={(e) =>
                            handleStatusChange(order.id, e.target.value)
                          }
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                        >
                          {ORDER_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Buyer Cancel Button (only while order is still PENDING) */}
                      {!isAdmin && isPending && (
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => handleStatusChange(order.id, "CANCELLED")}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          {updatingId === order.id ? "Cancelling..." : "Cancel Order"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(order.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        {isExpanded ? (
                          <>
                            Hide <ChevronUp size={15} />
                          </>
                        ) : (
                          <>
                            Items ({lineItems.length}) <ChevronDown size={15} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Order Items */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-100 px-6 py-2">
                      {order.shippingAddress && (
                        <div className="py-3 text-xs text-gray-600">
                          <span className="font-semibold text-gray-800">
                            Shipping Address:{" "}
                          </span>
                          {order.shippingAddress}
                        </div>
                      )}

                      {lineItems.length === 0 ? (
                        <p className="py-4 text-xs text-gray-500">
                          No line item details available for this order.
                        </p>
                      ) : (
                        lineItems.map((item) => {
                          const unitPrice = Number(item.priceAtPurchase)
                          const subtotal = unitPrice * item.quantity
                          const displayName =
                            item.productName || item.product?.name || "Product"

                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-4 py-3.5"
                            >
                              <div className="flex min-w-0 items-center gap-3.5">
                                {item.product?.imageUrl ? (
                                  <img
                                    src={item.product.imageUrl}
                                    alt={displayName}
                                    className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 bg-gray-100 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 text-gray-400">
                                    <Package size={20} />
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-gray-900">
                                    {displayName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Qty: {item.quantity} × ${unitPrice.toFixed(2)}
                                  </p>
                                </div>
                              </div>

                              <span className="text-sm font-bold text-gray-900">
                                ${subtotal.toFixed(2)}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}