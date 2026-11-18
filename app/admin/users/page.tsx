"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Users,
  Shield,
  Store,
  User as UserIcon,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
  Calendar,
} from "lucide-react"
import HomeNavbar from "@/components/HomeNavBar"
import Navbar from "@/components/NavBar"

type UserRole = "USER" | "SELLER" | "ADMIN"

interface UserRecord {
  id: string
  name: string
  email: string
  role: UserRole
  imageUrl?: string | null
  createdAt?: string
  _count?: {
    products?: number
    orders?: number
  }
}

interface CurrentUser {
  id: string | null
  role: UserRole | null
}

const ROLES: UserRole[] = ["USER", "SELLER", "ADMIN"]

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

function getRoleBadge(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return {
        label: "Admin",
        classes: "bg-purple-50 text-purple-700 border-purple-200",
        icon: <Shield size={12} />,
      }
    case "SELLER":
      return {
        label: "Seller",
        classes: "bg-blue-50 text-blue-700 border-blue-200",
        icon: <Store size={12} />,
      }
    default:
      return {
        label: "Buyer",
        classes: "bg-gray-100 text-gray-700 border-gray-200",
        icon: <UserIcon size={12} />,
      }
  }
}

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser>({ id: null, role: null })

  // Filters & action state
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadUsers = async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await safeJson<{
        success: boolean
        data?: UserRecord[]
        error?: string
      }>(res)

      if (res.status === 401) {
        localStorage.removeItem("token")
        router.replace("/login")
        return
      }

      if (res.status === 403) {
        router.replace("/")
        return
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load users")
      }

      setUsers(data.data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    const user = getCurrentUser()
    if (user.role !== "ADMIN") {
      router.replace("/")
      return
    }

    setCurrentUser(user)
    loadUsers()
  }, [router])

  // Change user role (PUT /api/users/[id])
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    setUpdatingId(userId)
    setError(null)

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await safeJson<{
        success: boolean
        data?: UserRecord
        error?: string
      }>(res)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update user role")
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
      showToast(`Updated user role to ${newRole}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update role")
    } finally {
      setUpdatingId(null)
    }
  }

  // Delete user account (DELETE /api/users/[id])
  const handleDeleteUser = async (targetUser: UserRecord) => {
    const confirmed = window.confirm(
      `Delete account for "${targetUser.name}" (${targetUser.email})? This action cannot be undone.`
    )
    if (!confirmed) return

    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    setDeletingId(targetUser.id)
    setError(null)

    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
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
        throw new Error(data.error || "Failed to delete user")
      }

      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id))
      showToast(`Deleted user "${targetUser.name}"`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete user")
    } finally {
      setDeletingId(null)
    }
  }

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false

    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    )
  })

  if (!mounted || currentUser.role !== "ADMIN") return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              View registered accounts, assign buyer/seller/admin roles, and manage access.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm">
            <Users size={16} className="text-blue-600" />
            Total Users: <span className="font-bold text-gray-900">{users.length}</span>
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
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 size={18} className="shrink-0" />
            {toastMessage}
          </div>
        )}

        {/* Search & Role Filter Bar */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, email, or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["ALL", ...ROLES] as const).map((role) => {
              const active = roleFilter === role
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleFilter(role)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {role === "ALL"
                    ? "All Roles"
                    : role.charAt(0) + role.slice(1).toLowerCase()}
                </button>
              )
            })}
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex h-72 items-center justify-center text-gray-500">
            <Loader2 className="mr-2 animate-spin" size={24} /> Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
            No matching users found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-14 py-3.5">User</th>
                    <th className="px-9 py-3.5">Role</th>
                    <th className="px-9 py-3.5">Joined</th>
                    <th className="px-14 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((u) => {
                    const badge = getRoleBadge(u.role)
                    const isSelf = currentUser.id === u.id

                    return (
                      <tr key={u.id} className="transition hover:bg-gray-50/70">
                        {/* Avatar + Name + Email */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {u.imageUrl ? (
                              <img
                                src={u.imageUrl}
                                alt={u.name}
                                className="h-10 w-10 shrink-0 rounded-full border border-gray-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">
                                {u.name?.charAt(0).toUpperCase() || "U"}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-bold text-gray-900">
                                  {u.name}
                                </p>
                                {isSelf && (
                                  <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-700">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                                <Mail size={12} className="shrink-0" />
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.classes}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                        </td>

                        {/* Created Date */}
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {u.createdAt ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={13} className="text-gray-400" />
                              {new Date(u.createdAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Role Selector & Delete Action */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2.5">
                            <select
                              disabled={isSelf || updatingId === u.id}
                              value={u.role}
                              onChange={(e) =>
                                handleRoleChange(u.id, e.target.value as UserRole)
                              }
                              title={
                                isSelf
                                  ? "You cannot change your own role"
                                  : "Change user role"
                              }
                              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              disabled={isSelf || deletingId === u.id}
                              onClick={() => handleDeleteUser(u)}
                              title={
                                isSelf
                                  ? "Delete your own account from Profile"
                                  : "Delete user"
                              }
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {deletingId === u.id ? (
                                <Loader2 className="animate-spin" size={15} />
                              ) : (
                                <Trash2 size={15} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}