import { requireAdmin } from "@/lib/auth";
import { listCategories } from "@/lib/data";
import { SimpleCrud } from "@/components/admin/simple-crud";
import { upsertCategory, setCategoryActive } from "../actions";

export default async function AdminCategoriesPage() {
  const admin = await requireAdmin();
  const categories = await listCategories(admin.orgId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Memo Categories</h1>
      <SimpleCrud
        title="Category"
        items={categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? null,
          is_active: c.isActive !== false,
        }))}
        onSave={upsertCategory}
        onToggle={setCategoryActive}
      />
    </div>
  );
}
