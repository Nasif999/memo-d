"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(
        firebaseAuth(),
        email,
        password
      );
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "Sign-in failed.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-1.5">
          <p className="eyebrow">Inter-office memo management</p>
          <h1 className="text-3xl tracking-tight" style={{ letterSpacing: "-0.015em" }}>
            Memo<span className="text-accent">&apos;</span>d<span className="text-accent">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your organization.
          </p>
        </div>
      <Card className="w-full border-t-0">
        <CardHeader className="sr-only">
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Sign in to your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-md border border-destructive/25 bg-state-rejected-wash px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/reset-password" className="underline hover:text-accent">
                Forgot password?
              </Link>
            </p>
            <p className="border-t pt-4 text-center text-sm text-muted-foreground">
              New organization?{" "}
              <Link href="/signup" className="font-medium underline hover:text-accent">
                Create one
              </Link>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Joining an existing organization?{" "}
              <Link href="/signup?mode=join" className="font-medium underline hover:text-accent">
                Request access
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
