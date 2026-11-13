import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingForm } from "@/components/admin/ListingForm";
import { isAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  if (!(await isAdmin())) redirect("/admin");
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-[max(env(safe-area-inset-top),16px)]">
      <header className="flex items-center justify-between py-3">
        <h1 className="font-serif text-3xl text-ink">Add a listing</h1>
        <Link href="/admin" className="text-sm font-semibold text-accent">
          Back
        </Link>
      </header>
      <ListingForm initial={{}} editing={false} />
    </main>
  );
}
