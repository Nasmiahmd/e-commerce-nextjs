import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { Prisma } from "@/app/generated/prisma/client"

type RouteParams = { params: Promise<{ id: string }> }

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

// GET /api/categories/[id] - Fetch a single category with its active products (Public)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          where: { isArchived: false },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            products: {
              where: { isArchived: false },
            },
          },
        },
      },
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error("Error fetching category:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch category" },
      { status: 500 }
    )
  }
}

// PUT /api/categories/[id] - Update category name and slug (ADMIN only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin(request)
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Category name is required" },
        { status: 400 }
      )
    }

    const slug =
      typeof body.slug === "string" && body.slug.trim()
        ? generateSlug(body.slug)
        : generateSlug(name)

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: "Category name must contain valid alphanumeric characters",
        },
        { status: 400 }
      )
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
      },
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { success: false, error: "Category not found" },
          { status: 404 }
        )
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          {
            success: false,
            error: "A category with this name or slug already exists",
          },
          { status: 409 }
        )
      }
    }

    console.error("Error updating category:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update category" },
      { status: 500 }
    )
  }
}

// DELETE /api/categories/[id] - Delete a category (ADMIN only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin(request)
  if (error) return error

  try {
    const { id } = await params

    // Product.category uses onDelete: SetNull, so existing products stay intact with categoryId = null
    await prisma.category.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
    })
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      )
    }

    console.error("Error deleting category:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete category" },
      { status: 500 }
    )
  }
}