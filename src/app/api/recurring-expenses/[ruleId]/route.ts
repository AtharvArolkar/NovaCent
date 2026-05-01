import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { recurringExpensePatchSchema } from "@/lib/server/schemas";

interface RouteContext {
  params: Promise<{ ruleId: string }> | { ruleId: string };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { ruleId } = await context.params;
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = recurringExpensePatchSchema.parse(await request.json());
    const db = await getDb();
    const existing = await db.collection(collections.recurringRules).findOne({ id: ruleId, accountId });

    if (!existing) {
      return problem("Recurring expense rule was not found.", 404);
    }

    const update = {
      ...payload,
      updatedAt: new Date().toISOString()
    };
    await db.collection(collections.recurringRules).updateOne({ id: ruleId, accountId }, { $set: update });
    const recurringExpense = await db.collection(collections.recurringRules).findOne({ id: ruleId, accountId });
    return ok({ recurringExpense });
  } catch (error) {
    return handleApiError(error);
  }
}
