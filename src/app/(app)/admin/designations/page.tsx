import { requireAdmin } from "@/lib/auth";
import { listDesignations } from "@/lib/data";
import { SimpleCrud } from "@/components/admin/simple-crud";
import { upsertDesignationEntry, setDesignationEntryActive } from "../actions";

export default async function AdminDesignationsPage() {
  const admin = await requireAdmin();
  const designations = await listDesignations(admin.orgId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Designations</h1>
      <p className="text-sm text-muted-foreground">
        The approved job titles members can pick from when joining or being
        assigned a title. Anyone typing a new title elsewhere adds it here
        automatically — manage or retire them below.
      </p>
      <SimpleCrud
        title="Designation"
        items={designations.map((d) => ({
          id: d.id,
          name: d.name,
          description: null,
          is_active: d.isActive !== false,
        }))}
        onSave={(input, id) => upsertDesignationEntry({ ...input, description: "" }, id)}
        onToggle={setDesignationEntryActive}
      />
    </div>
  );
}
