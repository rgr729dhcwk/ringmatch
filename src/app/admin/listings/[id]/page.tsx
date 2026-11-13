import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/admin/ListingForm";
import { isAdmin } from "@/server/admin";
import { getManualListing } from "@/server/manualListings";

export const dynamic = "force-dynamic";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const l = await getManualListing((await params).id);
  if (!l) notFound();
  const s = (v: string | number | null) => (v == null ? "" : String(v));
  const initial: Record<string, string> = {
    externalId: s(l.externalId),
    title: l.title,
    retailer: l.retailer,
    sourceUrl: s(l.sourceUrl),
    price: s(l.price),
    priceIsEstimate: l.priceIsEstimate ? "on" : "",
    images: l.images.map((i) => i.url).join("\n"),
    shape: s(l.shape),
    caratWeight: s(l.caratWeight),
    color: s(l.color),
    clarity: s(l.clarity),
    cut: s(l.cut),
    origin: s(l.origin),
    centerStone: s(l.centerStone),
    setting: s(l.setting),
    prongs: s(l.prongs),
    metal: s(l.metal),
    bandWidthMm: s(l.bandWidthMm),
    bandStyle: s(l.bandStyle),
    bandProfile: s(l.bandProfile),
  };
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-[max(env(safe-area-inset-top),16px)]">
      <header className="flex items-center justify-between py-3">
        <h1 className="font-serif text-3xl text-ink">Edit listing</h1>
        <Link href="/admin" className="text-sm font-semibold text-accent">
          Back
        </Link>
      </header>
      <ListingForm initial={initial} editing />
    </main>
  );
}
