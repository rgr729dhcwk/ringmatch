import { getDeckForUser } from "@/server/deck";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** Re-ranked deck. ?all=1 includes already-swiped rings; ?exclude=a,b skips ids the client already has. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "no profile" }, { status: 401 });
  const url = new URL(req.url);
  const exclude = (url.searchParams.get("exclude") ?? "").split(",").filter(Boolean).slice(0, 500);
  const deck = await getDeckForUser(user.id, { includeSeen: url.searchParams.get("all") === "1", exclude });
  return Response.json(deck);
}
