import { NextRequest, NextResponse } from "next/server"
import { authenticate } from "@/lib/auth"
import prisma from "@/lib/prisma"

type JwtPayload = {
  id?: string
  userId?: string
  sub?: string
  role?: string
}

const VALID_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const

type OrderStatus = (typeof VALID_STATUSES)[number]

// GET /api/orders/[id] - Fetch a single order (owner or ADMIN)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const payload = user as JwtPayload
  const currentUserId = payload?.id || payload?.userId || payload?.sub
  const { id } = await params

  if (!currentUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid token payload" },
      { status: 401 }
    )
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, imageUrl: true },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      )
    }

    if (payload.role !== "ADMIN" && order.userId !== currentUserId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Access denied" },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, data: order })
  } catch (err) {
    console.error("Error fetching order:", err)
    return NextResponse.json(
      { success: false, error: "Failed to fetch order" },
      { status: 500 }
    )
  }
}

// PUT /api/orders/[id] - Update order status (ADMIN) or cancel PENDING order (USER)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const payload = user as JwtPayload
  const currentUserId = payload?.id || payload?.userId || payload?.sub
  const isAdmin = payload?.role === "ADMIN"
  const { id } = await params

  if (!currentUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid token payload" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const nextStatus =
      typeof body.status === "string" ? body.status.toUpperCase() : ""

    if (!VALID_STATUSES.includes(nextStatus as OrderStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      )
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      )
    }

    // Permission checks for non-admin buyers
    if (!isAdmin) {
      if (existingOrder.userId !== currentUserId) {
        return NextResponse.json(
          { success: false, error: "Forbidden: You can only manage your own orders" },
          { status: 403 }
        )
      }
      if (nextStatus !== "CANCELLED") {
        return NextResponse.json(
          { success: false, error: "Forbidden: Only admins can update fulfillment status" },
          { status: 403 }
        )
      }
      if (existingOrder.status.toUpperCase() !== "PENDING") {
        return NextResponse.json(
          { success: false, error: "Only pending orders can be cancelled" },
          { status: 400 }
        )
      }
    }

    const alreadyCancelled = existingOrder.status.toUpperCase() === "CANCELLED"

    if (alreadyCancelled && nextStatus !== "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Cancelled orders cannot be reopened" },
        { status: 400 }
      )
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Restore inventory once when transitioning into CANCELLED
      if (nextStatus === "CANCELLED" && !alreadyCancelled) {
        for (const item of existingOrder.items) {
          if (item.productId) {
            await tx.product.updateMany({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            })
          }
        }
      }

      return tx.order.update({
        where: { id },
        data: { status: nextStatus },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, imageUrl: true },
              },
            },
          },
        },
      })
    })

    return NextResponse.json({ success: true, data: updatedOrder })
  } catch (err) {
    console.error("Error updating order:", err)
    return NextResponse.json(
      { success: false, error: "Failed to update order" },
      { status: 500 }
    )
  }
}