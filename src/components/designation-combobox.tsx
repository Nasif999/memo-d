"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Searchable dropdown, sized like the org picker on the "Join an organization"
// signup tab, with a text-filtered list of the org's approved designations.
// Typing a title that isn't in the list yet offers a "Create ..." row —
// picking it just sets that value; the server's ensureDesignation() call
// (on save) adds it to Admin → Designations so it appears everywhere else.
export function DesignationCombobox({
  value,
  onChange,
  options,
  placeholder,
  id,
  disabled,
  onBlur,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  onBlur?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setQuery(value), [value]);

  // The list is portaled to <body> so a scroll-clipping ancestor (e.g. the
  // admin users table's overflow-x-auto wrapper) can't cut it off — but that
  // means its position has to be computed in viewport coordinates instead of
  // relying on CSS `absolute`.
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
      if ((e.target as HTMLElement).closest?.("[data-designation-list]")) return;
      setOpen(false);
      setQuery(value);
      onBlur?.();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [value, onBlur]);

  const sorted = Array.from(new Set(options)).sort((a, b) => a.localeCompare(b));
  const q = query.trim().toLowerCase();
  const matches = q ? sorted.filter((d) => d.toLowerCase().startsWith(q)) : sorted;
  const exact = sorted.some((d) => d.toLowerCase() === q);

  function pick(v: string) {
    onChange(v);
    setQuery(v);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        disabled={disabled}
        value={query}
        placeholder={placeholder ?? "Select a designation…"}
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
            data-designation-list
            style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, 180) }}
            className="z-[100] mt-1 max-h-56 overflow-auto rounded-md border border-input bg-background text-sm shadow-md"
          >
            {q && !exact && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(query.trim())}
                className="flex w-full items-center gap-1.5 border-b border-input px-3 py-2 text-left text-primary hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                Create &quot;{query.trim()}&quot;
              </button>
            )}
            {matches.length === 0 && !q && (
              <div className="px-3 py-2 text-muted-foreground">No designations yet.</div>
            )}
            {matches.map((d) => (
              <button
                key={d}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(d)}
                className={cn(
                  "block w-full px-3 py-2 text-left hover:bg-accent",
                  d === value && "bg-accent"
                )}
              >
                {d}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
