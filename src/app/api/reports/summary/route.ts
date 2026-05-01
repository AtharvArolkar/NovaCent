import type { Filter } from "mongodb";
import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { attachPartyBalances, buildReportSummary } from "@/lib/server/reports";
import { handleApiError, ok } from "@/lib/server/http";
import type { Budget, Expense, Party, Settlement, Split } from "@/lib/domain";

function parseDateParam(value: string | null, boundary: "start" | "end") {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (boundary === "end") {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString();
}

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const url = new URL(request.url);
    const startDate = parseDateParam(url.searchParams.get("startDate"), "start");
    const endDate = parseDateParam(url.searchParams.get("endDate"), "end");
    const expenseFilter: Filter<Expense & { date?: string }> = { accountId, excludeFromLedger: { $ne: true } };
    if (startDate || endDate) {
      const dateRange = {
        ...(startDate ? { $gte: startDate } : {}),
        ...(endDate ? { $lt: endDate } : {})
      };
      const plainDateRange = {
        ...(startDate ? { $gte: startDate.slice(0, 10) } : {}),
        ...(endDate ? { $lt: endDate.slice(0, 10) } : {})
      };
      expenseFilter.$or = [{ spentAt: dateRange }, { date: plainDateRange }];
    }
    const db = await getDb();
    const [expenses, budgets, splits, parties, settlements] = await Promise.all([
      db.collection<Expense>(collections.expenses).find(expenseFilter).sort({ spentAt: 1, date: 1 }).toArray(),
      db.collection<Budget>(collections.budgets).find({ accountId }).toArray(),
      db.collection<Split>(collections.splits).find({ accountId }).toArray(),
      db.collection<Party>(collections.parties).find({ accountId }).toArray(),
      db.collection<Settlement>(collections.settlements).find({ accountId }).toArray()
    ]);
    const sourceExpenseIds = Array.from(new Set(splits.map((split) => split.expenseId).filter(Boolean)));
    const sourceExpenses = sourceExpenseIds.length
      ? await db.collection<Expense>(collections.expenses).find({ id: { $in: sourceExpenseIds } }).toArray()
      : [];

    const summary = buildReportSummary(expenses, budgets, [], splits, sourceExpenses);
    return ok({ report: attachPartyBalances(summary, parties, splits, settlements) });
  } catch (error) {
    return handleApiError(error);
  }
}
