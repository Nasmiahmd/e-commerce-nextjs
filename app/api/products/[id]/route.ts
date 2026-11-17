import { NextRequest, NextResponse } from "next/server"
import { authenticate } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { Prisma } from "@/app/generated/prisma/client"

type RouteParams = { params: Promise<{ id: string }> }

type JwtPayload = {
  id?: string
  userId?: string
  sub?: string
  role?: string
}

// GET /api/products/[id] - Fetch single product details (Public)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        user: {
          select: { id: true, name: true, imageUrl: true }, // Seller details
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error("Error fetching product:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch product" },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Update product details (Owner SELLER or ADMIN)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const payload = user as JwtPayload
  const currentUserId = payload?.id || payload?.userId || payload?.sub

  if (!currentUserId || (payload.role !== "SELLER" && payload.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Seller or Admin access required" },
      { status: 403 }
    )
  }

  try {
    const { id } = await params

    // 1. Check product exists and verify ownership
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    if (existingProduct.userId !== currentUserId && payload.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden: You can only edit your own products" },
        { status: 403 }
      )
    }

    // 2. Validate numeric fields if provided
    const body = await request.json()

    if (body.price !== undefined) {
      const numericPrice = Number(body.price)
      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return NextResponse.json(
          { success: false, error: "Price must be a valid non-negative number" },
          { status: 400 }
        )
      }
    }

    if (body.stock !== undefined) {
      const numericStock = Number(body.stock)
      if (!Number.isInteger(numericStock) || numericStock < 0) {
        return NextResponse.json(
          { success: false, error: "Stock must be a valid non-negative integer" },
          { status: 400 }
        )
      }
    }

    // 3. Update product (including Cloudinary URL + publicId if changed)
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description || null,
        }),
        ...(body.price !== undefined && { price: Number(body.price) }),
        ...(body.stock !== undefined && { stock: Number(body.stock) }),
        ...(body.categoryId !== undefined && {
          categoryId: body.categoryId || null,
        }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.imagePublicId !== undefined && {
          imagePublicId: body.imagePublicId || null,
        }),
        ...(body.isArchived !== undefined && {
          isArchived: Boolean(body.isArchived),
        }),
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: product,
      // Useful if your client/server action cleans up the replaced Cloudinary asset
      previousImagePublicId:
        body.imagePublicId &&
        existingProduct.imagePublicId &&
        body.imagePublicId !== existingProduct.imagePublicId
          ? existingProduct.imagePublicId
          : null,
    })
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid categoryId provided" },
        { status: 400 }
      )
    }

    console.error("Error updating product:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update product" },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Delete or archive product (Owner SELLER or ADMIN)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const payload = user as JwtPayload
  const currentUserId = payload?.id || payload?.userId || payload?.sub

  if (!currentUserId || (payload.role !== "SELLER" && payload.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Seller or Admin access required" },
      { status: 403 }
    )
  }

  try {
    const { id } = await params

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: { select: { orderItems: true } },
      },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    if (existingProduct.userId !== currentUserId && payload.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden: You can only delete your own products" },
        { status: 403 }
      )
    }

    // If the product has past orders, archive it instead of hard-deleting
    if (existingProduct._count.orderItems > 0) {
      await prisma.product.update({
        where: { id },
        data: { isArchived: true },
      })

      return NextResponse.json({
        success: true,
        archived: true,
        message: "Product has existing orders and was archived from the storefront",
      })
    }

    await prisma.product.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      archived: false,
      deletedImagePublicId: existingProduct.imagePublicId,
      message: "Product deleted successfully",
    })
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    console.error("Error deleting product:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete product" },
      { status: 500 }
    )
  }
}