import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { CategoryForm } from "@/components/categories/category-form";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Create Category",
  description: "Create a new category",
};

export default async function NewCategoryPage() {
  const session = await auth();
  const t = await getTranslations("categories");

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch all categories for parent selection
  const categories = await db.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
    },
  });

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("create")}</h1>
        <p className="text-muted-foreground mt-1">Add a new category to the community</p>
      </div>

      <CategoryForm categories={categories} />
    </div>
  );
}
