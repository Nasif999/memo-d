import { listJoinableOrgs } from "@/lib/data";
import { SignupForm } from "@/components/signup-form";

// The organization list must reflect orgs created since the last build.
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  // Only id + name — enough to ask to join, nothing more.
  const orgs = await listJoinableOrgs();
  // An invite link carries the code in the URL. It only pre-fills the form —
  // the code is still validated server-side when the form is submitted.
  const code = typeof searchParams.code === "string" ? searchParams.code : "";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SignupForm orgs={orgs} invitedCode={code} />
    </div>
  );
}
