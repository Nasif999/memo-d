"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Searchable dropdown for picking a department by id — same UX as
// DesignationCombobox (type to filter, portaled list so it isn't clipped by
// a scrolling table). Unlike designations, departments are a closed,
// admin-managed list, so there's no "create new" affordance here.
export function DepartmentCombobox({
  value,
  onChange,
  options,
  placeholder,
  id,
  disabled,
  onBlur,
  className,
  onCreate,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; name: string }[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  onBlur?: () => void;
  className?: string;
  // When provided, a "+ Create ..." row lets the caller add a new department
  // on the fly (admin contexts only — the combobox itself has no opinion on
  // who's allowed to create one).
  onCreate?: (name: string) => Promise<{ id: string; name: string } | null>;
}) {
  const [creating, setCreating] = useState(false);
  const selectedName = options.find((o) => o.id === value)?.name ?? "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedName);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setQuery(selectedName), [selectedName]);

  useEffect(() => {
    if (!open) return;
    function place() {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom, left: r.left, width: r.width });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if ((e.target as HTMLElement).closest?.("[data-department-list]")) return;
      setOpen(false);
      setQuery(selectedName);
      onBlur?.();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [selectedName, onBlur]);

  const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name));
  const q = query.trim().toLowerCase();
  const matches = q ? sorted.filter((d) => d.name.toLowerCase().startsWith(q)) : sorted;

  function pick(opt: { id: string; name: string } | null) {
    onChange(opt?.id ?? "");
    setQuery(opt?.name ?? "");
    setOpen(false);
  }

  const exact = sorted.some((d) => d.name.toLowerCase() === q);
  async function create() {
    if (!onCreate) return;
    const name = query.trim();
    setCreating(true);
    const created = await onCreate(name);
    setCreating(false);
    if (created) pick(created);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        disabled={disabled}
        value={query}
        placeholder={placeholder ?? "Select a department…"}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
      {open && !disabled && rect &&
        createPortal(
          <div
            data-department-list
            style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, 180) }}
            className="z-[100] mt-1 max-h-56 overflow-auto rounded-md border border-input bg-background text-sm shadow-md"
          >
            {onCreate && q && !exact && (
              <button
                type="button"
                disabled={creating}
                onMouseDown={(e) => e.preventDefault()}
                onClick={create}
                className="flex w-full items-center gap-1.5 border-b border-input px-3 py-2 text-left text-primary hover:bg-accent disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {creating ? "Creating…" : `Create "${query.trim()}"`}
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(null)}
              className={cn(
                "block w-full px-3 py-2 text-left text-muted-foreground hover:bg-accent",
                !value && "bg-accent"
              )}
            >
              None
            </button>
            {matches.length === 0 && (
              <div className="px-3 py-2 text-muted-foreground">No matching departments.</div>
            )}
            {matches.map((d) => (
              <button
                key={d.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(d)}
                className={cn(
                  "block w-full px-3 py-2 text-left hover:bg-accent",
                  d.id === value && "bg-accent"
                )}
              >
                {d.name}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
