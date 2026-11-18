import { NextRequest, NextResponse } from "next/server"
import { authenticate } from "@/lib/auth"
import prisma from "@/lib/prisma"

type JwtPayload = {
  id?: string
  userId?: string
  sub?: string
  role?: string
}

const cartItemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      imageUrl: true,
      isArchived: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
}

// GET /api/cart - Fetch all cart items for the logged-in user
export async function GET(request: NextRequest) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const payload = user as JwtPayload
  const currentUserId = payload?.id || payload?.userId || payload?.sub

  if (!currentUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid token payload" },
      { status: 401 }
    )
  }

  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: currentUserId },
      include: cartItemInclude,
      orderBy: { id: "asc" },
    })

    return NextResponse.json({ success: true, data: cartItems })
  } catch (err) {
    console.error("Error fetching cart:", err)
    return NextResponse.json(
      { success: false, error: "Failed to fetch cart items" },
      { status: 500 }
    )
  }
}

// POST /api/cart - Add a product to the cart or increment its quantity
export async function POST(request: NextRequest) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const payload = user as JwtPayload
  const currentUserId = payload?.id || payload?.userId || payload?.sub

  if (!currentUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid token payload" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const productId = typeof body.productId === "string" ? body.productId.trim() : ""
    const quantity = Number(body.quantity ?? 1)

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      )
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: "Quantity must be a positive integer" },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        stock: true,
        isArchived: true,
      },
    })

    if (!product || product.isArchived) {
      return NextResponse.json(
        { success: false, error: "Product is no longer available" },
        { status: 404 }
      )
    }

    if (product.stock <= 0) {
      return NextResponse.json(
        { success: false, error: `"${product.name}" is out of stock` },
        { status: 400 }
      )
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        userId: currentUserId,
        productId,
      },
    })

    const nextQuantity = (existingItem?.quantity ?? 0) + quantity

    if (nextQuantity > product.stock) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot add ${quantity} more. Only ${product.stock} available in stock`,
        },
        { status: 400 }
      )
    }

    const savedItem = existingItem
      ? await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: nextQuantity },
          include: cartItemInclude,
        })
      : await prisma.cartItem.create({
          data: {
            userId: currentUserId,
            productId,
            quantity,
          },
          include: cartItemInclude,
        })

    return NextResponse.json(
      { success: true, data: savedItem },
      { status: existingItem ? 200 : 201 }
    )
  } catch (err) {
    console.error("Error adding to cart:", err)
    return NextResponse.json(
      { success: false, error: "Failed to add item to cart" },
      { status: 500 }
    )
  }
}

// DELETE /api/cart - Clear all items in the logged-in user's cart
export async function DELETE(request: NextRequest) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const payload = user as JwtPayload
  const currentUserId = payload?.id || payload?.userId || payload?.sub

  if (!currentUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid token payload" },
      { status: 401 }
    )
  }

  try {
    await prisma.cartItem.deleteMany({
      where: { userId: currentUserId },
    })

    return NextResponse.json({ success: true, message: "Cart cleared" })
  } catch (err) {
    console.error("Error clearing cart:", err)
    return NextResponse.json(
      { success: false, error: "Failed to clear cart" },
      { status: 500 }
    )
  }
}