"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createInvite, joinWithCode, leavePartnership, setBlend, setSurprise } from "@/server/couple";
import { getCurrentUser } from "@/server/session";

async function me() {
  const u = await getCurrentUser();
  if (!u) redirect("/profiles");
  return u;
}

export async function createInviteAction() {
  const u = await me();
  const r = await createInvite(u.id);
  revalidatePath("/partner");
  if ("error" in r) redirect(`/partner?error=${encodeURIComponent(r.error)}`);
  redirect("/partner");
}

export async function joinAction(formData: FormData) {
  const u = await me();
  const r = await joinWithCode(u.id, String(formData.get("code") ?? ""));
  revalidatePath("/partner");
  if ("error" in r) redirect(`/partner?error=${encodeURIComponent(r.error)}&code=${encodeURIComponent(String(formData.get("code") ?? ""))}`);
  redirect("/partner?joined=1");
}

export async function leaveAction() {
  const u = await me();
  await leavePartnership(u.id);
  revalidatePath("/partner");
  redirect("/partner");
}

export async function surpriseAction(formData: FormData) {
  const u = await me();
  await setSurprise(u.id, formData.get("on") === "1");
  revalidatePath("/partner");
}

/** Called by the slider (my share of the blend, 0..1). */
export async function blendAction(myWeight: number) {
  const u = await me();
  await setBlend(u.id, myWeight);
  revalidatePath("/partner");
  revalidatePath("/");
}
