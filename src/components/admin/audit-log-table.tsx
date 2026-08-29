"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Entry = {
  id: string;
  actorId: string | null;
  actorName: string;
  eventType: string;
  entityType: string | null;
  description: string | null;
  createdAt: string;
};

type SortKey = "createdAt" | "actorName" | "eventType";

export function AuditLogTable({ entries }: { entries: Entry[] }) {
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const eventTypes = useMemo(
    () => Array.from(new Set(entries.map((e) => e.eventType))).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = entries;
    if (eventType !== "all") rows = rows.filter((e) => e.eventType === eventType);
    if (q) {
      rows = rows.filter((e) =>
        [e.actorName, e.eventType, e.entityType, e.description]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    const sorted = [...rows].sort((a, b) => {
      const cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [entries, query, eventType, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  }

  function SortHeader({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) {
    const active = sortKey === sortKeyName;
    return (
      <TableHead
        className="cursor-pointer select-none whitespace-nowrap"
        onClick={() => toggleSort(sortKeyName)}
      >
        {label}
        {active && <span className="ml-1 text-muted-foreground">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </TableHead>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search user, event, description…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="all">All events</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {entries.length}
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Time" sortKeyName="createdAt" />
              <SortHeader label="User" sortKeyName="actorName" />
              <SortHeader label="Event" sortKeyName="eventType" />
              <TableHead>Entity</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No matching events.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {format(new Date(e.createdAt), "PP p")}
                </TableCell>
                <TableCell>{e.actorName}</TableCell>
                <TableCell className="font-mono text-xs">{e.eventType}</TableCell>
                <TableCell>{e.entityType ?? "—"}</TableCell>
                <TableCell className="max-w-md truncate text-sm">
                  {e.description ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
