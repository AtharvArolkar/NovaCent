import type {
  AccessibleTableColumn,
  AccessibleTableData,
  BudgetVarianceRow,
  SummaryBucket,
} from "./types";

export const formatMoney = (
  amount: number,
  currency = "INR",
  locale = "en-IN",
) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

export const formatPercent = (amount: number, locale = "en-IN") =>
  new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(amount / 100);

export const makeAccessibleTable = <TRow>(
  caption: string,
  columns: AccessibleTableColumn<TRow>[],
  rows: TRow[],
): AccessibleTableData<TRow> => ({ caption, columns, rows });

export const summaryBucketsTable = (
  caption: string,
  rows: SummaryBucket[],
  currency = "INR",
) =>
  makeAccessibleTable(caption, [
    { key: "label", header: "Label" },
    {
      key: "amount",
      header: "Amount",
      getValue: (row) => formatMoney(row.amount, currency),
    },
    { key: "count", header: "Count" },
  ], rows);

export const budgetVarianceTable = (
  rows: BudgetVarianceRow[],
  currency = "INR",
) =>
  makeAccessibleTable("Budget variance by category", [
    { key: "categoryName", header: "Category" },
    {
      key: "limitAmount",
      header: "Budget",
      getValue: (row) => formatMoney(row.limitAmount, currency),
    },
    {
      key: "actualAmount",
      header: "Actual spend",
      getValue: (row) => formatMoney(row.actualAmount, currency),
    },
    {
      key: "remainingAmount",
      header: "Remaining",
      getValue: (row) => formatMoney(row.remainingAmount, currency),
    },
    {
      key: "usagePercent",
      header: "Used",
      getValue: (row) => formatPercent(row.usagePercent),
    },
    {
      key: "isOverThreshold",
      header: "Alert",
      getValue: (row) => (row.isOverThreshold ? "Threshold reached" : "Within threshold"),
    },
  ], rows);

export const readTableCell = <TRow>(
  column: AccessibleTableColumn<TRow>,
  row: TRow,
) => {
  if (column.getValue) return column.getValue(row);
  return String((row as Record<string, unknown>)[String(column.key)] ?? "");
};

