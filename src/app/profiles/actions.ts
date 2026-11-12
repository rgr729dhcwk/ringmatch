"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_STATED_PREFS } from "@/lib/taxonomy";
import { db } from "@/server/db";
import { clearCurrentUser, setCurrentUser } from "@/server/session";

export async function createProfile(formData: FormData) {
  const name = z.string().trim().min(1).max(40).safeParse(formData.get("displayName"));
  if (!name.success) redirect("/profiles?error=name");
  const user = await db.user.create({
    data: {
      displayName: name.data,
      profile: { create: { statedPrefs: JSON.stringify(DEFAULT_STATED_PREFS) } },
    },
  });
  await setCurrentUser(user.id);
  redirect("/");
}

export async function selectProfile(formData: FormData) {
  const id = String(formData.get("userId") ?? "");
  const user = await db.user.findUnique({ where: { id } });
  if (!user) redirect("/profiles");
  await setCurrentUser(user.id);
  redirect("/");
}

export async function signOut() {
  await clearCurrentUser();
  redirect("/profiles");
}
