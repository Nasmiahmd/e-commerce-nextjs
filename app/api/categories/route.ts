import { NextRequest, NextResponse } from "next/server"
import { authenticate } from "@/lib/auth"
import prisma from "@/lib/prisma"

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

// GET /api/categories - List all categories with active product counts (Public)
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            products: {
              where: { isArchived: false },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    )
  }
}

// POST /api/categories - Create a new category (ADMIN only)
export async function POST(request: NextRequest) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const payload = user as { role?: string }
  if (payload?.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Forbidden: Admin access required" },
      { status: 403 }
    )
  }

  try {
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

    const category = await prisma.category.create({
      data: { name, slug },
    })

    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "A category with this name or slug already exists",
        },
        { status: 409 }
      )
    }

    console.error("Error creating category:", err)
    return NextResponse.json(
      { success: false, error: "Failed to create category" },
      { status: 500 }
    )
  }
}