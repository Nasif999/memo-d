"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase/admin";
import { requireProfile } from "@/lib/auth";
import { createDelegation, revokeDelegation, ensureDesignation } from "@/lib/data";
import { validateImageDataUrl } from "@/lib/image";

const schema = z.object({
  full_name: z.string().trim().min(1).max(120),
  designation: z.string().trim().max(120),
});

// Users may update only their own display fields — role/org/status are
// admin-only and never accepted here.
export async function updateOwnProfile(input: z.infer<typeof schema>) {
  const profile = await requireProfile();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid profile data." };
  await db().collection("profiles").doc(profile.id).update({
    fullName: parsed.data.full_name,
    designation: parsed.data.designation || null,
  });
  if (parsed.data.designation) await ensureDesignation(profile.orgId, parsed.data.designation);
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

// Pass null to remove the current photo (falls back to the initial avatar).
export async function updateOwnPhoto(photoDataUrl: string | null) {
  const profile = await requireProfile();
  const photoUrl = photoDataUrl ? validateImageDataUrl(photoDataUrl) : null;
  if (photoDataUrl && !photoUrl) return { error: "Invalid or too-large image." };
  await db().collection("profiles").doc(profile.id).update({ photoUrl });
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

const delegationSchema = z.object({
  delegateId: z.string().trim().min(1),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(500).optional(),
});

export async function createDelegationAction(input: z.infer<typeof delegationSchema>) {
  const profile = await requireProfile();
  const parsed = delegationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid delegation." };
  try {
    await createDelegation(
      profile.orgId, profile.id,
      parsed.data.delegateId, parsed.data.startDate, parsed.data.endDate,
      parsed.data.reason ?? null
    );
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/profile");
  return { ok: true };
}

export async function revokeDelegationAction(delegationId: string) {
  const profile = await requireProfile();
  try {
    await revokeDelegation(profile.orgId, profile, delegationId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/profile");
  return { ok: true };
}
