import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { created, handleApiError, ok } from "@/lib/server/http";
import { partySchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const parties = await db.collection(collections.parties).find({ accountId }).sort({ createdAt: -1 }).toArray();
    return ok({ parties });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = partySchema.parse(await request.json());
    const db = await getDb();
    const partyId = crypto.randomUUID();
    const party = {
      id: partyId,
      accountId,
      name: payload.name,
      participants: payload.participants.map((participant) => ({
        id: crypto.randomUUID(),
        partyId,
        kind: participant.kind,
        displayName: participant.displayName,
        userId: participant.userId,
        accountId: participant.accountId
      })),
      createdAt: new Date().toISOString()
    };
    await db.collection(collections.parties).insertOne(party);
    return created({ party });
  } catch (error) {
    return handleApiError(error);
  }
}
