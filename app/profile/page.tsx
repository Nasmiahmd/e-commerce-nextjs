"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  User,
  Mail,
  Lock,
  ShieldCheck,
  Store,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
  LogOut,
  ShoppingBag,
  ShoppingCart,
  Package,
  Users,
  Calendar,
  Eye,
  EyeOff,
} from "lucide-react"
import Navbar from "@/components/NavBar"

type UserRole = "USER" | "SELLER" | "ADMIN"

interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt?: string
}

async function safeJson<T>(res: Response, label: string): Promise<T> {
  const contentType = res.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`${label} returned ${res.status} (${res.statusText}) instead of JSON`)
  }
  return res.json()
}

function decodeProfileFromToken(token: string): UserProfile | null {
  try {
    const base64Payload = token.split(".")[1]
    if (!base64Payload) return null
    const decoded = JSON.parse(atob(base64Payload))
    const id = decoded?.id || decoded?.userId || decoded?.sub
    if (!id) return null

    return {
      id: String(id),
      name: decoded?.name || decoded?.email?.split("@")[0] || "User",
      email: decoded?.email || "",
      role: (decoded?.role as UserRole) || "USER",
    }
  } catch {
    return null
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [profile, setProfile] = useState<UserProfile>({
    id: "",
    name: "",
    email: "",
    role: "USER",
  })

  // Editable form state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const loadProfile = useCallback(
    async (token: string, fallbackProfile: UserProfile) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/users/${fallbackProfile.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.status === 401) {
          localStorage.removeItem("token")
          localStorage.removeItem("user")
          router.replace("/login")
          return
        }

        // If GET /api/users/[id] isn't created yet (404), fall back cleanly to JWT claims
        if (res.status === 404) {
          setProfile(fallbackProfile)
          setName(fallbackProfile.name)
          setEmail(fallbackProfile.email)
          return
        }

        const data = await safeJson<{
          success: boolean
          data?: UserProfile
          error?: string
        }>(res, `GET /api/users/${fallbackProfile.id}`)

        if (!res.ok || !data.success || !data.data) {
          throw new Error(data.error || "Failed to load profile")
        }

        const resolved: UserProfile = {
          id: data.data.id || fallbackProfile.id,
          name: data.data.name || fallbackProfile.name,
          email: data.data.email || fallbackProfile.email,
          role: data.data.role || fallbackProfile.role,
          createdAt: data.data.createdAt,
        }

        setProfile(resolved)
        setName(resolved.name)
        setEmail(resolved.email)
      } catch (err: unknown) {
        setProfile(fallbackProfile)
        setName(fallbackProfile.name)
        setEmail(fallbackProfile.email)
        setError(err instanceof Error ? err.message : "Could not refresh profile")
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

    const decoded = decodeProfileFromToken(token)
    if (!decoded) {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      router.replace("/login")
      return
    }

    setProfile(decoded)
    setName(decoded.name)
    setEmail(decoded.email)
    loadProfile(token, decoded)
  }, [router, loadProfile])

  if (!mounted) return null

  const isAdmin = profile.role === "ADMIN"
  const isSeller = profile.role === "SELLER"

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName || !trimmedEmail) {
      setError("Name and email address are required.")
      return
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError("Enter your current password to set a new password.")
        return
      }
      if (newPassword.length < 6) {
        setError("New password must be at least 6 characters long.")
        return
      }
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.")
        return
      }
    }

    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }

    setSaving(true)

    try {
      const payload: {
        name: string
        email: string
        currentPassword?: string
        newPassword?: string
      } = {
        name: trimmedName,
        email: trimmedEmail,
      }

      if (newPassword) {
        payload.currentPassword = currentPassword
        payload.newPassword = newPassword
      }

      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (res.status === 401) {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        router.replace("/login")
        return
      }

      const data = await safeJson<{
        success: boolean
        data?: Partial<UserProfile>
        token?: string
        error?: string
      }>(res, `PUT /api/users/${profile.id}`)

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update profile")
      }

      if (data.token) {
        localStorage.setItem("token", data.token)
      }

      const updated: UserProfile = {
        ...profile,
        name: data.data?.name || trimmedName,
        email: data.data?.email || trimmedEmail,
      }

      setProfile(updated)
      setName(updated.name)
      setEmail(updated.email)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setToastMessage("Profile updated successfully.")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.replace("/login")
  }

  const initials = (profile.name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Profile Header Card */}
        <div className="mb-8 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-extrabold text-white shadow-sm">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {profile.name || "Account Profile"}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                  {isAdmin && <ShieldCheck size={13} />}
                  {isSeller && <Store size={13} />}
                  {profile.role}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-gray-500">{profile.email}</p>
              {profile.createdAt && (
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                  <Calendar size={12} />
                  Member since{" "}
                  {new Date(profile.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            <LogOut size={16} />
            Sign Out
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

        {loading ? (
          <div className="flex h-64 items-center justify-center text-gray-500">
            <Loader2 className="mr-2 animate-spin" size={24} /> Loading profile...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: Account Shortcuts */}
            <div className="space-y-4 lg:col-span-1">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Quick Navigation
                </h2>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/orders")}
                    className="flex items-center gap-2.5 rounded-lg border border-gray-200 px-3.5 py-2.5 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <ShoppingBag size={16} className="text-blue-600" />
                    {isAdmin ? "All Orders" : "My Orders"}
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/cart")}
                    className="flex items-center gap-2.5 rounded-lg border border-gray-200 px-3.5 py-2.5 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <ShoppingCart size={16} className="text-blue-600" />
                    Shopping Cart
                  </button>

                  {(isSeller || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => router.push("/products")}
                      className="flex items-center gap-2.5 rounded-lg border border-gray-200 px-3.5 py-2.5 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      <Package size={16} className="text-indigo-600" />
                      Manage Products
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => router.push("/users")}
                      className="flex items-center gap-2.5 rounded-lg border border-gray-200 px-3.5 py-2.5 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      <Users size={16} className="text-purple-600" />
                      Manage Users
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Edit Profile & Password Form */}
            <form
              onSubmit={handleSaveProfile}
              className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2"
            >
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Personal Information
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Update your display name and account email address.
                </p>

                <div className="mt-4 space-y-4">
                  <div>
                    <label
                      htmlFor="profile-name"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <User
                        size={16}
                        className="absolute left-3.5 top-3 text-gray-400"
                      />
                      <input
                        id="profile-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="profile-email"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3.5 top-3 text-gray-400"
                      />
                      <input
                        id="profile-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Change Password
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Leave blank if you do not want to change your password.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
                  >
                    {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showPasswords ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <label
                      htmlFor="current-password"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3.5 top-3 text-gray-400"
                      />
                      <input
                        id="current-password"
                        type={showPasswords ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="new-password"
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                      >
                        New Password
                      </label>
                      <input
                        id="new-password"
                        type={showPasswords ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                      >
                        Confirm New Password
                      </label>
                      <input
                        id="confirm-password"
                        type={showPasswords ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}