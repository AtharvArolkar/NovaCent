import { accountIdFromRequest, getCurrentUser, requireAccountAccess } from "@/lib/server/auth";
import { reverseExpenseBudgetImpact } from "@/lib/server/budgets";
import { hasSettledPartyExpense } from "@/lib/server/delete-guards";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { partyAccessQuery, partyAccountIds } from "@/lib/server/party-access";
import { ensurePartyOwnerParticipant } from "@/lib/server/party-participants";
import { partyParticipantAddSchema } from "@/lib/server/schemas";
import type { Expense, Party } from "@/lib/domain";

interface RouteContext {
  params: Promise<{ partyId: string }> | { partyId: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const requestedAccountId = accountIdFromRequest(request);
    const currentUser = await getCurrentUser();
    const db = await getDb();
    const directAccount = requestedAccountId ? await requireAccountAccess(requestedAccountId).catch(() => null) : null;
    const partyRecord = await db.collection<Party>(collections.parties).findOne(
      partyAccessQuery({
        partyId,
        selectedAccountId: directAccount?.accountId,
        userId: currentUser.id
      })
    );

    if (!partyRecord) {
      return problem("Party was not found.", 404);
    }

    const party = await ensurePartyOwnerParticipant(db, partyRecord);
    const accountId = party.accountId;
    const visibleExpenseAccountIds = partyAccountIds(party);
    const [expenses, splits, settlements] = await Promise.all([
      db.collection(collections.expenses).find({ accountId: { $in: visibleExpenseAccountIds }, partyId }).sort({ spentAt: -1 }).limit(100).toArray(),
      db.collection(collections.splits).find({ accountId, partyId }).sort({ createdAt: -1 }).toArray(),
      db.collection(collections.settlements).find({ accountId, partyId }).sort({ requestedAt: -1 }).toArray()
    ]);

    return ok({ party, expenses, splits, settlements, canManage: directAccount?.accountId === accountId });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = partyParticipantAddSchema.parse(await request.json());
    const db = await getDb();
    const partyRecord = await db.collection<Party>(collections.parties).findOne({ id: partyId, accountId });

    if (!partyRecord) {
      return problem("Party was not found.", 404);
    }

    const party = await ensurePartyOwnerParticipant(db, partyRecord);
    const existingParticipants = party.participants ?? [];
    const duplicate = existingParticipants.some((participant: { kind?: string; userId?: string; accountId?: string; email?: string; displayName?: string }) => {
      if (payload.participant.kind === "registered") {
        const email = payload.participant.email?.trim().toLowerCase();
        return Boolean(
          (payload.participant.userId && participant.userId === payload.participant.userId) ||
          (payload.participant.accountId && participant.accountId === payload.participant.accountId) ||
          (email && participant.email?.trim().toLowerCase() === email)
        );
      }
      if (participant.kind === "registered") {
        return false;
      }
      return participant.displayName?.trim().toLowerCase() === payload.participant.displayName.trim().toLowerCase();
    });

    if (duplicate) {
      return ok({ party });
    }

    let participantInput = payload.participant;
    if (participantInput.kind === "registered" && participantInput.userId) {
      const user = await db.collection(collections.users).findOne({ id: participantInput.userId });
      if (!user) {
        return problem("Registered user was not found.", 404);
      }
      participantInput = {
        ...participantInput,
        displayName: participantInput.displayName || user.name,
        accountId: participantInput.accountId ?? user.defaultAccountId,
        email: user.email
      };
    }

    const participant = {
      id: crypto.randomUUID(),
      partyId,
      kind: participantInput.kind,
      displayName: participantInput.displayName,
      userId: participantInput.userId,
      accountId: participantInput.accountId,
      email: participantInput.email
    };

    await db.collection(collections.parties).updateOne(
      { id: partyId, accountId },
      { $set: { participants: [...existingParticipants, participant], updatedAt: new Date().toISOString() } }
    );

    return ok({ party: { ...party, participants: [...existingParticipants, participant] } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const party = await db.collection(collections.parties).findOne({ id: partyId, accountId });

    if (!party) {
      return problem("Party was not found or you cannot manage it.", 404);
    }

    if (await hasSettledPartyExpense(db, { accountId, partyId })) {
      return problem("Parties with settled expenses cannot be deleted.", 409);
    }

    const partyExpenseAccountIds = partyAccountIds(party);
    const partyExpenses = await db.collection<Expense>(collections.expenses).find({ accountId: { $in: partyExpenseAccountIds }, partyId }).toArray();
    await Promise.all(partyExpenses.map((expense) => reverseExpenseBudgetImpact(expense)));
    await Promise.all([
      db.collection(collections.parties).deleteOne({ id: partyId, accountId }),
      db.collection(collections.expenses).deleteMany({ accountId: { $in: partyExpenseAccountIds }, partyId }),
      db.collection(collections.splits).deleteMany({ accountId, partyId }),
      db.collection(collections.settlements).deleteMany({ accountId, partyId })
    ]);

    return ok({ deleted: true, deletedExpenses: partyExpenses.length });
  } catch (error) {
    return handleApiError(error);
  }
}
