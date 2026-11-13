import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
const { adminSetupProblem, isAdminConfigured } = await import("@/server/admin");

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("admin password setting", () => {
  it("is off and says 'missing' when not set", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(isAdminConfigured()).toBe(false);
    expect(adminSetupProblem()).toMatchObject({ kind: "missing", lookalikes: [] });
  });

  it("says how long a too-short password is (never what it is)", () => {
    process.env.ADMIN_PASSWORD = "abc";
    expect(adminSetupProblem()).toEqual({ kind: "too_short", lookalikes: [], length: 3 });
  });

  it("ignores stray spaces and quotes around the value", () => {
    process.env.ADMIN_PASSWORD = '  "correct-horse"  ';
    expect(isAdminConfigured()).toBe(true);
    expect(adminSetupProblem()).toBeNull();
  });

  it("points out look-alike setting names", () => {
    delete process.env.ADMIN_PASSWORD;
    process.env.admin_password = "something-long";
    expect(adminSetupProblem()?.lookalikes).toEqual(["admin_password"]);
  });
});
