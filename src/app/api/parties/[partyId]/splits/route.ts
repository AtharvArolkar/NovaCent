import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { created, handleApiError, ok, problem } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { partyAccessQuery, partyAccountIds } from "@/lib/server/party-access";
import { notifyPartySplitParticipants } from "@/lib/server/party-notifications";
import { ensurePartyOwnerParticipant } from "@/lib/server/party-participants";
import { splitSchema } from "@/lib/server/schemas";
import type { Expense, Party, Split } from "@/lib/domain";

interface RouteContext {
  params: Promise<{ partyId: string }> | { partyId: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const { accountId: selectedAccountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const partyRecord = await db.collection<Party>(collections.parties).findOne(partyAccessQuery({ partyId, selectedAccountId, userId: user.id }));

    if (!partyRecord) {
      return problem("Party was not found.", 404);
    }

    const party = await ensurePartyOwnerParticipant(db, partyRecord);
    const accountId = party.accountId;
    const splits = await db.collection(collections.splits).find({ accountId, partyId }).sort({ createdAt: -1 }).toArray();
    return ok({ splits });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const { accountId: selectedAccountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = splitSchema.parse(await request.json());
    const db = await getDb();
    const partyRecord = await db.collection<Party>(collections.parties).findOne(partyAccessQuery({ partyId, selectedAccountId, userId: user.id }));

    if (!partyRecord) {
      return problem("Party was not found.", 404);
    }

    const party = await ensurePartyOwnerParticipant(db, partyRecord);
    const accountId = party.accountId;
    const visibleExpenseAccountIds = partyAccountIds(party);
    const expense = await db.collection<Expense>(collections.expenses).findOne({ id: payload.expenseId, accountId: { $in: visibleExpenseAccountIds }, partyId });
    if (!expense) {
      return problem("Party expense was not found.", 404);
    }

    const participantIds = new Set((party.participants ?? []).map((participant: { id: string }) => participant.id));
    const paidByParticipantId = payload.paidByParticipantId ?? expense.paidByParticipantId;
    if (!paidByParticipantId || !participantIds.has(paidByParticipantId)) {
      return problem("Expense payer is not part of this party.", 422);
    }
    const paidByParticipant = (party.participants ?? []).find((participant: { id: string }) => participant.id === paidByParticipantId);
    const actorCanCreateSplits =
      selectedAccountId === accountId || paidByParticipant?.userId === user.id || paidByParticipant?.accountId === selectedAccountId;
    if (!actorCanCreateSplits) {
      return problem("Only the party admin or selected payer can create splits for this party expense.", 403);
    }
    const missingParticipant = payload.splits.find((split) => !participantIds.has(split.participantId));
    if (missingParticipant) {
      return problem("Split participant is not part of this party.", 422, { participantId: missingParticipant.participantId });
    }

    const now = new Date().toISOString();
    const splits: Split[] = payload.splits.map((split) => ({
      id: crypto.randomUUID(),
      accountId,
      partyId,
      expenseId: payload.expenseId,
      paidByParticipantId,
      participantId: split.participantId,
      amount: split.amount,
      status: "open",
      createdAt: now,
      updatedAt: now
    }));

    await db.collection<Split>(collections.splits).insertMany(splits);
    await notifyPartySplitParticipants({
      db,
      party,
      splits,
      actorUserId: user.id,
      actorAccountId: selectedAccountId,
      merchant: expense.merchant
    });
    return created({ splits });
  } catch (error) {
    return handleApiError(error);
  }
}
