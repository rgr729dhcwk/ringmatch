import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/** Admin access: a single password from the ADMIN_PASSWORD environment variable (never committed). */
export const ADMIN_COOKIE = "rm_admin";

export const MIN_ADMIN_PASSWORD = 8;

/** Spaces/quotes around the value are ignored (a common copy-paste slip in hosting dashboards). */
const clean = (v: string) => v.trim().replace(/^["']|["']$/g, "").trim();

function password(): string | null {
  const raw = process.env.ADMIN_PASSWORD;
  const p = raw == null ? "" : clean(raw);
  return p.length >= MIN_ADMIN_PASSWORD ? p : null;
}

export const isAdminConfigured = () => password() !== null;

/**
 * Why admin is off, without ever revealing the password. Names of look-alike settings are shown so
 * a typo (e.g. "admin_password" or "ADMIN_PASSWORD " with a space) can be spotted.
 */
export function adminSetupProblem(): { kind: "missing" | "too_short"; lookalikes: string[]; length?: number } | null {
  if (password()) return null;
  const raw = process.env.ADMIN_PASSWORD;
  const lookalikes = Object.keys(process.env).filter((k) => k !== "ADMIN_PASSWORD" && /admin.?pass/i.test(k.replace(/\s/g, "")));
  if (raw == null || clean(raw) === "") return { kind: "missing", lookalikes };
  return { kind: "too_short", lookalikes, length: clean(raw).length };
}

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
  if (!p || !safeEqual(clean(attempt), p)) return false;
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
