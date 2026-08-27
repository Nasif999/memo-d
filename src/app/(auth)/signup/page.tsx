"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { registerOrganization } from "./actions";
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

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    orgName: "",
    identifier: "",
    fullName: "",
    email: "",
    password: "",
    designation: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await registerOrganization(form);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    // Sign the new administrator in and establish the session cookie.
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Create your organization</CardTitle>
          <CardDescription>
            Set up a new workspace on Memo&apos;d. You&apos;ll become its first
            administrator and can invite colleagues afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div className="space-y-4 border-t pt-5">
              <p className="text-sm font-medium text-muted-foreground">
                Administrator account
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
                    value={form.designation}
                    onChange={set("designation")}
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
              {loading ? "Creating organization…" : "Create organization"}
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
    </div>
  );
}
