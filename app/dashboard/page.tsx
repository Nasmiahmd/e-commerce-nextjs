"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Package,
  ShoppingBag,
  Users,
  FolderOpen,
  AlertTriangle,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Store,
  ShieldCheck,
  RotateCcw,
  ShoppingCart,
} from "lucide-react"
import Navbar from "@/components/NavBar"

type UserRole = "USER" | "SELLER" | "ADMIN"

interface CurrentUser {
  id: string | null
  name: string
  email: string
  role: UserRole
}

interface ProductSummary {
  id: string
  name: string
  price: string | number
  stock: number
  imageUrl: string
  isArchived: boolean
  userId: string
  category?: { id: string; name: string } | null
}

interface OrderSummary {
  id: string
  status: string
  totalAmount?: string | number
  total?: string | number
  createdAt: string
  user?: { name: string; email: string } | null
  items?: { quantity: number; price: string | number }[]
  orderItems?: { quantity: number; price: string | number }[]
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function formatCurrency(amount: number): string {
  return Number.isNaN(amount) ? "$0.00" : currencyFormatter.format(amount)
}

async function parseApiResponse<T>(
  res: Response,
  label: string
): Promise<{ data: T | null; error?: string }> {
  const contentType = res.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    return {
      data: null,
      error: `${label} returned ${res.status} (${res.statusText}) instead of JSON`,
    }
  }

  const json = await res.json()
  if (!res.ok || !json.success) {
    return {
      data: null,
      error: json.error || `${label} failed (${res.status})`,
    }
  }

  return { data: json.data as T }
}

