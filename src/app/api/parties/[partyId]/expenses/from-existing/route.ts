import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { created, handleApiError, problem } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { partyAccessQuery } from "@/lib/server/party-access";
import { existingExpenseSplitSchema } from "@/lib/server/schemas";
import type { Expense, Party, Split } from "@/lib/domain";

interface RouteContext {
  params: Promise<{ partyId: string }> | { partyId: string };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const { accountId: selectedAccountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = existingExpenseSplitSchema.parse(await request.json());
    const db = await getDb();
    const party = await db.collection<Party>(collections.parties).findOne(
      partyAccessQuery({
        partyId,
        selectedAccountId,
        userId: user.id
      })
    );

    if (!party) {
      return problem("Party was not found.", 404);
    }

    const participants = party.participants ?? [];
    if (participants.length < 2) {
      return problem("Add at least two party participants before splitting expenses.", 422);
    }

    const localParticipant = participants.find((participant) => participant.userId === user.id || participant.accountId === selectedAccountId);
    const paidByParticipantId = payload.paidByParticipantId ?? localParticipant?.id;
    const payer = participants.find((participant) => participant.id === paidByParticipantId);
    if (!payer || !paidByParticipantId) {
      return problem("The payer must be a participant in this party.", 422);
    }

    const eligibleExpenseQuery = {
      id: { $in: payload.expenseIds },
      accountId: selectedAccountId,
      excludeFromLedger: { $ne: true },
      $and: [
        {
          $or: [
            { source: { $in: ["manual", "import", "recurring"] } },
            { source: { $exists: false } },
            { source: null }
          ]
        },
        {
          $or: [
            { partyId: { $exists: false } },
            { partyId: null },
            { partyId: "" }
          ]
        },
        {
          $or: [
            { settlementId: { $exists: false } },
            { settlementId: null },
            { settlementId: "" }
          ]
        }
      ]
    };
    const expenses = await db.collection(collections.expenses).find(eligibleExpenseQuery).toArray() as unknown as Expense[];

    if (expenses.length !== payload.expenseIds.length) {
      return problem("Some selected expenses cannot be added to a split.", 422);
    }

    const now = new Date().toISOString();
    const splits: Split[] = expenses.flatMap((expense) => {
      const debtors = participants.filter((participant) => participant.id !== paidByParticipantId);
      return debtors.map((participant) => ({
        id: crypto.randomUUID(),
        accountId: party.accountId,
        partyId,
        expenseId: expense.id,
        paidByParticipantId,
        participantId: participant.id,
        amount: {
          amount: Number((expense.original.amount / participants.length).toFixed(2)),
          currency: expense.original.currency
        },
        status: "open" as const,
        createdAt: now,
        updatedAt: now
      }));
    });

    await db.collection(collections.expenses).updateMany(
      { id: { $in: expenses.map((expense) => expense.id) }, accountId: selectedAccountId },
      {
        $set: {
          source: "party",
          partyId,
          paidByParticipantId,
          updatedAt: now
        }
      }
    );
    if (splits.length) {
      await db.collection<Split>(collections.splits).insertMany(splits);
    }

    return created({
      convertedExpenseIds: expenses.map((expense) => expense.id),
      splits
    });
  } catch (error) {
    return handleApiError(error);
  }
}
