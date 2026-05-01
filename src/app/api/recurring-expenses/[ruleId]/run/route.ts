import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { created, handleApiError, problem } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { advanceRecurringRule, createRecurringExpenseOccurrence } from "@/lib/server/recurring-expenses";
import { recurringExpenseRunSchema } from "@/lib/server/schemas";
import type { RecurringExpenseRule } from "@/lib/domain";

interface RouteContext {
  params: Promise<{ ruleId: string }> | { ruleId: string };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { ruleId } = await context.params;
    const { accountId, account, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = recurringExpenseRunSchema.parse(await request.json().catch(() => ({})));
    const db = await getDb();
    const rule = await db.collection<RecurringExpenseRule>(collections.recurringRules).findOne({ id: ruleId, accountId });

    if (!rule) {
      return problem("Recurring expense rule was not found.", 404);
    }

    if (rule.status !== "active") {
      return problem("Recurring expense rule is not active.", 409);
    }

    const spentAt = payload.spentAt ?? rule.nextRunAt;
    const result = await createRecurringExpenseOccurrence({ rule, account, spentAt, userId: user.id });
    await advanceRecurringRule(rule, spentAt);

    return created({ expense: result.expense, created: result.created });
  } catch (error) {
    return handleApiError(error);
  }
}
