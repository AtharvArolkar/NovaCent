import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { applyExpenseBudgetImpact } from "@/lib/server/budgets";
import { convertToBase } from "@/lib/server/currency";
import { created, handleApiError, ok } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { duplicateKeyFor } from "@/lib/server/import-duplicates";
import { recurringExpenseSchema } from "@/lib/server/schemas";
import type { Expense, RecurringExpenseRule } from "@/lib/domain";

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
      const conversion = await convertToBase(payload.original, account.baseCurrency);
      const expense: Expense & { duplicateKey: string } = {
        id: crypto.randomUUID(),
        accountId,
        source: "recurring",
        merchant: payload.merchant,
        description: payload.description,
        categoryId: payload.categoryId,
        categoryName: payload.categoryName,
        original: payload.original,
        base: conversion.base,
        exchangeRate: conversion.exchangeRate,
        spentAt: recurringExpense.nextRunAt,
        notes: payload.notes,
        recurringRuleId: recurringExpense.id,
        syncStatus: "synced",
        duplicateKey: duplicateKeyFor({ merchant: payload.merchant, spentAt: recurringExpense.nextRunAt, original: payload.original }),
        createdAt: now,
        updatedAt: now
      };
      await db.collection(collections.expenses).insertOne(expense);
      await applyExpenseBudgetImpact(expense, user.id);
      createdExpense = expense;
      const nextRunAt = nextRunAfter(recurringExpense.nextRunAt, recurringExpense.frequency, recurringExpense.interval);
      await db.collection(collections.recurringRules).updateOne(
        { id: recurringExpense.id, accountId },
        { $set: { lastRunAt: recurringExpense.nextRunAt, nextRunAt, updatedAt: new Date().toISOString() } }
      );
      recurringExpense.lastRunAt = recurringExpense.nextRunAt;
      recurringExpense.nextRunAt = nextRunAt;
    }

    return created({ recurringExpense, createdExpense });
  } catch (error) {
    return handleApiError(error);
  }
}
