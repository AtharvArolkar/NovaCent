import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { convertToBase } from "@/lib/server/currency";
import { created, handleApiError, ok } from "@/lib/server/http";
import { expenseSchema } from "@/lib/server/schemas";
import { applyExpenseBudgetImpact } from "@/lib/server/budgets";
import { duplicateKeyFor } from "@/lib/server/import-duplicates";
import { classifyMoneyFlowType, investmentCategoryNames } from "@/lib/spend-impact";
import type { Expense } from "@/lib/domain";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const url = new URL(request.url);
    const query: Record<string, unknown> = { accountId, excludeFromLedger: { $ne: true } };
    const category = url.searchParams.get("category");
    const moneyFlowType = url.searchParams.get("moneyFlowType");
    const tripId = url.searchParams.get("tripId");
    const partyId = url.searchParams.get("partyId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 250), 1), 5000);
    if (category) query.categoryName = category;
    if (moneyFlowType === "investment") {
      query.$or = [
        { moneyFlowType: "investment" },
        { categoryName: { $in: investmentCategoryNames } }
      ];
    } else if (moneyFlowType) {
      query.moneyFlowType = moneyFlowType;
    }
    if (tripId) query.tripId = tripId;
    if (partyId) query.partyId = partyId;
    if (from || to) {
      query.spentAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lt: to } : {})
      };
    }
    const expenses = await db.collection(collections.expenses).find(query).sort({ spentAt: -1 }).limit(limit).toArray();
    return ok({ expenses });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accountId, account, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = expenseSchema.parse(await request.json());
    const db = await getDb();

    if (payload.clientMutationId) {
      const existing = await db.collection(collections.expenses).findOne({ accountId, clientMutationId: payload.clientMutationId });
      if (existing) {
        return ok({ expense: existing, idempotent: true });
      }
    }

    const conversion = await convertToBase(payload.original, account.baseCurrency);
    const now = new Date().toISOString();
    const moneyFlowType = payload.moneyFlowType ?? classifyMoneyFlowType(Number(payload.original.amount ?? 0), {
      source: payload.source,
      merchant: payload.merchant,
      description: payload.description,
      categoryName: payload.categoryName,
      notes: payload.notes
    });
    const expense: Expense & { duplicateKey: string } = {
      id: crypto.randomUUID(),
      accountId,
      source: payload.source,
      merchant: payload.merchant,
      description: payload.description,
      categoryId: payload.categoryId,
      categoryName: payload.categoryName,
      original: payload.original,
      base: conversion.base,
      exchangeRate: conversion.exchangeRate,
      moneyFlowType,
      spentAt: payload.spentAt,
      notes: payload.notes,
      tripId: payload.tripId,
      partyId: payload.partyId,
      paidByParticipantId: payload.paidByParticipantId,
      excludeFromLedger: payload.excludeFromLedger,
      recurringRuleId: payload.recurringRuleId,
      syncStatus: "synced",
      clientMutationId: payload.clientMutationId,
      duplicateKey: duplicateKeyFor(payload),
      createdAt: now,
      updatedAt: now
    };

    await db.collection(collections.expenses).insertOne(expense);
    await applyExpenseBudgetImpact(expense, user.id);
    return created({ expense });
  } catch (error) {
    return handleApiError(error);
  }
}
