import { NextRequest, NextResponse } from "next/server"
import { authenticate } from "@/lib/auth"
import prisma from "@/lib/prisma"

type JwtPayload = {
  id?: string
  userId?: string
  sub?: string
}

// PUT /api/cart/[id] - Update quantity for a specific cart item
export async function PUT(
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
    const body = await request.json()
    const quantity = Number(body.quantity)

    if (!Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json(
        { success: false, error: "Quantity must be at least 1" },
        { status: 400 }
      )
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, name: true, stock: true, isArchived: true },
        },
      },
    })

    if (!cartItem) {
      return NextResponse.json(
        { success: false, error: "Cart item not found" },
        { status: 404 }
      )
    }

    if (cartItem.userId !== currentUserId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Access denied" },
        { status: 403 }
      )
    }

    if (cartItem.product.isArchived || quantity > cartItem.product.stock) {
      return NextResponse.json(
        {
          success: false,
          error: `Only ${cartItem.product.stock} unit(s) available in stock`,
        },
        { status: 400 }
      )
    }

    const updated = await prisma.cartItem.update({
      where: { id },
      data: { quantity },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            imageUrl: true,
            isArchived: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error("Error updating cart item:", err)
    return NextResponse.json(
      { success: false, error: "Failed to update cart item" },
      { status: 500 }
    )
  }
}

// DELETE /api/cart/[id] - Remove a single item from the cart
export async function DELETE(
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
    const cartItem = await prisma.cartItem.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!cartItem) {
      return NextResponse.json(
        { success: false, error: "Cart item not found" },
        { status: 404 }
      )
    }

    if (cartItem.userId !== currentUserId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Access denied" },
        { status: 403 }
      )
    }

    await prisma.cartItem.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: "Item removed from cart" })
  } catch (err) {
    console.error("Error removing cart item:", err)
    return NextResponse.json(
      { success: false, error: "Failed to remove cart item" },
      { status: 500 }
    )
  }
}