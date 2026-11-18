import { NextRequest, NextResponse } from "next/server"
import type { UploadApiResponse } from "cloudinary"
import { authenticate } from "@/lib/auth"
import cloudinary from "@/lib/cloudinary"

type JwtPayload = {
  id?: string
  userId?: string
  sub?: string
  role?: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const payload = user as JwtPayload
  const sellerId = payload?.id || payload?.userId || payload?.sub

  if (!sellerId || (payload.role !== "SELLER" && payload.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Valid Seller or Admin token required" },
      { status: 403 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Image file is required" },
        { status: 400 }
      )
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Only image files are allowed" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "Image size must be 5MB or less" },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploaded = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "trio-shopping/products",
          resource_type: "image",
        },
        (err, result) => {
          if (err || !result) {
            reject(err || new Error("Cloudinary upload failed"))
            return
          }
          resolve(result)
        }
      )
      stream.end(buffer)
    })

    return NextResponse.json({
      success: true,
      data: {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      },
    })
  } catch (err) {
    console.error("Cloudinary upload error:", err)
    return NextResponse.json(
      { success: false, error: "Failed to upload image" },
      { status: 500 }
    )
  }
}