import type { Db } from "mongodb";
import { collections } from "@/lib/server/mongodb";

export async function hasSettledPartyExpense(db: Db, input: { accountId: string; partyId: string; expenseId?: string }) {
  const splitQuery: Record<string, unknown> = {
    accountId: input.accountId,
    partyId: input.partyId,
    status: "settled"
  };
  const settlementQuery: Record<string, unknown> = {
    accountId: input.accountId,
    partyId: input.partyId,
    status: "settled"
  };

  if (input.expenseId) {
    splitQuery.expenseId = input.expenseId;
    const splits = await db.collection(collections.splits).find({ accountId: input.accountId, partyId: input.partyId, expenseId: input.expenseId }).project({ id: 1 }).toArray();
    settlementQuery.splitId = { $in: splits.map((split) => split.id) };
    if (!splits.length) {
      return false;
    }
  }

  const [settledSplit, settledSettlement] = await Promise.all([
    db.collection(collections.splits).findOne(splitQuery),
    db.collection(collections.settlements).findOne(settlementQuery)
  ]);

  return Boolean(settledSplit || settledSettlement);
}