function decodeUserFromToken(token: string): CurrentUser | null {
  try {
    const base64Payload = token.split(".")[1]
    if (!base64Payload) return null
    const decoded = JSON.parse(atob(base64Payload))
    return {
      id: decoded?.id || decoded?.userId || decoded?.sub || null,
      name: decoded?.name || decoded?.email?.split("@")[0] || "User",
      email: decoded?.email || "",
      role: (decoded?.role as UserRole) || "USER",
    }
  } catch {
    return null
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    id: null,
    name: "User",
    email: "",
    role: "USER",
  })

  const [products, setProducts] = useState<ProductSummary[]>([])
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [categoryCount, setCategoryCount] = useState<number>(0)
  const [userCount, setUserCount] = useState<number | null>(null)

  const fetchDashboardData = useCallback(
    async (token: string, role: UserRole) => {
      setLoading(true)
      setError(null)

      try {
        const authHeaders = { Authorization: `Bearer ${token}` }

        const requests: Promise<Response>[] = [
          fetch("/api/products"),
          fetch("/api/orders", { headers: authHeaders }),
          fetch("/api/categories"),
        ]

        if (role === "ADMIN") {
          requests.push(fetch("/api/users", { headers: authHeaders }))
        }

        const [prodRes, orderRes, catRes, userRes] = await Promise.all(requests)

        if (orderRes.status === 401 || userRes?.status === 401) {
          localStorage.removeItem("token")
          router.replace("/login")
          return
        }

        const [prodParsed, orderParsed, catParsed] = await Promise.all([
          parseApiResponse<ProductSummary[]>(prodRes, "GET /api/products"),
          parseApiResponse<OrderSummary[]>(orderRes, "GET /api/orders"),
          parseApiResponse<unknown[]>(catRes, "GET /api/categories"),
        ])

        const errors: string[] = []
        if (prodParsed.error) errors.push(prodParsed.error)
        if (orderParsed.error) errors.push(orderParsed.error)
        if (catParsed.error) errors.push(catParsed.error)

        if (prodParsed.data) {
          setProducts(prodParsed.data.filter((p) => !p.isArchived))
        }
        if (orderParsed.data) {
          setOrders(orderParsed.data)
        }
        if (catParsed.data) {
          setCategoryCount(catParsed.data.length)
        }

        if (userRes) {
          const userParsed = await parseApiResponse<unknown[]>(
            userRes,
            "GET /api/users"
          )
          if (userParsed.error) errors.push(userParsed.error)
          if (userParsed.data) {
            setUserCount(userParsed.data.length)
          }
        }

        if (errors.length > 0) {
          setError(errors[0])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard")
      } finally {
        setLoading(false)
      }
    },
    [router]
  )

  useEffect(() => {
    setMounted(true)
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    const user = decodeUserFromToken(token)
    if (!user) {
      localStorage.removeItem("token")
      router.replace("/login")
      return
    }

    setCurrentUser(user)
    fetchDashboardData(token, user.role)
  }, [router, fetchDashboardData])

  const handleRetry = () => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }
    fetchDashboardData(token, currentUser.role)
  }

  if (!mounted) return null

  const isAdmin = currentUser.role === "ADMIN"
  const isSeller = currentUser.role === "SELLER"

  // Role-scoped metrics
  const visibleProducts = isSeller
    ? products.filter((p) => p.userId === currentUser.id)
    : products

  const lowStockProducts = visibleProducts.filter((p) => p.stock <= 5)
  const pendingOrders = orders.filter((o) => o.status?.toUpperCase() === "PENDING")

  const getOrderTotal = (order: OrderSummary) => {
    if (order.totalAmount !== undefined && order.totalAmount !== null) {
      return Number(order.totalAmount)
    }
    if (order.total !== undefined && order.total !== null) {
      return Number(order.total)
    }
    const lineItems = order.items || order.orderItems || []
    return lineItems.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    )
  }

  const totalSpentOrRevenue = orders
    .filter((o) => o.status?.toUpperCase() !== "CANCELLED")
    .reduce((sum, o) => sum + getOrderTotal(o), 0)

  const renderStatusPill = (status: string) => {
    const s = status?.toUpperCase() || "PENDING"
    if (s === "DELIVERED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
          <CheckCircle2 size={12} /> Delivered
        </span>
      )
    }
    if (s === "SHIPPED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
          <Truck size={12} /> Shipped
        </span>
      )
    }
    if (s === "CANCELLED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
          <XCircle size={12} /> Cancelled
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        <Clock size={12} /> {s.charAt(0) + s.slice(1).toLowerCase()}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Welcome Banner */}
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {currentUser.name}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {isAdmin && <ShieldCheck size={13} />}
                {isSeller && <Store size={13} />}
                {currentUser.role}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {isAdmin
                ? "Monitor store activity, manage users, and fulfill customer orders."
                : isSeller
                  ? "Track your product listings, stock levels, and recent activity."
                  : "View your recent orders, track deliveries, and shop the catalog."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isSeller || isAdmin ? (
              <button
                type="button"
                onClick={() => router.push("/products")}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus size={17} />
                Manage Products
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/orders")}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                <ShoppingCart size={16} />
                My Cart
              </button>
            )}

            <button
              type="button"
              onClick={() => router.push("/products")}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              Explore Products
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            <span className="flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              {error}
            </span>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1 font-semibold underline hover:text-red-800"
            >
              <RotateCcw size={14} /> Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center text-gray-500">
            <Loader2 className="mr-2 animate-spin" size={24} /> Loading dashboard...
          </div>
        ) : (
          <>
            {/* Role-Specific Stat Cards */}
            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div
                onClick={() => router.push("/orders")}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {isAdmin ? "Total Orders" : "My Orders"}
                  </span>
                  <ShoppingBag size={18} className="text-blue-600" />
                </div>
                <p className="mt-3 text-2xl font-extrabold text-gray-900">
                  {orders.length}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {pendingOrders.length} pending confirmation
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {isAdmin ? "Gross Sales" : "Total Spent"}
                  </span>
                  <CheckCircle2 size={18} className="text-green-600" />
                </div>
                <p className="mt-3 text-2xl font-extrabold text-gray-900">
                  {formatCurrency(totalSpentOrRevenue)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Excludes cancelled orders
                </p>
              </div>

              {isSeller || isAdmin ? (
                <div
                  onClick={() => router.push("/products")}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {isSeller ? "My Listings" : "Active Products"}
                    </span>
                    <Package size={18} className="text-indigo-600" />
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-gray-900">
                    {visibleProducts.length}
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-600">
                    {lowStockProducts.length} low / out of stock
                  </p>
                </div>
              ) : (
                <div
                  onClick={() => router.push("/categories")}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Categories
                    </span>
                    <FolderOpen size={18} className="text-indigo-600" />
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-gray-900">
                    {categoryCount}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Browse collections
                  </p>
                </div>
              )}

              {isAdmin ? (
                <div
                  onClick={() => router.push("/users")}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Registered Users
                    </span>
                    <Users size={18} className="text-purple-600" />
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-gray-900">
                    {userCount ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Manage roles & accounts
                  </p>
                </div>
              ) : (
                <div
                  onClick={() => router.push("/products")}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Available Catalog
                    </span>
                    <Store size={18} className="text-purple-600" />
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-gray-900">
                    {products.length}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Items ready to order
                  </p>
                </div>
              )}
            </div>

            {/* Two-Column Overview: Recent Orders + Inventory/Catalog Highlights */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Recent Orders Panel */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900">
                    {isAdmin ? "Recent Customer Orders" : "Recent Orders"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => router.push("/orders")}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    View all
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                    No orders placed yet.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {orders.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        onClick={() => router.push("/orders")}
                        className="flex cursor-pointer items-center justify-between py-3 transition hover:bg-gray-50/70"
                      >
                        <div>
                          <p className="font-mono text-xs font-bold text-gray-900">
                            #{order.id.slice(-8).toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleDateString()}
                            {isAdmin && order.user?.name ? ` • ${order.user.name}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {renderStatusPill(order.status)}
                          <span className="text-sm font-bold text-gray-900">
                            {formatCurrency(getOrderTotal(order))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Low Stock Alerts (SELLER/ADMIN) or Latest Arrivals (USER) */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900">
                    {isSeller || isAdmin
                      ? "Low Stock & Inventory Alerts"
                      : "Latest Store Arrivals"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => router.push("/products")}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    {isSeller || isAdmin ? "Manage inventory" : "See all"}
                  </button>
                </div>

                {isSeller || isAdmin ? (
                  lowStockProducts.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                      All products are well stocked.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {lowStockProducts.slice(0, 5).map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => router.push("/products")}
                          className="flex cursor-pointer items-center justify-between py-3 transition hover:bg-gray-50/70"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="h-10 w-10 shrink-0 rounded-lg bg-gray-100 object-cover"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {prod.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatCurrency(Number(prod.price))}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              prod.stock === 0
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            <AlertTriangle size={12} />
                            {prod.stock === 0 ? "Out of stock" : `${prod.stock} left`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                ) : products.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                    No products available yet.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {products.slice(0, 5).map((prod) => (
                      <div
                        key={prod.id}
                        onClick={() => router.push("/products")}
                        className="flex cursor-pointer items-center justify-between py-3 transition hover:bg-gray-50/70"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="h-10 w-10 shrink-0 rounded-lg bg-gray-100 object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {prod.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {prod.category?.name || "General"}
                            </p>
                          </div>
                        </div>

                        <span className="text-sm font-bold text-blue-600">
                          {formatCurrency(Number(prod.price))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}