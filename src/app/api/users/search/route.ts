import { getCurrentUser } from "@/lib/server/auth";
import { handleApiError, ok } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim();

    if (query.length < 2) {
      return ok({ users: [] });
    }

    const db = await getDb();
    const pattern = new RegExp(escapeRegex(query), "i");
    const users = await db
      .collection(collections.users)
      .find({ id: { $ne: currentUser.id }, $or: [{ name: pattern }, { email: pattern }] })
      .project({ _id: 0, id: 1, name: 1, email: 1, image: 1, defaultAccountId: 1 })
      .limit(8)
      .toArray();

    return ok({ users });
  } catch (error) {
    return handleApiError(error);
  }
}
