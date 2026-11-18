import { NextRequest, NextResponse } from "next/server"
import { authenticate, requireAdmin } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"

const ADMIN_ROLE = "ADMIN"

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/users/[id] - Fetch user profile (ADMIN or Self)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { user: currentUser, error } = await authenticate(request)
  if (error) return error

  const { id } = await params

  // Non-admins can only access their own profile
  if (currentUser?.role !== ADMIN_ROLE && currentUser?.userId !== id) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Access denied" },
      { status: 403 }
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: user })
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to fetch user" }, { status: 500 })
  }
}

// PUT /api/users/[id] - Update user (ADMIN or Self)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { user: currentUser, error } = await authenticate(request)
  if (error) return error

  const { id } = await params

  if (currentUser?.role !== ADMIN_ROLE && currentUser?.userId !== id) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Access denied" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { name, email, password, role } = body

    const updateData: Record<string, any> = {}
    if (name && name.trim() !== "") updateData.name = name.trim()
    if (email && email.trim() !== "") updateData.email = email.trim()

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 6 characters long" },
          { status: 400 }
        )
      }
      updateData.password = await bcrypt.hash(password, 10)
    }

    // Safely parse role only if provided and requested by an Admin
    if (role && currentUser?.role === ADMIN_ROLE) {
      updateData.role = role.toUpperCase()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields provided for update" },
        { status: 400 }
      )
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    return NextResponse.json({ success: true, data: updatedUser })
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "An account with this email address already exists" },
          { status: 409 }
        )
      }
      if (err.code === "P2025") {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    )
  }
}

type JwtPayload = {
  id?: string
  userId?: string
  sub?: string
  role?: string
}

// DELETE /api/users/[id] - Delete own account (Self) or any user (ADMIN)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const payload = user as JwtPayload
  const currentUserId = payload?.id || payload?.userId || payload?.sub
  const { id } = await params

  // Allow self-deletion OR admin deletion
  if (!currentUserId || (currentUserId !== id && payload.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "Forbidden: You can only delete your own account" },
      { status: 403 }
    )
  }

  try {
    const deletedUser = await prisma.user.delete({
      where: { id },
      select: {
        id: true,
        imagePublicId: true, // Returned so you can clean up their Cloudinary avatar
      },
    })

    return NextResponse.json({
      success: true,
      deletedImagePublicId: deletedUser.imagePublicId,
      message: "User account deleted successfully",
    })
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        )
      }

      // Order.user does not have onDelete: Cascade in your schema
      if (err.code === "P2003") {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot delete account with existing orders",
          },
          { status: 400 }
        )
      }
    }

    console.error("Error deleting user:", err)
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 }
    )
  }
}