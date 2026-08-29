"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createDelegationAction,
  revokeDelegationAction,
} from "@/app/(app)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const selectClass = "h-9 w-full rounded-md border bg-card px-2 text-sm";

export type DelegationRow = {
  id: string;
  delegatorId: string;
  delegateId: string;
  delegatorName: string;
  delegateName: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  isActive: boolean;
  direction: "outgoing" | "incoming";
};

export function DelegationPanel({
  currentUserId,
  members,
  delegations,
}: {
  currentUserId: string;
  members: { id: string; full_name: string; designation: string | null }[];
  delegations: DelegationRow[];
}) {
  const router = useRouter();
  const [delegateId, setDelegateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!delegateId || !startDate || !endDate) {
      return toast.error("Pick a delegate and a date range.");
    }
    setBusy(true);
    const res = await createDelegationAction({ delegateId, startDate, endDate, reason });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Delegation created");
    setDelegateId("");
    setStartDate("");
    setEndDate("");
    setReason("");
    router.refresh();
  }

  async function revoke(id: string) {
    setBusy(true);
    const res = await revokeDelegationAction(id);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Delegation revoked");
    router.refresh();
  }

  const today = new Date().toISOString().slice(0, 10);
  const outgoing = delegations.filter((d) => d.direction === "outgoing");
  const incoming = delegations.filter((d) => d.direction === "incoming");

  return (
    <Card>
      <CardHeader><CardTitle>Delegation</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Let someone else act on your behalf on memos awaiting your turn, for a
          set date range. Actions they take will record both of you.
        </p>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1 md:col-span-2">
            <Label>Delegate to</Label>
            <select className={selectClass} value={delegateId}
              onChange={(e) => setDelegateId(e.target.value)}>
              <option value="">Select user</option>
              {members.filter((u) => u.id !== currentUserId).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}{u.designation ? ` — ${u.designation}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Start date</Label>
            <Input type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>End date</Label>
            <Input type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-3">
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. On leave" />
          </div>
          <div className="flex items-end">
            <Button onClick={create} disabled={busy} className="w-full">
              Create delegation
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="eyebrow">Delegations you&apos;ve granted</p>
          {outgoing.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {outgoing.map((d) => {
                const active = d.isActive && d.startDate <= today && today <= d.endDate;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      <strong>{d.delegateName}</strong> · {d.startDate} to {d.endDate}
                      {d.reason ? ` · ${d.reason}` : ""}
                      {!d.isActive && <span className="ml-2 text-xs text-muted-foreground">(revoked)</span>}
                      {d.isActive && !active && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
                      {active && <span className="ml-2 text-xs text-state-approved">(active now)</span>}
                    </span>
                    {d.isActive && (
                      <Button variant="outline" size="sm" disabled={busy}
                        onClick={() => revoke(d.id)}>
                        Revoke
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="eyebrow">Delegations granted to you</p>
          {incoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {incoming.map((d) => {
                const active = d.isActive && d.startDate <= today && today <= d.endDate;
                return (
                  <li key={d.id} className="px-3 py-2 text-sm">
                    On behalf of <strong>{d.delegatorName}</strong> · {d.startDate} to {d.endDate}
                    {d.reason ? ` · ${d.reason}` : ""}
                    {!d.isActive && <span className="ml-2 text-xs text-muted-foreground">(revoked)</span>}
                    {d.isActive && !active && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
                    {active && <span className="ml-2 text-xs text-state-approved">(active now)</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
