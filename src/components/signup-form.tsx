"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  registerOrganization, requestToJoin, orgDesignations,
} from "@/app/(auth)/signup/actions";
import { DESIGNATION_SUGGESTIONS } from "@/lib/designations";
import { DEPARTMENT_SUGGESTIONS } from "@/lib/departments";
import { DesignationCombobox } from "@/components/designation-combobox";
import { WorkflowFlow } from "@/components/workflow-flow";
import { PasswordInput } from "@/components/ui/password-input";
import { ImagePicker } from "@/components/image-picker";
import { mainInitial } from "@/lib/name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Mode = "create" | "request";

const MODES: { key: Mode; label: string; blurb: string }[] = [
  {
    key: "create",
    label: "Create organization",
    blurb: "Set up a new workspace. You become its first administrator.",
  },
  {
    key: "request",
    label: "Join an organization",
    blurb: "Ask an administrator to approve your account.",
  },
];

const CREATE_STEPS = ["Basics", "Departments", "Workflow"] as const;

export function SignupForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode: Mode = searchParams.get("mode") === "join" ? "request" : "create";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    orgName: "",
    identifier: "",
    fullName: "",
    email: "",
    password: "",
    designation: "",
    orgId: "",
  });
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [orgLogoDataUrl, setOrgLogoDataUrl] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [customDept, setCustomDept] = useState("");
  const [workflowName, setWorkflowName] = useState("Default Workflow");
  const [workflowSteps, setWorkflowSteps] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [joinDesignations, setJoinDesignations] = useState<string[]>([]);

  // The joining org's own approved titles — same list an admin would see —
  // rather than the generic starter set used when there's no org yet.
  useEffect(() => {
    if (mode !== "request" || !form.orgId) {
      setJoinDesignations([]);
      return;
    }
    let cancelled = false;
    orgDesignations(form.orgId).then((names) => {
      if (!cancelled) setJoinDesignations(names);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, form.orgId]);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { value } = e.target;
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  function fail(message: string) {
    setError(message);
    setLoading(false);
  }

  function toggleDept(name: string) {
    setDepartments((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name]
    );
  }

  function addCustomDept() {
    const name = customDept.trim();
    if (!name || departments.includes(name)) return;
    setDepartments((prev) => [...prev, name]);
    setCustomDept("");
  }

  function validateStep1() {
    if (!form.orgName.trim()) return "Enter an organization name.";
    if (!form.identifier.trim()) return "Enter a short code.";
    if (!form.fullName.trim()) return "Enter your full name.";
    if (!form.email.trim()) return "Enter your work email.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    return null;
  }

  function goNext() {
    setError(null);
    if (step === 0) {
      const err = validateStep1();
      if (err) return setError(err);
    }
    setStep((s) => s + 1);
  }

  async function signIn() {
    try {
      const cred = await signInWithEmailAndPassword(
        firebaseAuth(),
        form.email,
        form.password
      );
      const idToken = await cred.user.getIdToken();
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      router.push("/login");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "create") {
      if (step < CREATE_STEPS.length - 1) {
        goNext();
        return;
      }
      const steps = workflowSteps.map((s) => s.trim()).filter(Boolean);
      if (steps.length === 0) {
        return fail("Define at least one workflow step, e.g. \"Department Head\".");
      }
      if (!workflowName.trim()) {
        return fail("Give this workflow a name, e.g. \"Purchase Request\".");
      }
      setLoading(true);
      const res = await registerOrganization({
        ...form, departments, workflowName: workflowName.trim(), workflowSteps: steps,
        photoDataUrl: photoDataUrl ?? undefined,
        orgLogoDataUrl: orgLogoDataUrl ?? undefined,
      });
      if (res.error) return fail(res.error);
      await signIn();
      return;
    }

    setLoading(true);
    if (!form.orgId) return fail("Choose an organization.");
    const res = await requestToJoin({ ...form, photoDataUrl: photoDataUrl ?? undefined });
    if (res.error) return fail(res.error);
    setLoading(false);
    setSubmitted(res.orgName ?? "your organization");
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Request sent</CardTitle>
          <CardDescription>
            Your request to join <strong>{submitted}</strong> is awaiting
            approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            An administrator must approve your account before you can sign in.
            You will be able to log in as{" "}
            <span className="font-mono">{form.email}</span> once they do.
          </p>
          <Button className="w-full" onClick={() => router.push("/login")}>
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  const active = MODES.find((m) => m.key === mode)!;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Get started on Memo&apos;d</CardTitle>
        <CardDescription>{active.blurb}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMode(m.key);
                setStep(0);
                setError(null);
              }}
              className={
                mode === m.key
                  ? "rounded-md bg-card px-2 py-2 text-xs font-medium text-foreground shadow-sm"
                  : "rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "create" && (
          <div className="mb-5 flex items-center gap-2">
            {CREATE_STEPS.map((label, i) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                        ? "border-2 border-primary text-primary"
                        : "border border-border text-muted-foreground"
                  )}
                >
                  {i + 1}
                </div>
                <span
                  className={cn(
                    "text-xs",
                    i === step ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
                {i < CREATE_STEPS.length - 1 && (
                  <span className="h-px flex-1 bg-border" />
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === "create" && step === 0 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">
                Organization
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="orgName">Organization name</Label>
                  <Input
                    id="orgName"
                    required
                    value={form.orgName}
                    onChange={set("orgName")}
                    placeholder="Acme Corporation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="identifier">Short code</Label>
                  <Input
                    id="identifier"
                    required
                    value={form.identifier}
                    onChange={set("identifier")}
                    placeholder="ACME"
                    maxLength={10}
                    className="uppercase"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The short code prefixes every memo number, e.g.{" "}
                <span className="font-mono">
                  {(form.identifier || "ACME").toUpperCase()}-
                  {new Date().getFullYear()}-00001
                </span>
              </p>

              <div className="space-y-2">
                <Label>Organization logo (optional)</Label>
                <ImagePicker
                  value={orgLogoDataUrl}
                  onChange={setOrgLogoDataUrl}
                  fallback={(form.identifier || "?").slice(0, 3).toUpperCase()}
                  label="Add logo"
                />
                <p className="text-xs text-muted-foreground">
                  Skip it and the short code shows in its place until one is added.
                </p>
              </div>

              <div className="space-y-4 border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Administrator account
                </p>
                <div className="space-y-2">
                  <Label>Your photo (optional)</Label>
                  <ImagePicker
                    value={photoDataUrl}
                    onChange={setPhotoDataUrl}
                    fallback={mainInitial(form.fullName || "?")}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      required
                      value={form.fullName}
                      onChange={set("fullName")}
                      placeholder="Alice Rahman"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation</Label>
                    <DesignationCombobox
                      id="designation"
                      value={form.designation}
                      onChange={(v) =>
                        setForm((prev) => ({ ...prev, designation: v }))
                      }
                      options={[...DESIGNATION_SUGGESTIONS]}
                      placeholder="Administrator"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={set("email")}
                    placeholder="you@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="At least 8 characters"
                  />
                </div>
              </div>
            </div>
          )}

          {mode === "create" && step === 1 && (
            <div className="space-y-3">
              <div>
                <Label>Departments</Label>
                <p className="text-xs text-muted-foreground">
                  Pick the ones that apply — you can rename, deactivate, or add
                  more later from Admin → Departments.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {DEPARTMENT_SUGGESTIONS.map((name) => {
                  const picked = departments.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleDept(name)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        picked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background text-foreground hover:bg-accent"
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
                {departments
                  .filter((d) => !(DEPARTMENT_SUGGESTIONS as readonly string[]).includes(d))
                  .map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleDept(name)}
                      className="rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    >
                      {name} ×
                    </button>
                  ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={customDept}
                  onChange={(e) => setCustomDept(e.target.value)}
                  placeholder="Add your own department"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomDept();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addCustomDept}>
                  Add
                </Button>
              </div>
              {departments.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  None selected yet — that&apos;s fine, you can add departments
                  any time from the admin panel.
                </p>
              )}
            </div>
          )}

          {mode === "create" && step === 2 && (
            <div className="space-y-2">
              <Label htmlFor="workflowName">Workflow name</Label>
              <Input
                id="workflowName"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g. Purchase Request"
              />
              <p className="text-xs text-muted-foreground">
                Who does a memo pass through, in order, after the author? At
                least one step is required — you can add more named workflows
                later from Admin → Workflow Templates.
              </p>
              <WorkflowFlow steps={workflowSteps.map((s) => s.trim()).filter(Boolean)} />
              {workflowSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
                    {i + 1}.
                  </span>
                  <Input
                    value={s}
                    placeholder={i === 0 ? "Department Head" : "Director"}
                    onChange={(e) => {
                      const next = [...workflowSteps];
                      next[i] = e.target.value;
                      setWorkflowSteps(next);
                    }}
                  />
                  {workflowSteps.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setWorkflowSteps(workflowSteps.filter((_, j) => j !== i))
                      }
                      className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setWorkflowSteps([...workflowSteps, ""])}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Add step
              </button>
            </div>
          )}

          {mode === "request" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="orgId">Organization</Label>
                <select
                  id="orgId"
                  required
                  value={form.orgId}
                  onChange={set("orgId")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select your organization…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Your account stays inactive — with no access to any memo — until
                  an administrator approves it.
                </p>
              </div>

              <div className="space-y-4 border-t pt-5">
                <p className="text-sm font-medium text-muted-foreground">
                  Your account
                </p>
                <div className="space-y-2">
                  <Label>Your photo (optional)</Label>
                  <ImagePicker
                    value={photoDataUrl}
                    onChange={setPhotoDataUrl}
                    fallback={mainInitial(form.fullName || "?")}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      required
                      value={form.fullName}
                      onChange={set("fullName")}
                      placeholder="Alice Rahman"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation</Label>
                    <DesignationCombobox
                      id="designation"
                      value={form.designation}
                      onChange={(v) =>
                        setForm((prev) => ({ ...prev, designation: v }))
                      }
                      options={joinDesignations}
                      disabled={!form.orgId}
                      placeholder={
                        form.orgId ? "Head of Finance" : "Choose an organization first"
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={set("email")}
                    placeholder="you@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="At least 8 characters"
                  />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            {mode === "create" && step > 0 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setError(null);
                  setStep((s) => s - 1);
                }}
              >
                Back
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading
                ? "Working…"
                : mode === "request"
                  ? "Request to join"
                  : step < CREATE_STEPS.length - 1
                    ? "Next"
                    : "Create organization"}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
