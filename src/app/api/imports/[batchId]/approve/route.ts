import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { convertToBase } from "@/lib/server/currency";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { importApproveSchema } from "@/lib/server/schemas";
import { applyExpenseBudgetImpact } from "@/lib/server/budgets";
import { duplicateKeyFor } from "@/lib/server/import-duplicates";
import { createNotification } from "@/lib/server/notifications";
import type { Expense, ImportBatch, ImportRow } from "@/lib/domain";

interface RouteContext {
  params: Promise<{ batchId: string }> | { batchId: string };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { batchId } = await context.params;
    const { accountId, account, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = importApproveSchema.parse(await request.json());
    const db = await getDb();
    const batch = await db.collection<ImportBatch>(collections.importBatches).findOne({ id: batchId, accountId });

    if (!batch) {
      return problem("Import batch was not found.", 404);
    }

    const byId = new Map(batch.rows.map((row) => [row.id, row]));
    const approvedExpenses = [];
    const nextRows: ImportRow[] = [...batch.rows];

    for (const review of payload.rows) {
      const existing = byId.get(review.rowId);
      if (!existing || !["review", "possible_duplicate"].includes(existing.status)) {
        continue;
      }

      const rowIndex = nextRows.findIndex((row) => row.id === review.rowId);

      if (review.action === "delete") {
        nextRows[rowIndex] = { ...existing, status: "deleted" };
        await db.collection(collections.importRows).updateOne({ id: existing.id, accountId }, { $set: { status: "deleted", updatedAt: new Date().toISOString() } });
        continue;
      }

      if (existing.status === "possible_duplicate" && (!review.confirmDuplicate || !review.overrideReason?.trim())) {
        continue;
      }

      const edited = {
        ...existing,
        merchant: review.merchant ?? existing.merchant,
        categoryId: review.categoryId ?? "cat-uncategorized",
        suggestedCategoryName: review.categoryName ?? existing.suggestedCategoryName,
        spentAt: review.spentAt ?? existing.spentAt,
        original: review.original ?? existing.original
      };
      const conversion = await convertToBase(edited.original, account.baseCurrency);
      const now = new Date().toISOString();
      const expense: Expense & { importBatchId: string; importRowId: string; duplicateKey: string; duplicateOverrideReason?: string } = {
        id: crypto.randomUUID(),
        accountId,
        source: "import",
        merchant: edited.merchant,
        categoryId: edited.categoryId,
        categoryName: edited.suggestedCategoryName,
        original: edited.original,
        base: conversion.base,
        exchangeRate: conversion.exchangeRate,
        spentAt: edited.spentAt,
        syncStatus: "synced",
        createdAt: now,
        updatedAt: now,
        importBatchId: batchId,
        importRowId: edited.id,
        duplicateKey: duplicateKeyFor(edited),
        duplicateOverrideReason: existing.status === "possible_duplicate" ? review.overrideReason : undefined
      };
      await db.collection(collections.expenses).insertOne(expense);
      await applyExpenseBudgetImpact(expense, user.id);
      approvedExpenses.push(expense);
      nextRows[rowIndex] = { ...existing, status: "approved" };
      await db.collection(collections.importRows).updateOne(
        { id: existing.id, accountId },
        {
          $set: {
            status: "approved",
            updatedAt: now,
            approvedExpenseId: expense.id,
            duplicateOverrideReason: existing.status === "possible_duplicate" ? review.overrideReason : undefined
          }
        }
      );
    }

    await db.collection(collections.importBatches).updateOne(
      { id: batchId, accountId },
      {
        $set: {
          rows: nextRows,
          status: nextRows.every((row) => row.status !== "review") ? "approved" : "review",
          updatedAt: new Date().toISOString()
        }
      }
    );

    if (approvedExpenses.length) {
      await createNotification({
        accountId,
        userId: user.id,
        title: "Import approved",
        body: `${approvedExpenses.length} imported expense${approvedExpenses.length === 1 ? "" : "s"} saved.`,
        tone: "success",
        eventType: "sync_import",
        entityType: "importBatch",
        entityId: batchId
      });
    }

    return ok({ approvedExpenses, deletedRows: nextRows.filter((row) => row.status === "deleted").length });
  } catch (error) {
    return handleApiError(error);
  }
}
