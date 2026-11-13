"use server";

import { redirect } from "next/navigation";
import { parseStatedPrefs } from "@/lib/prefs";
import { DEFAULT_STATED_PREFS } from "@/lib/taxonomy";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";

async function save(prefs: unknown) {
  const user = await getCurrentUser();
  if (!user) redirect("/profiles");
  const statedPrefs = JSON.stringify(parseStatedPrefs(prefs));
  await db.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, statedPrefs, onboardedAt: new Date() },
    update: { statedPrefs, onboardedAt: new Date() },
  });
  redirect("/");
}

/** Save onboarding answers (anything invalid becomes "show me everything"). */
export async function savePreferences(prefsJson: string) {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(prefsJson);
  } catch {
    parsed = {};
  }
  await save(parsed);
}

export async function skipOnboarding() {
  await save(DEFAULT_STATED_PREFS);
}
