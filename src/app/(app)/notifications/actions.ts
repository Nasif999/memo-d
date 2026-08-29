"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { listNotifications, markAllNotificationsRead } from "@/lib/data";

export async function fetchNotifications() {
  const profile = await requireProfile();
  return listNotifications(profile.id);
}

export async function markAllRead() {
  const profile = await requireProfile();
  await markAllNotificationsRead(profile.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
