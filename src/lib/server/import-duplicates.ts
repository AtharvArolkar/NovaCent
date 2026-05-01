import type { ImportRow, Money } from "@/lib/domain";
import { collections, getDb } from "@/lib/server/mongodb";

function normalizeMerchant(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10);
}

function normalizeAmount(money: Money) {
  return Math.round(money.amount * 100);
}

export function duplicateKeyFor(row: Pick<ImportRow, "merchant" | "spentAt" | "original">) {
  return [
    normalizeDate(row.spentAt),
    row.original.currency.toUpperCase(),
    normalizeAmount(row.original),
    normalizeMerchant(row.merchant)
  ].join("|");
}

export async function markPossibleImportDuplicates(accountId: string, rows: ImportRow[]) {
  const db = await getDb();
  const keys = rows.map(duplicateKeyFor);
  const [expenses, importRows] = await Promise.all([
    db.collection(collections.expenses).find({ accountId, duplicateKey: { $in: keys } }).toArray(),
    db.collection(collections.importRows).find({ accountId, duplicateKey: { $in: keys }, status: { $ne: "deleted" } }).toArray()
  ]);

  const expensesByKey = new Map<string, typeof expenses>();
  for (const expense of expenses) {
    const key = String(expense.duplicateKey ?? duplicateKeyFor(expense as unknown as ImportRow));
    expensesByKey.set(key, [...(expensesByKey.get(key) ?? []), expense]);
  }

  const importRowsByKey = new Map<string, typeof importRows>();
  for (const row of importRows) {
    const key = String(row.duplicateKey ?? duplicateKeyFor(row as unknown as ImportRow));
    importRowsByKey.set(key, [...(importRowsByKey.get(key) ?? []), row]);
  }

  return rows.map((row) => {
    const duplicateKey = duplicateKeyFor(row);
    const possibleDuplicates = [
      ...(expensesByKey.get(duplicateKey) ?? []).map((expense) => ({
        type: "expense" as const,
        id: String(expense.id),
        merchant: String(expense.merchant),
        spentAt: String(expense.spentAt),
        original: expense.original as ImportRow["original"]
      })),
      ...(importRowsByKey.get(duplicateKey) ?? []).map((importRow) => ({
        type: "importRow" as const,
        id: String(importRow.id),
        batchId: String(importRow.batchId),
        merchant: String(importRow.merchant),
        spentAt: String(importRow.spentAt),
        original: importRow.original as ImportRow["original"]
      }))
    ];

    return {
      ...row,
      duplicateKey,
      status: possibleDuplicates.length ? "possible_duplicate" as const : row.status,
      possibleDuplicates
    };
  });
}
