import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { created, handleApiError, ok, problem } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { splitSchema } from "@/lib/server/schemas";

interface RouteContext {
  params: Promise<{ partyId: string }> | { partyId: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const party = await db.collection(collections.parties).findOne({ id: partyId, accountId });

    if (!party) {
      return problem("Party was not found.", 404);
    }

    const splits = await db.collection(collections.splits).find({ accountId, partyId }).sort({ createdAt: -1 }).toArray();
    return ok({ splits });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = splitSchema.parse(await request.json());
    const db = await getDb();
    const party = await db.collection(collections.parties).findOne({ id: partyId, accountId });

    if (!party) {
      return problem("Party was not found.", 404);
    }

    const expense = await db.collection(collections.expenses).findOne({ id: payload.expenseId, accountId, partyId });
    if (!expense) {
      return problem("Party expense was not found.", 404);
    }

    const participantIds = new Set((party.participants ?? []).map((participant: { id: string }) => participant.id));
    const missingParticipant = payload.splits.find((split) => !participantIds.has(split.participantId));
    if (missingParticipant) {
      return problem("Split participant is not part of this party.", 422, { participantId: missingParticipant.participantId });
    }

    const now = new Date().toISOString();
    const splits = payload.splits.map((split) => ({
      id: crypto.randomUUID(),
      accountId,
      partyId,
      expenseId: payload.expenseId,
      participantId: split.participantId,
      amount: split.amount,
      status: "open",
      createdAt: now,
      updatedAt: now
    }));

    await db.collection(collections.splits).insertMany(splits);
    return created({ splits });
  } catch (error) {
    return handleApiError(error);
  }
}
