"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { MAX_AVATAR_BYTES } from "@/lib/image";

// A circular avatar/logo preview with an "Add photo" button that opens the
// native file picker, reads the file client-side, and hands the parent a
// data: URI — used wherever a photo is optional and small enough to store
// inline (signup, org settings) rather than needing real file storage.
export function ImagePicker({
  value,
  onChange,
  fallback,
  size = 56,
  label = "Add photo",
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  fallback: string;
  size?: number;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setError(`Image too large (max ${Math.round(MAX_AVATAR_BYTES / 1024)} KB).`);
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar src={value} fallback={fallback} size={size} />
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFile}
      />
      <div className="space-y-1">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          {value ? "Change photo" : label}
        </Button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="block text-xs text-muted-foreground hover:text-destructive"
          >
            Remove
          </button>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
