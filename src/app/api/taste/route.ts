import { getCurrentUser } from "@/server/session";
import { getTaste } from "@/server/taste";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "no profile" }, { status: 401 });
  return Response.json(await getTaste(user.id));
}
