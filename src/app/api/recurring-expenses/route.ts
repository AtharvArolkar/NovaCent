import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { created, handleApiError, ok } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { createRecurringExpenseOccurrence, advanceRecurringRule } from "@/lib/server/recurring-expenses";
import { recurringExpenseSchema } from "@/lib/server/schemas";
import type { RecurringExpenseRule } from "@/lib/domain";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const query: Record<string, unknown> = { accountId };
    if (status) {
      query.status = status;
    }

    const recurringExpenses = await db.collection<RecurringExpenseRule>(collections.recurringRules)
      .find(query)
      .sort({ nextRunAt: 1 })
      .toArray();

    return ok({ recurringExpenses });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accountId, account, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = recurringExpenseSchema.parse(await request.json());
    const db = await getDb();
    const now = new Date().toISOString();
    const recurringExpense: RecurringExpenseRule = {
      id: crypto.randomUUID(),
      accountId,
      merchant: payload.merchant,
      description: payload.description,
      categoryId: payload.categoryId,
      categoryName: payload.categoryName,
      original: payload.original,
      frequency: payload.frequency,
      interval: payload.interval,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      nextRunAt: payload.nextRunAt ?? payload.startsAt,
      lastRunAt: undefined,
      status: "active",
      autoCreate: payload.autoCreate,
      notes: payload.notes,
      createdAt: now,
      updatedAt: now
    };

    await db.collection(collections.recurringRules).insertOne(recurringExpense);

    let createdExpense = null;
    if (payload.autoCreate && new Date(recurringExpense.nextRunAt).getTime() <= Date.now()) {
      const spentAt = recurringExpense.nextRunAt;
      const result = await createRecurringExpenseOccurrence({ rule: recurringExpense, account, spentAt, userId: user.id });
      createdExpense = result.expense;
      const advance = await advanceRecurringRule(recurringExpense, spentAt);
      recurringExpense.lastRunAt = spentAt;
      recurringExpense.nextRunAt = advance.nextRunAt;
      recurringExpense.status = advance.status as RecurringExpenseRule["status"];
    }

    return created({ recurringExpense, createdExpense });
  } catch (error) {
    return handleApiError(error);
  }
}
