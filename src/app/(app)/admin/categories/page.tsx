import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SimpleCrud } from "@/components/admin/simple-crud";
import { upsertCategory, setCategoryActive } from "../actions";

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("memo_categories")
    .select("id, name, description, is_active")
    .order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Memo Categories</h1>
      <SimpleCrud
        title="Category"
        items={categories ?? []}
        onSave={upsertCategory}
        onToggle={setCategoryActive}
      />
    </div>
  );
}
