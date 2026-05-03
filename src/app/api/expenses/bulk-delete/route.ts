import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { deleteExpensesForAccount } from "@/lib/server/expense-deletion";
import { handleApiError, ok } from "@/lib/server/http";
import { getDb } from "@/lib/server/mongodb";
import { expenseBulkDeleteSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = expenseBulkDeleteSchema.parse(await request.json());
    const db = await getDb();
    const result = await deleteExpensesForAccount(db, accountId, payload.expenseIds);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
