import type { Db } from "mongodb";
import type { CurrencySnapshot, Expense, ImportBatch, ImportRow, Money } from "@/lib/domain";
import { applyExpensesBudgetImpact } from "@/lib/server/budgets";
import { getCurrencyRate } from "@/lib/server/currency";
import { duplicateKeyFor } from "@/lib/server/import-duplicates";
import { collections } from "@/lib/server/mongodb";
import { createNotification } from "@/lib/server/notifications";

export type ImportReviewAction = "approve" | "delete";

export interface ImportReviewInput {
  batchId: string;
  rowId: string;
  action: ImportReviewAction;
  merchant?: string;
  categoryId?: string;
  categoryName?: string;
  spentAt?: string;
  original?: Money;
  confirmDuplicate?: boolean;
  overrideReason?: string;
}

export interface ImportReviewResult {
  approvedCount: number;
  deletedCount: number;
  skippedCount: number;
  deletedRows: number;
  missingBatchIds: string[];
}

function reviewKey(batchId: string, rowId: string) {
  return `${batchId}:${rowId}`;
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

async function convertWithCache(original: Money, baseCurrency: string, cache: Map<string, CurrencySnapshot>) {
  const source = original.currency.toUpperCase();
  const target = baseCurrency.toUpperCase();
  const key = `${source}:${target}`;
  let rate = cache.get(key);

  if (!rate) {
    rate = await getCurrencyRate(source, target);
    cache.set(key, rate);
  }

  return {
    base: {
      amount: roundMoney(original.amount * rate.rate),
      currency: target
    },
    exchangeRate: rate.rate === 1 ? undefined : rate
  };
}

function activeImportRow(row: ImportRow) {
  return row.status === "review" || row.status === "possible_duplicate";
}

export async function reviewImportRowsForAccount(
  db: Db,
  input: {
    accountId: string;
    accountBaseCurrency: string;
    userId: string;
    rows: ImportReviewInput[];
  }
): Promise<ImportReviewResult> {
  const uniqueReviewRows = Array.from(
    new Map(input.rows.map((row) => [reviewKey(row.batchId, row.rowId), row])).values()
  );
  const result: ImportReviewResult = {
    approvedCount: 0,
    deletedCount: 0,
    skippedCount: 0,
    deletedRows: 0,
    missingBatchIds: []
  };

  if (!uniqueReviewRows.length) {
    return result;
  }

  const batchIds = Array.from(new Set(uniqueReviewRows.map((row) => row.batchId)));
  const batches = await db.collection<ImportBatch>(collections.importBatches)
    .find({ accountId: input.accountId, id: { $in: batchIds } })
    .toArray();
  const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
  const missingBatchIds = batchIds.filter((batchId) => !batchesById.has(batchId));

  if (missingBatchIds.length) {
    return {
      ...result,
      missingBatchIds,
      skippedCount: uniqueReviewRows.length
    };
  }

  const reviewByKey = new Map(uniqueReviewRows.map((row) => [reviewKey(row.batchId, row.rowId), row]));
  const requestedRowIds = Array.from(new Set(uniqueReviewRows.map((row) => row.rowId)));
  const persistedRows = await db.collection<ImportRow & { accountId: string }>(collections.importRows)
    .find({
      accountId: input.accountId,
      batchId: { $in: batchIds },
      id: { $in: requestedRowIds },
      status: { $in: ["review", "possible_duplicate"] }
    })
    .toArray();
  const rowsByKey = new Map<string, ImportRow>();

  for (const row of persistedRows) {
    rowsByKey.set(reviewKey(row.batchId, row.id), row);
  }

  for (const batch of batches) {
    for (const row of batch.rows ?? []) {
      const key = reviewKey(batch.id, row.id);
      if (reviewByKey.has(key) && activeImportRow(row) && !rowsByKey.has(key)) {
        rowsByKey.set(key, row);
      }
    }
  }

  const approvedExpenses: Array<Expense & {
    importBatchId: string;
    importRowId: string;
    duplicateKey: string;
    duplicateOverrideReason?: string;
  }> = [];
  const approvedRowUpdates: Array<{ batchId: string; rowId: string; expenseId: string; duplicateOverrideReason?: string }> = [];
  const deletedRowUpdates: Array<{ batchId: string; rowId: string }> = [];
  const now = new Date().toISOString();
  const conversionCache = new Map<string, CurrencySnapshot>();

  for (const review of uniqueReviewRows) {
    const existing = rowsByKey.get(reviewKey(review.batchId, review.rowId));
    if (!existing) {
      result.skippedCount += 1;
      continue;
    }

    if (review.action === "delete") {
      deletedRowUpdates.push({ batchId: review.batchId, rowId: existing.id });
      continue;
    }

    if (existing.status === "possible_duplicate" && (!review.confirmDuplicate || !review.overrideReason?.trim())) {
      result.skippedCount += 1;
      continue;
    }

    const edited = {
      ...existing,
      merchant: review.merchant ?? existing.merchant,
      categoryId: review.categoryId ?? existing.categoryId ?? "cat-uncategorized",
      suggestedCategoryName: review.categoryName ?? existing.suggestedCategoryName,
      spentAt: review.spentAt ?? existing.spentAt,
      original: review.original ?? existing.original
    };
    const conversion = await convertWithCache(edited.original, input.accountBaseCurrency, conversionCache);
    const expense: Expense & {
      importBatchId: string;
      importRowId: string;
      duplicateKey: string;
      duplicateOverrideReason?: string;
    } = {
      id: crypto.randomUUID(),
      accountId: input.accountId,
      source: "import",
      merchant: edited.merchant,
      description: edited.description,
      categoryId: edited.categoryId,
      categoryName: edited.suggestedCategoryName,
      original: edited.original,
      base: conversion.base,
      exchangeRate: conversion.exchangeRate,
      spentAt: edited.spentAt,
      syncStatus: "synced",
      createdAt: now,
      updatedAt: now,
      importBatchId: review.batchId,
      importRowId: edited.id,
      duplicateKey: duplicateKeyFor(edited),
      duplicateOverrideReason: existing.status === "possible_duplicate" ? review.overrideReason : undefined
    };
    approvedExpenses.push(expense);
    approvedRowUpdates.push({
      batchId: review.batchId,
      rowId: existing.id,
      expenseId: expense.id,
      duplicateOverrideReason: existing.status === "possible_duplicate" ? review.overrideReason : undefined
    });
  }

  if (approvedExpenses.length) {
    await db.collection(collections.expenses).insertMany(approvedExpenses, { ordered: false });
    await applyExpensesBudgetImpact(approvedExpenses, input.userId);
  }

  const rowBulkWrites = [
    ...deletedRowUpdates.map((row) => ({
      updateOne: {
        filter: { id: row.rowId, accountId: input.accountId, batchId: row.batchId },
        update: { $set: { status: "deleted", updatedAt: now } }
      }
    })),
    ...approvedRowUpdates.map((row) => ({
      updateOne: {
        filter: { id: row.rowId, accountId: input.accountId, batchId: row.batchId },
        update: {
          $set: {
            status: "approved",
            updatedAt: now,
            approvedExpenseId: row.expenseId,
            duplicateOverrideReason: row.duplicateOverrideReason
          }
        }
      }
    }))
  ];

  if (rowBulkWrites.length) {
    await db.collection(collections.importRows).bulkWrite(rowBulkWrites, { ordered: false });
  }

  const changedBatchIds = Array.from(new Set([...approvedRowUpdates, ...deletedRowUpdates].map((row) => row.batchId)));
  const approvedByBatch = new Map<string, Set<string>>();
  const deletedByBatch = new Map<string, Set<string>>();

  for (const row of approvedRowUpdates) {
    const approvedRows = approvedByBatch.get(row.batchId) ?? new Set<string>();
    approvedRows.add(row.rowId);
    approvedByBatch.set(row.batchId, approvedRows);
  }

  for (const row of deletedRowUpdates) {
    const deletedRows = deletedByBatch.get(row.batchId) ?? new Set<string>();
    deletedRows.add(row.rowId);
    deletedByBatch.set(row.batchId, deletedRows);
  }

  await Promise.all(changedBatchIds.map(async (batchId) => {
    const batch = batchesById.get(batchId);
    const [remainingRows, deletedRows, approvedRows, possibleDuplicateRows] = await Promise.all([
      db.collection(collections.importRows).countDocuments({ accountId: input.accountId, batchId, status: { $in: ["review", "possible_duplicate"] } }),
      db.collection(collections.importRows).countDocuments({ accountId: input.accountId, batchId, status: "deleted" }),
      db.collection(collections.importRows).countDocuments({ accountId: input.accountId, batchId, status: "approved" }),
      db.collection(collections.importRows).countDocuments({ accountId: input.accountId, batchId, status: "possible_duplicate" })
    ]);
    const approvedRowsForBatch = approvedByBatch.get(batchId) ?? new Set<string>();
    const deletedRowsForBatch = deletedByBatch.get(batchId) ?? new Set<string>();
    const legacyRows = batch?.rows?.length
      ? {
          rows: batch.rows.map((row) => {
            if (deletedRowsForBatch.has(row.id)) return { ...row, status: "deleted" };
            if (approvedRowsForBatch.has(row.id)) return { ...row, status: "approved" };
            return row;
          })
        }
      : {};

    await db.collection(collections.importBatches).updateOne(
      { id: batchId, accountId: input.accountId },
      {
        $set: {
          ...legacyRows,
          status: remainingRows === 0 ? "approved" : "review",
          pendingCount: remainingRows,
          approvedCount: approvedRows,
          deletedCount: deletedRows,
          duplicateCount: possibleDuplicateRows,
          updatedAt: now
        }
      }
    );
  }));

  if (approvedExpenses.length) {
    await createNotification({
      accountId: input.accountId,
      userId: input.userId,
      title: "Import approved",
      body: `${approvedExpenses.length} imported expense${approvedExpenses.length === 1 ? "" : "s"} saved.`,
      tone: "success",
      eventType: "sync_import",
      entityType: "importBatch",
      entityId: changedBatchIds[0] ?? "bulk-import-review"
    });
  }

  result.approvedCount = approvedExpenses.length;
  result.deletedCount = deletedRowUpdates.length;
  result.deletedRows = deletedRowUpdates.length;
  return result;
}
