// Shared limits for photos/logos submitted as base64 data: URIs (org logo,
// signup avatars) — small images stored directly on the doc, no file storage
// bucket needed.
export const MAX_AVATAR_BYTES = 500 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

const DATA_URL_RE = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/;

// Returns the data URL back if it's a well-formed, small-enough image, else
// null. Client-side validation is UX only — this is what actually enforces
// the limit, since a signup action has no session yet to gate it any other way.
export function validateImageDataUrl(value: unknown, maxBytes = MAX_AVATAR_BYTES): string | null {
  if (typeof value !== "string" || !value) return null;
  const match = DATA_URL_RE.exec(value);
  if (!match) return null;
  const [, mimeType, base64] = match;
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) return null;
  const approxBytes = (base64.length * 3) / 4;
  if (approxBytes > maxBytes) return null;
  return value;
}
