import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { created, handleApiError, ok } from "@/lib/server/http";
import { tripSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const trips = await db.collection(collections.trips).find({ accountId }).sort({ startsAt: -1 }).toArray();
    return ok({ trips });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = tripSchema.parse(await request.json());
    const db = await getDb();
    const trip = { id: crypto.randomUUID(), accountId, ...payload, createdAt: new Date().toISOString() };
    await db.collection(collections.trips).insertOne(trip);
    return created({ trip });
  } catch (error) {
    return handleApiError(error);
  }
}
