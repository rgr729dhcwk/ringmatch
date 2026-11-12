// Prepares the throwaway e2e database: deletes ONLY prisma/e2e.db, then creates the schema and seeds it.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const env = { ...process.env, DATABASE_URL: "file:./e2e.db" };
for (const f of ["prisma/e2e.db", "prisma/e2e.db-journal"]) rmSync(f, { force: true });
execSync("npx prisma db push --skip-generate", { stdio: "inherit", env });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
