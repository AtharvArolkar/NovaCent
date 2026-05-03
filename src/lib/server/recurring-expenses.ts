import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import type { Account, Expense, RecurringExpenseRule } from "@/lib/domain";
import { applyExpenseBudgetImpact } from "@/lib/server/budgets";
import { convertToBase } from "@/lib/server/currency";
import { duplicateKeyFor } from "@/lib/server/import-duplicates";
import { collections, getDb } from "@/lib/server/mongodb";
import { classifyMoneyFlowType } from "@/lib/spend-impact";

export function nextRecurringRunAfter(dateValue: string, frequency: RecurringExpenseRule["frequency"], interval: number) {
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

const occurrenceMutationId = (ruleId: string, spentAt: string) => `recurring:${ruleId}:${spentAt}`;

export async function createRecurringExpenseOccurrence({
  rule,
  account,
  spentAt,
  userId
}: {
  rule: RecurringExpenseRule;
  account: Account;
  spentAt: string;
  userId: string;
}) {
  const db = await getDb();
  const clientMutationId = occurrenceMutationId(rule.id, spentAt);
  const existing = await db.collection<Expense>(collections.expenses).findOne({ accountId: rule.accountId, clientMutationId });

  if (existing) {
    return { expense: existing, created: false };
  }

  const conversion = await convertToBase(rule.original, account.baseCurrency);
  const now = new Date().toISOString();
  const moneyFlowType = classifyMoneyFlowType(Number(conversion.base.amount ?? rule.original.amount ?? 0), {
    source: "recurring",
    merchant: rule.merchant,
    description: rule.description,
    categoryName: rule.categoryName,
    notes: rule.notes
  });
  const expense: Expense & { duplicateKey: string } = {
    id: crypto.randomUUID(),
    accountId: rule.accountId,
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
    moneyFlowType,
    recurringRuleId: rule.id,
    syncStatus: "synced",
    clientMutationId,
    duplicateKey: duplicateKeyFor({ merchant: rule.merchant, spentAt, original: rule.original }),
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection(collections.expenses).updateOne(
    { accountId: rule.accountId, clientMutationId },
    { $setOnInsert: expense },
    { upsert: true }
  );

  if (!result.upsertedCount) {
    const current = await db.collection<Expense>(collections.expenses).findOne({ accountId: rule.accountId, clientMutationId });
    return { expense: current ?? expense, created: false };
  }

  await applyExpenseBudgetImpact(expense, userId);
  return { expense, created: true };
}

export async function advanceRecurringRule(rule: RecurringExpenseRule, spentAt: string) {
  const db = await getDb();
  const nextRunAt = nextRecurringRunAfter(spentAt, rule.frequency, rule.interval);
  const endsAtTime = rule.endsAt ? new Date(rule.endsAt).getTime() : Number.POSITIVE_INFINITY;
  const status = new Date(nextRunAt).getTime() > endsAtTime ? "ended" : rule.status;
  const now = new Date().toISOString();

  await db.collection(collections.recurringRules).updateOne(
    { id: rule.id, accountId: rule.accountId },
    {
      $set: {
        lastRunAt: spentAt,
        nextRunAt,
        status,
        updatedAt: now
      }
    }
  );

  return { nextRunAt, status };
}

export async function runDueRecurringExpenses(options: { now?: Date; maxOccurrences?: number } = {}) {
  const db = await getDb();
  const now = options.now ?? new Date();
  const maxOccurrences = options.maxOccurrences ?? 100;
  let createdCount = 0;
  let skippedCount = 0;
  let endedCount = 0;
  const processedRuleIds = new Set<string>();

  const rules = await db.collection<RecurringExpenseRule>(collections.recurringRules)
    .find({
      status: "active",
      autoCreate: { $ne: false },
      nextRunAt: { $lte: now.toISOString() }
    })
    .sort({ nextRunAt: 1 })
    .limit(maxOccurrences)
    .toArray();

  for (const originalRule of rules) {
    let rule = { ...originalRule };
    processedRuleIds.add(rule.id);
    const account = await db.collection<Account>(collections.accounts).findOne({ id: rule.accountId });

    if (!account) {
      skippedCount += 1;
      continue;
    }

    let guard = 0;
    while (rule.status === "active" && new Date(rule.nextRunAt).getTime() <= now.getTime() && guard < 24 && createdCount < maxOccurrences) {
      guard += 1;
      const spentAt = rule.nextRunAt;
      const endsAtTime = rule.endsAt ? new Date(rule.endsAt).getTime() : Number.POSITIVE_INFINITY;

      if (new Date(spentAt).getTime() > endsAtTime) {
        await db.collection(collections.recurringRules).updateOne(
          { id: rule.id, accountId: rule.accountId },
          { $set: { status: "ended", updatedAt: new Date().toISOString() } }
        );
        endedCount += 1;
        break;
      }

      const result = await createRecurringExpenseOccurrence({ rule, account, spentAt, userId: account.userId });
      if (result.created) {
        createdCount += 1;
      } else {
        skippedCount += 1;
      }

      const advance = await advanceRecurringRule(rule, spentAt);
      rule = { ...rule, lastRunAt: spentAt, nextRunAt: advance.nextRunAt, status: advance.status as RecurringExpenseRule["status"] };
      if (advance.status === "ended") {
        endedCount += 1;
      }
    }
  }

  return {
    createdCount,
    skippedCount,
    endedCount,
    processedRuleCount: processedRuleIds.size
  };
}
