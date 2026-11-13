import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { parseStatedPrefs } from "@/lib/prefs";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/profiles");
  const profile = await db.profile.findUnique({ where: { userId: user.id } });
  return (
    <main className="mx-auto max-w-md px-4 pb-32 pt-[max(env(safe-area-inset-top),16px)]">
      <header className="py-4">
        <h1 className="font-serif text-3xl text-ink">Hi {user.displayName}!</h1>
        <p className="mt-1 text-sm text-ink-soft">
          A few quick questions so RingMatch can start with rings you&apos;ll like. Not sure? Leave it on
          <span className="font-semibold"> &ldquo;show me everything&rdquo;</span> — your swipes will teach it the rest.
        </p>
      </header>
      <OnboardingForm initial={parseStatedPrefs(profile?.statedPrefs)} editing={Boolean(profile?.onboardedAt)} />
    </main>
  );
}
