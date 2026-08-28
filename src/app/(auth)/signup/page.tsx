import { listJoinableOrgs } from "@/lib/data";
import { SignupForm } from "@/components/signup-form";

// The organization list must reflect orgs created since the last build.
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // Only id + name — enough to ask to join, nothing more.
  const orgs = await listJoinableOrgs();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SignupForm orgs={orgs} />
    </div>
  );
}
