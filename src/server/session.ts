import { cookies } from "next/headers";
import { db } from "./db";

export const PROFILE_COOKIE = "rm_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** The local profile for this browser (cookie-based; real auth arrives later via Auth.js). */
export async function getCurrentUser() {
  const id = (await cookies()).get(PROFILE_COOKIE)?.value;
  if (!id) return null;
  return db.user.findUnique({ where: { id } });
}

export async function setCurrentUser(userId: string) {
  (await cookies()).set(PROFILE_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function clearCurrentUser() {
  (await cookies()).delete(PROFILE_COOKIE);
}
