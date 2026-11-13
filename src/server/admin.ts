import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/** Admin access: a single password from the ADMIN_PASSWORD environment variable (never committed). */
export const ADMIN_COOKIE = "rm_admin";

function password(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  return p && p.length >= 8 ? p : null;
}

export const isAdminConfigured = () => password() !== null;

/** Cookie value: a hash derived from the password, so the password itself is never stored in the browser. */
function token(p: string) {
  return createHmac("sha256", p).update("ringmatch-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function isAdmin(): Promise<boolean> {
  const p = password();
  if (!p) return false;
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(c && safeEqual(c, token(p)));
}

export async function adminLogin(attempt: string): Promise<boolean> {
  const p = password();
  if (!p || !safeEqual(attempt, p)) return false;
  (await cookies()).set(ADMIN_COOKIE, token(p), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.RINGMATCH_INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
}
