import { isAdmin } from "@/server/admin";
import { exportManualListings } from "@/server/manualListings";

export const dynamic = "force-dynamic";

/** Download real listings as seed/manual-listings.json (to keep them across restarts). */
export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "admin only" }, { status: 401 });
  const body = JSON.stringify(await exportManualListings(), null, 2) + "\n";
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="manual-listings.json"',
    },
  });
}
