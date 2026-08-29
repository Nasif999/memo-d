// The letter shown in an avatar circle when there's no photo. Skips bare
// initials (e.g. "M", "H.") to land on the person's actual first name —
// "M H Nasif Khan" should show "N", not "M".
export function mainInitial(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  const main = tokens.find((t) => t.replace(/\./g, "").length > 1) ?? tokens[0] ?? "";
  return (main[0] ?? "?").toUpperCase();
}
