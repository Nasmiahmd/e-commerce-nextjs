import { NextRequest, NextResponse } from "next/server"
import { authenticate } from "@/lib/auth"
import prisma from "@/lib/prisma"

type JwtPayload = {
  id?: string
  userId?: string
  sub?: string
  role?: string
}

// GET /api/orders - Fetch current user's orders (or all orders for ADMIN)
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
    const orders = await prisma.order.findMany({
      where: payload.role === "ADMIN" ? {} : { userId: currentUserId },
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
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: orders })
  } catch (err) {
    console.error("Error fetching orders:", err)
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create an order from Direct Buy items or Cart
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
    const fromCart = Boolean(body.fromCart)
    const shippingAddress =
      typeof body.shippingAddress === "string" ? body.shippingAddress.trim() : ""

    if (!shippingAddress) {
      return NextResponse.json(
        { success: false, error: "Shipping address is required" },
        { status: 400 }
      )
    }

    let requestedItems: { productId: string; quantity: number }[] = []

    if (fromCart) {
      const cartItems = await prisma.cartItem.findMany({
        where: { userId: currentUserId },
        select: { productId: true, quantity: true },
      })

      if (cartItems.length === 0) {
        return NextResponse.json(
          { success: false, error: "Your cart is empty" },
          { status: 400 }
        )
      }
      requestedItems = cartItems
    } else if (Array.isArray(body.items) && body.items.length > 0) {
      requestedItems = body.items.map(
        (item: { productId: string; quantity?: number }) => ({
          productId: item.productId,
          quantity: Number(item.quantity ?? 1),
        })
      )
    } else {
      return NextResponse.json(
        { success: false, error: "Order items are required" },
        { status: 400 }
      )
    }

    for (const item of requestedItems) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: "Each item must have a valid productId and positive quantity" },
          { status: 400 }
        )
      }
    }

    const createdOrder = await prisma.$transaction(async (tx) => {
      const productIds = requestedItems.map((i) => i.productId)
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
      })

      const productMap = new Map(dbProducts.map((p) => [p.id, p]))
      let totalAmount = 0

      const orderItemsData = requestedItems.map((item) => {
        const product = productMap.get(item.productId)
        if (!product || product.isArchived) {
          throw new Error("One or more selected products are no longer available")
        }
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for "${product.name}" (${product.stock} available)`)
        }

        const unitPrice = Number(product.price)
        totalAmount += unitPrice * item.quantity

        return {
          productId: product.id,
          productName: product.name,
          priceAtPurchase: unitPrice,
          quantity: item.quantity,
        }
      })

      for (const item of orderItemsData) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
      }

      const order = await tx.order.create({
        data: {
          userId: currentUserId,
          totalAmount,
          status: "PENDING",
          shippingAddress,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, imageUrl: true },
              },
            },
          },
        },
      })

      if (fromCart) {
        await tx.cartItem.deleteMany({
          where: { userId: currentUserId },
        })
      }

      return order
    })

    return NextResponse.json({ success: true, data: createdOrder }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create order"
    const isClientError =
      message.includes("stock") ||
      message.includes("no longer available") ||
      message.includes("empty")

    console.error("Error creating order:", err)
    return NextResponse.json(
      { success: false, error: message },
      { status: isClientError ? 400 : 500 }
    )
  }
}