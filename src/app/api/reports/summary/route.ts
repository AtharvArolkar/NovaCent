import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { buildReportSummary } from "@/lib/server/reports";
import { handleApiError, ok } from "@/lib/server/http";
import type { Budget, Expense, Trip } from "@/lib/domain";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const [expenses, budgets, trips] = await Promise.all([
      db.collection<Expense>(collections.expenses).find({ accountId }).sort({ spentAt: -1 }).limit(500).toArray(),
      db.collection<Budget>(collections.budgets).find({ accountId }).toArray(),
      db.collection<Trip>(collections.trips).find({ accountId }).toArray()
    ]);
    return ok({ report: buildReportSummary(expenses, budgets, trips) });
  } catch (error) {
    return handleApiError(error);
  }
}

