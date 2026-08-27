"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase/admin";
import { requireProfile } from "@/lib/auth";

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
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}
