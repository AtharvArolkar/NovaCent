import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { applyExpenseBudgetImpact } from "@/lib/server/budgets";
import { convertToBase } from "@/lib/server/currency";
import { created, handleApiError, problem } from "@/lib/server/http";
import { duplicateKeyFor } from "@/lib/server/import-duplicates";
import { collections, getDb } from "@/lib/server/mongodb";
import { recurringExpenseRunSchema } from "@/lib/server/schemas";
import type { Expense, RecurringExpenseRule } from "@/lib/domain";

interface RouteContext {
  params: Promise<{ ruleId: string }> | { ruleId: string };
}

function nextRunAfter(dateValue: string, frequency: RecurringExpenseRule["frequency"], interval: number) {
  const date = new Date(dateValue);
  const next = frequency === "daily"
    ? addDays(date, interval)
    : frequency === "weekly"
      ? addWeeks(date, interval)
      : frequency === "monthly"
        ? addMonths(date, interval)
        : addYears(date, interval);

  return next.toISOString();
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
    const conversion = await convertToBase(rule.original, account.baseCurrency);
    const now = new Date().toISOString();
    const expense: Expense & { duplicateKey: string } = {
      id: crypto.randomUUID(),
      accountId,
      source: "recurring",
      merchant: rule.merchant,
      description: rule.description,
      categoryId: rule.categoryId,
      categoryName: rule.categoryName,
      original: rule.original,
      base: conversion.base,
      exchangeRate: conversion.exchangeRate,
      spentAt,
      notes: rule.notes,
      recurringRuleId: rule.id,
      syncStatus: "synced",
      duplicateKey: duplicateKeyFor({ merchant: rule.merchant, spentAt, original: rule.original }),
      createdAt: now,
      updatedAt: now
    };

    await db.collection(collections.expenses).insertOne(expense);
    await applyExpenseBudgetImpact(expense, user.id);
    await db.collection(collections.recurringRules).updateOne(
      { id: rule.id, accountId },
      {
        $set: {
          lastRunAt: spentAt,
          nextRunAt: nextRunAfter(spentAt, rule.frequency, rule.interval),
          updatedAt: now
        }
      }
    );

    return created({ expense });
  } catch (error) {
    return handleApiError(error);
  }
}
