"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface CategoryFormProps {
  categories?: Category[];
}

const categorySchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).min(2),
  slug: z.string().min(1, { message: "Slug is required" }).min(2).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  description: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export function CategoryForm({ categories = [] }: CategoryFormProps) {
  const router = useRouter();
  const t = useTranslations("categories");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      icon: "",
      parentId: "",
    },
  });

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    form.setValue("name", name);
    if (!form.formState.dirtyFields.slug) {
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      form.setValue("slug", slug);
    }
  };

  async function onSubmit(data: CategoryFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          parentId: data.parentId || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        if (res.status === 401) {
          toast.error("You must be logged in to create a category");
        } else {
          toast.error(error.error || "Failed to create category");
        }
        return;
      }

      const category = await res.json();
      toast.success("Category created successfully");
      router.push(`/categories/${category.slug}`);
    } catch (error) {
      toast.error("Failed to create category");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const rootCategories = categories.filter((c) => !c.parentId);

  return (
    <div className="max-w-2xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Name Field */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("name")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Productivity"
                    {...field}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Slug Field */}
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., productivity"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  URL-friendly identifier (auto-generated from name)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Parent Category */}
          <FormField
            control={form.control}
            name="parentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("parent")} (Optional)</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a parent category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {rootCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Leave empty to create a root category
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description Field */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Brief description of this category"
                    {...field}
                    className="resize-none"
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Icon Field */}
          <FormField
            control={form.control}
            name="icon"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., 🚀"
                    {...field}
                    maxLength={4}
                  />
                </FormControl>
                <FormDescription>
                  Use an emoji or icon character
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("create")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
