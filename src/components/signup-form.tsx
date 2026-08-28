"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  DESIGNATION_SUGGESTIONS,
  DESIGNATION_LIST_ID,
} from "@/lib/designations";
import { registerOrganization, requestToJoin } from "@/app/(auth)/signup/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function SignupForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [form, setForm] = useState({
    orgName: "",
    identifier: "",
    fullName: "",
    email: "",
    password: "",
    designation: "",
    orgId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    if (mode === "create") {
      const res = await registerOrganization(form);
      if (res.error) return fail(res.error);
      await signIn();
      return;
    }

    if (!form.orgId) return fail("Choose an organization.");
    const res = await requestToJoin(form);
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
                setError(null);
              }}
              className={
                mode === m.key
                  ? "rounded-md bg-white px-2 py-2 text-xs font-medium text-slate-900 shadow-sm"
                  : "rounded-md px-2 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === "create" && (
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
            </div>
          )}

          {mode === "request" && (
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
          )}

          <div className="space-y-4 border-t pt-5">
            <p className="text-sm font-medium text-muted-foreground">
              {mode === "create" ? "Administrator account" : "Your account"}
            </p>
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
                <Input
                  id="designation"
                  list={DESIGNATION_LIST_ID}
                  value={form.designation}
                  onChange={set("designation")}
                  placeholder={
                    mode === "create" ? "Administrator" : "Head of Finance"
                  }
                />
                {/* Suggestions only — any other title can still be typed. */}
                <datalist id={DESIGNATION_LIST_ID}>
                  {DESIGNATION_SUGGESTIONS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
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
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={set("password")}
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Working…"
              : mode === "create"
                ? "Create organization"
                : "Request to join"}
          </Button>
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
