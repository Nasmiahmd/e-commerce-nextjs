import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/products - Browse, search, and filter active products (Public)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") || undefined; // category slug
    const categoryId = searchParams.get("categoryId") || undefined;
    const search = searchParams.get("search") || undefined;
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const inStock = searchParams.get("inStock") === "true";

    const products = await prisma.product.findMany({
      where: {
        isArchived: false, // Exclude archived/soft-deleted products
        ...(categoryId && { categoryId }),
        ...(category && { category: { slug: category } }),
        ...(inStock && { stock: { gt: 0 } }),
        ...((minPrice || maxPrice) && {
          price: {
            ...(minPrice && { gte: Number(minPrice) }),
            ...(maxPrice && { lte: Number(maxPrice) }),
          },
        }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        user: {
          select: { id: true, name: true }, // Seller info
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}

// POST /api/products - Create a new product (SELLER & ADMIN)
export async function POST(request: NextRequest) {
  const { user, error } = await authenticate(request);
  if (error) return error;

  // Support common JWT payload ID keys (id, userId, or sub)
  const payload = user as { id?: string; userId?: string; sub?: string; role?: string };
  const sellerId = payload?.id || payload?.userId || payload?.sub;

  if (!sellerId || (payload.role !== "SELLER" && payload.role !== "ADMIN")) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden: Valid Seller or Admin token required",
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      price,
      stock,
      categoryId,
      imageUrl,
      imagePublicId,
    } = body;

    if (!name || price === undefined || price === null || !imageUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name, price, imageUrl",
        },
        { status: 400 },
      );
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json(
        { success: false, error: "Price must be a valid non-negative number" },
        { status: 400 },
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || null,
        price: numericPrice,
        stock: stock !== undefined ? Number(stock) : 0,
        imageUrl,
        imagePublicId: imagePublicId || null,
        user: {
          connect: { id: sellerId }, // Use sellerId instead of user.id
        },
        ...(categoryId && {
          category: {
            connect: { id: categoryId },
          },
        }),
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create product" },
      { status: 500 },
    );
  }
}