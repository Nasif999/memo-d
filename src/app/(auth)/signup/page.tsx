import { listJoinableOrgs } from "@/lib/data";

// The organization list must reflect orgs created since the last build.
export const dynamic = "force-dynamic";
import { SignupForm } from "@/components/signup-form";

export default async function SignupPage() {
  // Only id + name — enough to ask to join, nothing more.
  const orgs = await listJoinableOrgs();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <SignupForm orgs={orgs} />
    </div>
  );
}
