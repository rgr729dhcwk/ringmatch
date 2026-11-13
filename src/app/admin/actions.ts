"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminLogin, adminLogout, isAdmin } from "@/server/admin";
import { importManualListings, saveManualListing, setManualActive, type SaveResult } from "@/server/manualListings";

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin");
}

export async function loginAction(formData: FormData) {
  const ok = await adminLogin(String(formData.get("password") ?? ""));
  redirect(ok ? "/admin" : "/admin?error=1");
}

export async function logoutAction() {
  await adminLogout();
  redirect("/admin");
}

export type FormState = { result?: SaveResult; values?: Record<string, string>; error?: string };

/** Add or update a real listing; the result (photo checks, fallback, rejection) is shown on the form. */
export async function saveListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") values[k] = v;
  try {
    const result = await saveManualListing(values);
    revalidatePath("/admin");
    // Keep the generated id so pressing Save again updates the same listing.
    if (result.listingId && !values.externalId) {
      const { db } = await import("@/server/db");
      const row = await db.listing.findUnique({ where: { id: result.listingId }, select: { externalId: true } });
      values.externalId = row?.externalId ?? "";
    }
    return { result, values };
  } catch (e) {
    return { values, error: (e as Error).message };
  }
}

export async function setActiveAction(formData: FormData) {
  await requireAdmin();
  await setManualActive(String(formData.get("id")), formData.get("active") === "1");
  revalidatePath("/admin");
}

export type ImportState = { message?: string; results?: { title: string; outcome: string; reason: string | null }[] };

export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireAdmin();
  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("json") ?? ""));
  } catch {
    return { message: "That isn't valid JSON. Paste the whole exported file." };
  }
  const { results, error } = await importManualListings(json);
  revalidatePath("/admin");
  if (error) return { message: error };
  const ok = results.filter((r) => r.outcome !== "rejected").length;
  return {
    message: `Imported ${ok} of ${results.length} listing${results.length === 1 ? "" : "s"}.`,
    results: results.map((r) => ({ title: r.title, outcome: r.outcome, reason: r.reason })),
  };
}
