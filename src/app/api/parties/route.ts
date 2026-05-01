import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { created, handleApiError, ok } from "@/lib/server/http";
import { partySchema } from "@/lib/server/schemas";
import { partyAccessQuery } from "@/lib/server/party-access";

export async function GET(request: Request) {
  try {
    const { accountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const parties = await db.collection(collections.parties).find(partyAccessQuery({ selectedAccountId: accountId, userId: user.id })).sort({ createdAt: -1 }).toArray();
    return ok({ parties });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = partySchema.parse(await request.json());
    const db = await getDb();
    const partyId = crypto.randomUUID();
    const ownerParticipant = {
      kind: "registered" as const,
      displayName: user.name ?? user.email ?? "You",
      userId: user.id,
      accountId
    };
    const participantInputs = payload.participants.some((participant) => participant.userId === user.id)
      ? payload.participants
      : [ownerParticipant, ...payload.participants];
    const party = {
      id: partyId,
      accountId,
      name: payload.name,
      participants: participantInputs.map((participant) => ({
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
