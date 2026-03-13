import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Create category (public endpoint for logged-in users)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, description, icon, parentId } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: "Slug must be lowercase letters, numbers, and hyphens only" }, { status: 400 });
    }

    // Check if slug already exists
    const existingCategory = await db.category.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      return NextResponse.json({ error: "This slug is already in use" }, { status: 400 });
    }

    // If parentId is provided, verify it exists
    if (parentId) {
      const parentCategory = await db.category.findUnique({
        where: { id: parentId },
      });

      if (!parentCategory) {
        return NextResponse.json({ error: "Parent category not found" }, { status: 400 });
      }
    }

    const category = await db.category.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        parentId: parentId || null,
        pinned: false, // Regular users cannot pin categories
      },
    });

    revalidateTag("categories", "now");
    revalidatePath("/categories");

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
