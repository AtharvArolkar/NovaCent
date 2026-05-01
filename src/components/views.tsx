"use client";

import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { addExistingExpensesToParty, addPartyParticipant, approvePartySettlement, createBudget, createExpense, createParty, createPartyExpense, createRecurringExpenseRule, deleteBudget, deleteExpense, deleteParty, deletePartyExpense, getAccounts, getBudgets, getExpenses, getImportRows, getOverview, getParties, getPartyDetail, getRecurringExpenses, getReports, markPartySplitSettled, reportDataToCsv, reviewImportRow, reviewImportRows, searchUsers, submitSupportRequest, syncPendingOutbox, updateBudget, updateRecurringExpenseRule, uploadStatement } from "@/lib/client/expense-service";
import type { PartyDetail, PartyParticipant, PartyParticipantInput, PartySettlement, PartySplit, RecurringExpenseInput, RecurringExpenseRule, ReportRangeInput, SupportRequestInput, UserSearchResult } from "@/lib/client/expense-service";
import type { Account, Budget, Expense, ImportRow, Party } from "@/lib/client/demo-data";
import { guideContent, languages, type Language } from "@/lib/client/dictionary";
import type { ReportingChartData } from "@/lib/reporting";
import { currencyOptions, usePreferences } from "@/lib/client/preferences";
import {
  BudgetVarianceChart,
  CashFlowTrendChart,
  CategoryBreakdownChart,
  ChartSkeleton,
  MerchantTrendsChart,
  PartySummaryChart,
  SummaryBarsChart,
} from "./ReportingCharts";
import { EmptyState, MetricCard, PageHeader, Panel, ProgressBar, StatusPill } from "./ui";

function formatCurrency(amount: number, currency = "INR") {
  const currencyCode = currency.toUpperCase();
  try {
    return `${new Intl.NumberFormat("en-IN", { style: "currency", currency: currencyCode }).format(amount)} ${currencyCode}`;
  } catch {
    return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(amount)} ${currencyCode}`;
  }
}

function moneyFlowClass(amount: number) {
  return amount < 0 ? "positive" : amount > 0 ? "negative" : "muted-note";
}

function formatMoneyFlow(amount: number, currency = "INR") {
  if (amount === 0) {
    return formatCurrency(0, currency);
  }

  const sign = amount < 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(amount), currency)}`;
}

function signedAmountClass(amount: number) {
  return amount > 0 ? "positive" : amount < 0 ? "negative" : "muted-note";
}

function formatSignedAmount(amount: number, currency = "INR") {
  if (amount === 0) {
    return formatCurrency(0, currency);
  }

  const sign = amount > 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(amount), currency)}`;
}

function formatOutflowAmount(amount: number, currency = "INR") {
  return amount === 0 ? formatCurrency(0, currency) : `-${formatCurrency(Math.abs(amount), currency)}`;
}

function formatInflowAmount(amount: number, currency = "INR") {
  return amount === 0 ? formatCurrency(0, currency) : `+${formatCurrency(Math.abs(amount), currency)}`;
}

function signedImportAmount(row: ImportRow, fallbackCurrency = "INR") {
  const amount = importAmountValue(row);
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(amount), row.currency ?? fallbackCurrency)}`;
}

function importAmountValue(row: ImportRow) {
  if (row.direction === "deposit") {
    return Math.abs(row.depositAmount ?? row.amount);
  }

  if (row.direction === "withdrawal") {
    return -Math.abs(row.withdrawalAmount ?? row.amount);
  }

  const amount = row.depositAmount
    ? row.depositAmount
    : row.withdrawalAmount
      ? -row.withdrawalAmount
      : row.amount < 0
        ? Math.abs(row.amount)
        : -Math.abs(row.amount);
  return amount;
}

const expenseCategoryOptions = ["Food", "Shopping", "Travel", "Fuel", "Loan/EMI", "Subscriptions", "Health", "Others"];
const importReviewCategoryOptions = ["Uncategorized", ...expenseCategoryOptions, "Reimbursements"];

function importCategoriesFor(selectedCategory: string) {
  return importReviewCategoryOptions.includes(selectedCategory) ? importReviewCategoryOptions : [...importReviewCategoryOptions, selectedCategory];
}

function CategoryOptions({ options = expenseCategoryOptions }: { options?: string[] }) {
  const { tx } = usePreferences();
  return (
    <>
      {options.map((category) => (
        <option key={category} value={category}>{tx(category)}</option>
      ))}
    </>
  );
}

type DateInputElement = HTMLInputElement & { showPicker?: () => void };

function DateField({
  label,
  name,
  value,
  defaultValue,
  required,
  onChange
}: {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  const { tx } = usePreferences();
  const labelId = useId();
  const inputRef = useRef<DateInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    try {
      input.showPicker?.();
    } catch {
      // Some browsers only allow native pickers from direct pointer actions.
    }
  };

  return (
    <div className="date-field">
      <span id={labelId}>{tx(label)}</span>
      <span className="date-input-shell">
        <input
          ref={inputRef}
          aria-labelledby={labelId}
          name={name}
          type="date"
          value={value}
          defaultValue={defaultValue}
          required={required}
          onClick={openPicker}
          onChange={(event) => onChange?.(event.target.value)}
        />
        <button className="date-picker-button" type="button" aria-label={`${tx("Open date picker")} ${tx(label)}`} onClick={openPicker}>
          <CalendarDays aria-hidden="true" size={16} />
        </button>
      </span>
    </div>
  );
}

const emptyReportData: ReportingChartData = {
  categories: [],
  cashflow: [],
  budgetVariance: [],
  merchantTrends: [],
  trips: [],
  parties: [],
  currencies: [],
};

const todayInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type ReportRangePreset = "15d" | "1m" | "3m" | "1y" | "3y" | "all" | "custom";

const reportRangeOptions: Array<{ value: ReportRangePreset; label: string }> = [
  { value: "15d", label: "Past 15 days" },
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "1y", label: "1 year" },
  { value: "3y", label: "3 years" },
  { value: "all", label: "All" }
];

function dateInputFrom(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function reportRangeForPreset(preset: ReportRangePreset): ReportRangeInput & { preset: ReportRangePreset } {
  const end = new Date();
  const start = new Date(end);
  if (preset === "all") {
    return { preset, startDate: "", endDate: "" };
  }
  if (preset === "15d") {
    start.setDate(start.getDate() - 15);
  } else if (preset === "1m") {
    start.setMonth(start.getMonth() - 1);
  } else if (preset === "3m") {
    start.setMonth(start.getMonth() - 3);
  } else if (preset === "3y") {
    start.setFullYear(start.getFullYear() - 3);
  } else {
    start.setFullYear(start.getFullYear() - 1);
  }
  return { preset, startDate: dateInputFrom(start), endDate: dateInputFrom(end) };
}

type SubmitState = "idle" | "saving" | "saved" | "failed";

type ConfirmationRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
};

function ConfirmationDialog({
  request,
  onCancel,
  onConfirm,
  isConfirming
}: {
  request: ConfirmationRequest;
  onCancel: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
}) {
  const { tx } = usePreferences();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmButtonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onCancel();
      }
    }}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
        <div>
          <p className="eyebrow">{tx("Confirmation")}</p>
          <h2 id="confirm-dialog-title">{tx(request.title)}</h2>
          <p id="confirm-dialog-description">{tx(request.message)}</p>
          <p className="muted-note">{tx("This action cannot be undone.")}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button className="secondary-button" type="button" disabled={isConfirming} onClick={onCancel}>{tx("Cancel")}</button>
          <button ref={confirmButtonRef} className="danger-button" type="button" disabled={isConfirming} onClick={onConfirm}>{tx(request.confirmLabel ?? "Delete")}</button>
        </div>
      </section>
    </div>
  );
}

function CurrencyOptions() {
  return (
    <>
      {currencyOptions.map((currency) => (
        <option key={currency} value={currency}>{currency}</option>
      ))}
    </>
  );
}

function useConfirmationDialog() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const closeConfirmation = useCallback(() => {
    if (isConfirming) return;
    setRequest(null);
  }, [isConfirming]);

  const confirmRequest = useCallback(async () => {
    if (!request || isConfirming) return;
    setIsConfirming(true);
    try {
      await request.onConfirm();
    } finally {
      setIsConfirming(false);
      setRequest(null);
    }
  }, [isConfirming, request]);

  const confirmationDialog = request ? (
    <ConfirmationDialog request={request} onCancel={closeConfirmation} onConfirm={() => void confirmRequest()} isConfirming={isConfirming} />
  ) : null;

  return { requestConfirmation: setRequest, confirmationDialog };
}

function focusFirstFormField(form: HTMLFormElement | null) {
  form?.scrollIntoView({ behavior: "smooth", block: "center" });
  form?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")?.focus();
}

function focusFormAfterRender(getForm: () => HTMLFormElement | null) {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => focusFirstFormField(getForm()));
}

function budgetPeriodLabel(period?: "monthly" | "yearly") {
  return period === "yearly" ? "year" : "month";
}

function budgetPeriodWindow(period?: "monthly" | "yearly") {
  return period === "yearly" ? "Jan 1 to Dec 31" : "1st of this month to month end";
}

function budgetUsagePercent(budget: Pick<Budget, "spent" | "limit">) {
  return budget.limit > 0 ? Math.round((budget.spent / budget.limit) * 100) : 0;
}

function budgetUsageToneClass(budget: Pick<Budget, "spent" | "limit" | "alertThreshold">) {
  const alertThreshold = budget.alertThreshold ?? 80;
  return budgetUsagePercent(budget) >= alertThreshold ? "negative" : "positive";
}

function useAsyncData<T>(loader: () => Promise<T>, initial: T) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const initialRef = useRef(initial);

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    setData(initialRef.current);
    return loader()
      .then((result) => {
        setData(result);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Unable to load data");
      })
      .finally(() => setLoading(false));
  }, [loader]);

  useEffect(() => {
    let mounted = true;
    reload().then(() => {
      if (!mounted) return;
    });
    return () => {
      mounted = false;
    };
  }, [reload]);

  return { data, setData, loading, error, reload };
}

function LoadingNote({ label }: { label: string }) {
  const { tx } = usePreferences();
  return <p className="loading-note" role="status">{tx(label)}</p>;
}

function ExpenseTable({
  rows,
  onDelete,
  selectedIds,
  onToggleSelect,
  isSelectable
}: {
  rows: Expense[];
  onDelete?: (expense: Expense) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (expense: Expense) => void;
  isSelectable?: (expense: Expense) => boolean;
}) {
  const { tx } = usePreferences();
  if (!rows.length) return <EmptyState title="No expenses yet" description="New spending will appear here once imported or added." />;
  const showActions = Boolean(onDelete);
  const showSelection = Boolean(onToggleSelect);
  return (
    <div className="table-wrap">
      <table>
        <caption>{tx("Expense ledger with merchant, category, owner, amount, and status")}</caption>
        <thead>
          <tr>
            {showSelection ? <th scope="col">{tx("Select")}</th> : null}
            <th scope="col">{tx("Date")}</th>
            <th scope="col">{tx("Merchant")}</th>
            <th scope="col">{tx("Category")}</th>
            <th scope="col">{tx("Owner")}</th>
            <th scope="col" className="numeric">{tx("Amount")}</th>
            <th scope="col">{tx("Status")}</th>
            {showActions ? <th scope="col">{tx("Action")}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((expense) => {
            const selectable = isSelectable ? isSelectable(expense) : true;
            return (
              <tr key={expense.id}>
                {showSelection ? (
                  <td>
                    <input
                      aria-label={`${tx("Select")} ${expense.merchant}`}
                      checked={selectedIds?.has(expense.id) ?? false}
                      disabled={!selectable}
                      type="checkbox"
                      onChange={() => onToggleSelect?.(expense)}
                    />
                  </td>
                ) : null}
                <td>{expense.date}</td>
                <td>{expense.merchant}</td>
                <td>{tx(expense.category)}</td>
                <td>{expense.owner}</td>
                <td className={`numeric ${moneyFlowClass(expense.amount)}`}>{formatMoneyFlow(expense.amount, expense.currency ?? "INR")}</td>
                <td><StatusPill tone={expense.status === "cleared" ? "good" : expense.status === "pending" ? "warn" : "bad"}>{tx(expense.status)}</StatusPill></td>
                {showActions ? (
                  <td>
                    {expense.canDelete === false ? (
                      <span className="muted-note">{tx("Locked")}</span>
                    ) : (
                      <button className="danger-button" type="button" onClick={() => onDelete?.(expense)}>{tx("Delete")}</button>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BudgetList({ rows }: { rows: Budget[] }) {
  const { tx } = usePreferences();
  return (
    <div className="stack">
      {rows.map((budget) => {
        const percent = budgetUsagePercent(budget);
        return (
          <article className="budget-row" key={budget.id}>
            <div>
              <h3>{tx(budget.category)}</h3>
              <p className="budget-money-line">
                <strong className={budgetUsageToneClass(budget)}>{formatCurrency(budget.spent, budget.currency ?? "INR")}</strong>
                <span>{tx("of")}</span>
                <strong>{formatCurrency(budget.limit, budget.currency ?? "INR")}</strong>
              </p>
            </div>
            <ProgressBar label={`${tx(budget.category)} ${tx("spend")}`} value={percent} />
          </article>
        );
      })}
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const { defaultCurrency, tx } = usePreferences();
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="chart-alt" role="img" aria-label={`${tx(title)} ${tx("bar chart")}. ${rows.map((row) => `${tx(row.label)}: ${formatCurrency(row.value, defaultCurrency)}`).join(", ")}`}>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>{tx(row.label)}</span>
          <div><i style={{ width: `${(row.value / max) * 100}%` }} /></div>
          <b>{formatCurrency(row.value, defaultCurrency)}</b>
        </div>
      ))}
    </div>
  );
}

export function DashboardView() {
  const { accountId, defaultCurrency, t, tx } = usePreferences();
  const loadOverview = useCallback(() => getOverview(accountId, defaultCurrency), [accountId, defaultCurrency]);
  const { data, loading, reload } = useAsyncData(loadOverview, { totalSpend: 0, remainingBudget: 0, monthlyRunway: 0, pendingImports: 0, budgets: [], expenses: [] });
  const [syncState, setSyncState] = useState<SubmitState>("idle");

  return (
    <>
      <PageHeader
        title={t("dashboard")}
        description="A calm command center for personal, party, and imported spending."
        action={
          <button
            type="button"
            disabled={syncState === "saving"}
            onClick={async () => {
              setSyncState("saving");
              try {
                await syncPendingOutbox(accountId);
                await reload();
                setSyncState("saved");
              } catch {
                setSyncState("failed");
              }
            }}
          >
            {syncState === "saving" ? tx("Syncing") : t("syncNow")}
          </button>
        }
      />
      {loading ? <LoadingNote label="Loading dashboard" /> : null}
      {syncState === "saved" ? <p className="success-note" role="status">{tx("Sync complete.")}</p> : null}
      {syncState === "failed" ? <p className="error-note" role="alert">{tx("Unable to sync right now.")}</p> : null}
      <section className="metric-grid" aria-label={tx("Key account metrics")}>
        <MetricCard label={t("totalSpend")} value={formatCurrency(data.totalSpend, defaultCurrency)} detail="Across visible transactions this month" />
        <MetricCard label={t("remainingBudget")} value={formatCurrency(data.remainingBudget, defaultCurrency)} detail="Available across active envelopes" />
        <MetricCard label={t("monthlyRunway")} value={`${data.monthlyRunway} ${tx("days")}`} detail="At the current seven-day average" />
        <MetricCard label={t("pendingImports")} value={String(data.pendingImports)} detail="Rows waiting for review" />
      </section>
      <div className="content-grid">
        <Panel title="Budget health"><BudgetList rows={data.budgets} /></Panel>
        <Panel title="Recent activity"><ExpenseTable rows={data.expenses} /></Panel>
      </div>
    </>
  );
}

export function ExpensesView() {
  const { accountId, defaultCurrency, t, tx } = usePreferences();
  const loadExpenses = useCallback(() => getExpenses(accountId), [accountId]);
  const { data, setData, error, reload } = useAsyncData(loadExpenses, []);
  const { data: partyOptions } = useAsyncData(useCallback(() => getParties(accountId), [accountId]), [] as Party[]);
  const [query, setQuery] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [deleteState, setDeleteState] = useState<SubmitState>("idle");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [selectedSplitPartyId, setSelectedSplitPartyId] = useState("");
  const [splitAddState, setSplitAddState] = useState<SubmitState>("idle");
  const quickAddRef = useRef<HTMLFormElement>(null);
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const filtered = useMemo(
    () => data.filter((expense) => `${expense.merchant} ${expense.category} ${expense.owner}`.toLowerCase().includes(query.toLowerCase())),
    [data, query]
  );
  const selectableForSplit = useCallback((expense: Expense) =>
    (!expense.source || ["manual", "import", "recurring"].includes(expense.source)) && !expense.partyId && !expense.settlementId,
  []);
  const selectedExpenseIdList = useMemo(() => Array.from(selectedExpenseIds), [selectedExpenseIds]);

  function toggleExpenseSelection(expense: Expense) {
    if (!selectableForSplit(expense)) return;
    setSelectedExpenseIds((current) => {
      const next = new Set(current);
      if (next.has(expense.id)) {
        next.delete(expense.id);
      } else {
        next.add(expense.id);
      }
      return next;
    });
  }

  async function onAddSelectedToParty() {
    if (!selectedSplitPartyId || !selectedExpenseIdList.length) return;
    setSplitAddState("saving");
    try {
      await addExistingExpensesToParty(accountId, selectedSplitPartyId, selectedExpenseIdList);
      setSelectedExpenseIds(new Set());
      setSelectedSplitPartyId("");
      await reload();
      setSplitAddState("saved");
    } catch {
      setSplitAddState("failed");
    }
  }

  function stageSelectedForNewParty() {
    if (!selectedExpenseIdList.length || typeof window === "undefined") return;
    window.sessionStorage.setItem("novacent-staged-split-expenses", JSON.stringify(selectedExpenseIdList));
    window.location.assign("/parties");
  }

  async function onQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitState("saving");
    const form = new FormData(formElement);
    const merchant = String(form.get("merchant") ?? "").trim();
    const categoryName = String(form.get("category") ?? "Uncategorized");
    const amount = Number(form.get("amount"));
    const spentAt = String(form.get("date") ?? new Date().toISOString().slice(0, 10));
    const currency = String(form.get("currency") ?? defaultCurrency);

    try {
      const expense = await createExpense(accountId, { merchant, categoryName, amount, currency, spentAt });
      setData((rows) => [expense, ...rows]);
      formElement.reset();
      setSubmitState("saved");
    } catch {
      setSubmitState("failed");
    }
  }

  function onDeleteExpense(expense: Expense) {
    requestConfirmation({
      title: "Confirm delete",
      message: `${tx("Delete")} ${expense.merchant} ${tx("from expenses?")}`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        setDeleteState("saving");
        try {
          await deleteExpense(accountId, expense.id);
          setData((rows) => rows.filter((row) => row.id !== expense.id));
          setDeleteState("saved");
        } catch {
          setDeleteState("failed");
        }
      }
    });
  }

  return (
    <>
      {confirmationDialog}
      <PageHeader
        title={t("expenses")}
        description="Search, add, and review every transaction before it hits reports."
        action={
          <div className="inline-actions header-actions">
            {selectedExpenseIds.size ? <button type="button" onClick={stageSelectedForNewParty}>{tx("Create party from selection")}</button> : null}
            <button
              type="button"
              onClick={() => {
                focusFirstFormField(quickAddRef.current);
              }}
            >
              {t("addExpense")}
            </button>
          </div>
        }
      />
      {error ? <p className="error-note" role="alert">{tx(error)}</p> : null}
      {deleteState === "saved" ? <p className="success-note" role="status">{tx("Expense deleted.")}</p> : null}
      {deleteState === "failed" ? <p className="error-note" role="alert">{tx("Unable to delete expense. Settled party expenses and settlement rows are locked.")}</p> : null}
      <Panel title="Quick add">
        <form ref={quickAddRef} className="form-grid" onSubmit={onQuickAdd}>
          <label>{tx("Merchant")}<input name="merchant" required /></label>
          <label>{tx("Category")}<select name="category"><CategoryOptions /></select></label>
          <label>{tx("Amount")}<input name="amount" type="number" min="0" step="0.01" required /></label>
          <label>{tx("Currency")}<select name="currency" defaultValue={defaultCurrency}><CurrencyOptions /></select></label>
          <DateField label="Date" name="date" defaultValue={todayInputValue()} required />
          <button className="form-submit" type="submit" disabled={submitState === "saving"}>{submitState === "saving" ? tx("Saving") : t("save")}</button>
        </form>
        {submitState === "saved" ? <p className="success-note" role="status">{tx("Expense saved or queued for sync.")}</p> : null}
        {submitState === "failed" ? <p className="error-note" role="alert">{tx("Unable to save expense.")}</p> : null}
      </Panel>
      {selectedExpenseIds.size ? (
        <Panel title="Add selected expenses to split">
          <div className="form-grid">
            <label>{tx("Existing party")}<select value={selectedSplitPartyId} onChange={(event) => setSelectedSplitPartyId(event.target.value)}><option value="">{tx("Choose party")}</option>{partyOptions.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
            <button className="form-submit" type="button" disabled={!selectedSplitPartyId || splitAddState === "saving"} onClick={() => void onAddSelectedToParty()}>{splitAddState === "saving" ? tx("Saving") : tx("Add to party split")}</button>
            <button className="secondary-button" type="button" onClick={stageSelectedForNewParty}>{tx("Create new party instead")}</button>
          </div>
          {splitAddState === "saved" ? <p className="success-note" role="status">{tx("Selected expenses added to the party split.")}</p> : null}
          {splitAddState === "failed" ? <p className="error-note" role="alert">{tx("Unable to add selected expenses. Add at least two participants to the party first.")}</p> : null}
        </Panel>
      ) : null}
      <Panel title="Expense ledger" aside={<label className="search-box"><span>{t("search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx("Merchant, category, owner")} /></label>}>
        <ExpenseTable rows={filtered} onDelete={onDeleteExpense} selectedIds={selectedExpenseIds} onToggleSelect={toggleExpenseSelection} isSelectable={selectableForSplit} />
      </Panel>
    </>
  );
}

export function BudgetsView() {
  const { accountId, defaultCurrency, t, tx } = usePreferences();
  const loadBudgets = useCallback(() => getBudgets(accountId, defaultCurrency), [accountId, defaultCurrency]);
  const { data, setData } = useAsyncData(loadBudgets, [] as Budget[]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetState, setBudgetState] = useState<SubmitState>("idle");
  const [budgetDeleteState, setBudgetDeleteState] = useState<SubmitState>("idle");
  const budgetFormRef = useRef<HTMLFormElement>(null);
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();

  async function onCreateBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBudgetState("saving");
    const form = new FormData(formElement);
    const categoryName = String(form.get("categoryName") ?? "").trim();
    const scope = String(form.get("scope") ?? "overall") as "overall" | "category";
    const limit = Number(form.get("limit"));
    const currency = String(form.get("currency") ?? defaultCurrency);
    const period = String(form.get("period") ?? "monthly") as "monthly" | "yearly";
    const alertThreshold = Number(form.get("alertThreshold") || 80);

    try {
      if (!categoryName || !Number.isFinite(limit) || limit <= 0) {
        throw new Error("Invalid budget");
      }
      const budgetInput = { categoryName, scope, limit, currency, period, alertThreshold };
      const budget = editingBudget
        ? await updateBudget(accountId, editingBudget.id, budgetInput, defaultCurrency)
        : await createBudget(accountId, budgetInput, defaultCurrency);
      setData((rows) =>
        editingBudget
          ? rows.map((row) => (row.id === editingBudget.id ? budget : row))
          : [budget, ...rows.filter((row) => row.category.toLowerCase() !== budget.category.toLowerCase() || row.period !== budget.period)]
      );
      formElement.reset();
      setEditingBudget(null);
      setShowBudgetForm(false);
      setBudgetState("saved");
    } catch {
      setBudgetState("failed");
    }
  }

  function onDeleteBudget(budget: Budget) {
    requestConfirmation({
      title: "Confirm delete",
      message: `${tx("Delete")} ${tx(budget.category)} ${tx("budget?")}`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        setBudgetDeleteState("saving");
        try {
          await deleteBudget(accountId, budget.id);
          setData((rows) => rows.filter((row) => row.id !== budget.id));
          setBudgetDeleteState("saved");
        } catch {
          setBudgetDeleteState("failed");
        }
      }
    });
  }

  return (
    <>
      {confirmationDialog}
      <PageHeader
        title={t("budgets")}
        description="Track limits, spot overspend early, and keep categories honest."
        action={
          <button
            type="button"
            aria-expanded={showBudgetForm}
            onClick={() => {
              setEditingBudget(null);
              setShowBudgetForm(true);
              focusFormAfterRender(() => budgetFormRef.current);
            }}
          >
            {tx("New budget")}
          </button>
        }
      />
      {showBudgetForm ? (
        <Panel title={editingBudget ? "Edit budget" : "New budget"}>
          <form key={editingBudget?.id ?? "new-budget"} ref={budgetFormRef} className="form-grid" onSubmit={onCreateBudget}>
            <label>{tx("Budget name or category")}<input name="categoryName" placeholder={tx("Monthly Budget")} defaultValue={editingBudget?.category ?? ""} required /></label>
            <label>{tx("Tracks")}<select name="scope" defaultValue={editingBudget?.scope ?? "overall"}><option value="overall">{tx("Overall spend")}</option><option value="category">{tx("Single category")}</option></select></label>
            <label>{tx("Limit")}<input name="limit" type="number" min="1" step="0.01" defaultValue={editingBudget?.limit ?? ""} required /></label>
            <label>{tx("Period")}<select name="period" defaultValue={editingBudget?.period ?? "monthly"}><option value="monthly">{tx("Monthly")}</option><option value="yearly">{tx("Yearly")}</option></select></label>
            <label>{tx("Currency")}<select name="currency" defaultValue={editingBudget?.currency ?? defaultCurrency}><CurrencyOptions /></select></label>
            <label>{tx("Alert at %")}<input name="alertThreshold" type="number" min="1" max="100" defaultValue={editingBudget?.alertThreshold ?? 80} required /></label>
            <div className="inline-actions budget-form-actions">
              <button className="form-submit" type="submit" disabled={budgetState === "saving"}>{budgetState === "saving" ? tx("Saving") : editingBudget ? tx("Update budget") : tx("Save budget")}</button>
              <button className="secondary-button" type="button" onClick={() => {
                setShowBudgetForm(false);
                setEditingBudget(null);
              }}>
                {tx("Cancel")}
              </button>
            </div>
          </form>
          {budgetState === "saved" ? <p className="success-note" role="status">{tx("Budget saved.")}</p> : null}
          {budgetState === "failed" ? <p className="error-note" role="alert">{tx("Unable to save budget.")}</p> : null}
        </Panel>
      ) : null}
      {budgetDeleteState === "saved" ? <p className="success-note" role="status">{tx("Budget deleted.")}</p> : null}
      {budgetDeleteState === "failed" ? <p className="error-note" role="alert">{tx("Unable to delete budget.")}</p> : null}
      <Panel title="Active budgets">
        <div className="stack">
          {data.map((budget) => {
            const percent = budgetUsagePercent(budget);
            const period = budget.period ?? "monthly";
            const includedExpenses = budget.includedExpenses ?? [];
            return (
              <article className="budget-row budget-card" key={budget.id}>
                <div className="budget-card-main">
                  <div>
                    <h3>{tx(budget.category)}</h3>
                    <p>{budget.scope === "overall" ? tx("Overall spend") : tx("Single category")}</p>
                    <p className="budget-money-line">
                      <strong className={budgetUsageToneClass(budget)}>{formatCurrency(budget.spent, budget.currency ?? "INR")}</strong>
                      <span>{tx("of")}</span>
                      <strong>{formatCurrency(budget.limit, budget.currency ?? "INR")}</strong>
                      <span>{period === "yearly" ? tx("this year") : tx("this month")}</span>
                    </p>
                    <small>{tx(budgetPeriodWindow(period))}</small>
                  </div>
                  <ProgressBar label={`${tx(budget.category)} ${tx("spend")}`} value={percent} />
                  <div className="budget-actions">
                    <button className="secondary-button" type="button" aria-label={`${tx("Edit budget")}: ${tx(budget.category)}`} onClick={() => {
                      setEditingBudget(budget);
                      setShowBudgetForm(true);
                      focusFormAfterRender(() => budgetFormRef.current);
                    }}>{tx("Edit budget")}</button>
                    <button className="danger-button" type="button" onClick={() => void onDeleteBudget(budget)}>{tx("Delete")}</button>
                  </div>
                </div>
                <details className="budget-expense-details">
                  <summary>
                    <span>{tx("Included expenses")}</span>
                    <strong>{includedExpenses.length}</strong>
                  </summary>
                  {includedExpenses.length ? (
                    <ul className="budget-expense-list">
                      {includedExpenses.map((expense) => (
                        <li className="budget-expense-item" key={expense.id}>
                          <span>{expense.date}</span>
                          <div>
                            <strong>{expense.merchant}</strong>
                            <small>{tx(expense.category)}{expense.source ? ` · ${tx(expense.source)}` : ""}</small>
                          </div>
                          <span className={moneyFlowClass(expense.amount)}>
                            {formatMoneyFlow(expense.amount, expense.currency ?? budget.currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="budget-empty-note">{tx("No expenses included in this budget yet.")}</p>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

export function RecurringExpensesView() {
  const { accountId, defaultCurrency, t, tx } = usePreferences();
  const loadRecurring = useCallback(() => getRecurringExpenses(accountId), [accountId]);
  const { data, setData, error } = useAsyncData(loadRecurring, [] as RecurringExpenseRule[]);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringExpenseRule | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [actionState, setActionState] = useState<SubmitState>("idle");
  const recurringFormRef = useRef<HTMLFormElement>(null);

  async function onSaveRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input: RecurringExpenseInput = {
      merchant: String(form.get("merchant") ?? "").trim(),
      description: String(form.get("description") ?? "").trim() || undefined,
      categoryName: String(form.get("category") ?? "Food"),
      amount: Number(form.get("amount")),
      currency: String(form.get("currency") ?? defaultCurrency),
      frequency: String(form.get("frequency") ?? "monthly") as RecurringExpenseRule["frequency"],
      interval: Number(form.get("interval") || 1),
      startsAt: String(form.get("startsAt") ?? todayInputValue()),
      endsAt: String(form.get("endsAt") ?? "").trim() || undefined,
      notes: String(form.get("notes") ?? "").trim() || undefined
    };

    try {
      setSubmitState("saving");
      if (!input.merchant || !Number.isFinite(input.amount) || input.amount <= 0 || !Number.isFinite(input.interval) || input.interval < 1) {
        throw new Error("Invalid recurring rule");
      }
      const rule = editingRule
        ? await updateRecurringExpenseRule(accountId, editingRule.id, input)
        : await createRecurringExpenseRule(accountId, input);
      setData((rules) => (editingRule ? rules.map((current) => (current.id === rule.id ? rule : current)) : [rule, ...rules]));
      formElement.reset();
      setEditingRule(null);
      setShowForm(false);
      setSubmitState("saved");
    } catch {
      setSubmitState("failed");
    }
  }

  async function updateRuleStatus(rule: RecurringExpenseRule, status: RecurringExpenseRule["status"]) {
    try {
      setActionState("saving");
      const updated = await updateRecurringExpenseRule(accountId, rule.id, {
        merchant: rule.merchant,
        description: rule.description,
        categoryName: rule.categoryName,
        amount: rule.amount,
        currency: rule.currency,
        frequency: rule.frequency,
        interval: rule.interval,
        startsAt: rule.nextRunAt || rule.startsAt,
        endsAt: rule.endsAt,
        notes: rule.notes,
        status
      });
      setData((rules) => rules.map((current) => (current.id === rule.id ? updated : current)));
      setActionState("saved");
    } catch {
      setActionState("failed");
    }
  }

  return (
    <>
      <PageHeader
        title={t("recurring")}
        description="Create recurring rules that post due expenses automatically in the background."
        action={
          <button
            type="button"
            aria-expanded={showForm}
            onClick={() => {
              setEditingRule(null);
              setShowForm(true);
              focusFormAfterRender(() => recurringFormRef.current);
            }}
          >
            {tx("New recurring rule")}
          </button>
        }
      />
      {error ? <p className="error-note" role="alert">{tx(error)}</p> : null}
      {showForm ? (
        <Panel title={editingRule ? "Edit recurring rule" : "New recurring rule"}>
          <form key={editingRule?.id ?? "new-recurring"} ref={recurringFormRef} className="form-grid" onSubmit={onSaveRecurring}>
            <label>{tx("Merchant")}<input name="merchant" defaultValue={editingRule?.merchant ?? ""} required /></label>
            <label>{tx("Description")}<input name="description" defaultValue={editingRule?.description ?? ""} /></label>
            <label>{tx("Category")}<select name="category" defaultValue={editingRule?.categoryName ?? "Food"}><CategoryOptions /></select></label>
            <label>{tx("Amount")}<input name="amount" type="number" min="0.01" step="0.01" defaultValue={editingRule?.amount ?? ""} required /></label>
            <label>{tx("Currency")}<select name="currency" defaultValue={editingRule?.currency ?? defaultCurrency}><CurrencyOptions /></select></label>
            <label>{tx("Frequency")}<select name="frequency" defaultValue={editingRule?.frequency ?? "monthly"}><option value="daily">{tx("Daily")}</option><option value="weekly">{tx("Weekly")}</option><option value="monthly">{tx("Monthly")}</option><option value="yearly">{tx("Yearly")}</option></select></label>
            <label>{tx("Interval")}<input name="interval" type="number" min="1" max="36" defaultValue={editingRule?.interval ?? 1} required /></label>
            <DateField label="Start date" name="startsAt" defaultValue={editingRule?.startsAt ?? todayInputValue()} required />
            <DateField label="End date" name="endsAt" defaultValue={editingRule?.endsAt ?? ""} />
            <label className="wide-field">{tx("Notes")}<textarea name="notes" defaultValue={editingRule?.notes ?? ""} rows={3} /></label>
            <div className="inline-actions budget-form-actions">
              <button className="form-submit" type="submit" disabled={submitState === "saving"}>{submitState === "saving" ? tx("Saving") : editingRule ? tx("Update recurring rule") : tx("Save recurring rule")}</button>
              <button className="secondary-button" type="button" onClick={() => {
                setShowForm(false);
                setEditingRule(null);
              }}>{tx("Cancel")}</button>
            </div>
          </form>
          {submitState === "saved" ? <p className="success-note" role="status">{tx("Recurring rule saved.")}</p> : null}
          {submitState === "failed" ? <p className="error-note" role="alert">{tx("Unable to save recurring rule.")}</p> : null}
        </Panel>
      ) : null}
      {actionState === "saved" ? <p className="success-note" role="status">{tx("Recurring rule updated.")}</p> : null}
      {actionState === "failed" ? <p className="error-note" role="alert">{tx("Unable to update recurring rule.")}</p> : null}
      <Panel title="Recurring rules">
        <div className="stack">
          {data.map((rule) => (
            <article className="budget-row managed-row" key={rule.id}>
              <div>
                <h3>{rule.merchant}</h3>
                <p>{tx(rule.categoryName)} · {formatCurrency(rule.amount, rule.currency)} · {tx(rule.frequency)}</p>
                <p>{tx("Next run")}: {rule.nextRunAt}</p>
                <StatusPill tone={rule.status === "active" ? "good" : rule.status === "paused" ? "warn" : "bad"}>{tx(rule.status)}</StatusPill>
              </div>
              <div className="budget-actions">
                <button className="secondary-button" type="button" onClick={() => {
                  setEditingRule(rule);
                  setShowForm(true);
                  focusFormAfterRender(() => recurringFormRef.current);
                }}>{tx("Edit")}</button>
                {rule.status === "active" ? (
                  <button className="secondary-button" type="button" onClick={() => void updateRuleStatus(rule, "paused")}>{tx("Pause")}</button>
                ) : rule.status === "paused" ? (
                  <button className="secondary-button" type="button" onClick={() => void updateRuleStatus(rule, "active")}>{tx("Resume")}</button>
                ) : null}
                {rule.status !== "ended" ? <button className="danger-button" type="button" onClick={() => void updateRuleStatus(rule, "ended")}>{tx("End")}</button> : null}
              </div>
            </article>
          ))}
          {!data.length ? <EmptyState title="No recurring rules yet" description="Create rules for expenses that should post automatically when due." /> : null}
        </div>
      </Panel>
    </>
  );
}

export function ImportReviewView() {
  const { accountId, tx } = usePreferences();
  const loadImportRows = useCallback(() => getImportRows(accountId), [accountId]);
  const { data, setData, reload } = useAsyncData(loadImportRows, [] as ImportRow[]);
  const [duplicateFilter, setDuplicateFilter] = useState<"all" | "duplicates">("all");
  const [importState, setImportState] = useState<"idle" | "uploading" | "saving" | "done" | "failed">("idle");
  const [statementPassword, setStatementPassword] = useState("");
  const [importError, setImportError] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const duplicateKeyForRow = useCallback((row: ImportRow) => `${row.merchant.trim().toLowerCase()}|${row.amount}`, []);
  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data) {
      const key = duplicateKeyForRow(row);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [data, duplicateKeyForRow]);
  const isDuplicateImportRow = useCallback(
    (row: ImportRow) => row.isPossibleDuplicate || (duplicateKeys.get(duplicateKeyForRow(row)) ?? 0) > 1,
    [duplicateKeyForRow, duplicateKeys]
  );
  const visibleRows = useMemo(
    () =>
      duplicateFilter === "duplicates"
        ? data.filter(isDuplicateImportRow)
        : data,
    [data, duplicateFilter, isDuplicateImportRow]
  );
  const categoryForRow = useCallback(
    (row: ImportRow) => (selectedCategories[row.id] ?? row.suggestedCategory ?? "").trim() || "Uncategorized",
    [selectedCategories]
  );
  const setCategoryForRow = useCallback((rowId: string, categoryName: string) => {
    setSelectedCategories((current) => ({ ...current, [rowId]: categoryName.trim() || "Uncategorized" }));
  }, []);
  const approveImportRow = useCallback(async (row: ImportRow) => {
    setImportState("saving");
    await reviewImportRow(accountId, row, "approve", { categoryName: categoryForRow(row) });
    await reload();
    setSelectedCategories((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
    setImportState("done");
  }, [accountId, categoryForRow, reload]);
  const approveImportRows = useCallback(async (rows: ImportRow[]) => {
    if (!rows.length) return;
    setImportState("saving");
    setImportError("");
    try {
      await reviewImportRows(accountId, rows.map((row) => ({ row, categoryName: categoryForRow(row) })), "approve");
      await reload();
      setSelectedCategories((current) => {
        const next = { ...current };
        for (const row of rows) {
          delete next[row.id];
        }
        return next;
      });
      setImportState("done");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to approve import rows.");
      setImportState("failed");
    }
  }, [accountId, categoryForRow, reload]);
  const deleteImportRow = useCallback((row: ImportRow) => {
    requestConfirmation({
      title: "Confirm delete",
      message: `${tx("Delete")} ${row.merchant}?`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        setImportState("saving");
        setImportError("");
        try {
          await reviewImportRow(accountId, row, "delete");
          setData((rows) => rows.filter((candidate) => candidate.id !== row.id));
          setSelectedCategories((current) => {
            const next = { ...current };
            delete next[row.id];
            return next;
          });
          setImportState("done");
        } catch (error) {
          setImportError(error instanceof Error ? error.message : "Unable to delete import rows.");
          setImportState("failed");
        }
      }
    });
  }, [accountId, requestConfirmation, setData, tx]);
  const deleteImportRows = useCallback(async (rows: ImportRow[]) => {
    if (!rows.length) return;
    setImportState("saving");
    setImportError("");
    try {
      await reviewImportRows(accountId, rows.map((row) => ({ row })), "delete");
      await reload();
      setSelectedCategories((current) => {
        const next = { ...current };
        for (const row of rows) {
          delete next[row.id];
        }
        return next;
      });
      setImportState("done");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to delete import rows.");
      setImportState("failed");
    }
  }, [accountId, reload]);

  return (
    <>
      {confirmationDialog}
      <PageHeader
        title={tx("Import review")}
        description="Triage low-confidence rows before posting them into the ledger."
        action={
          <div className="import-upload-form" aria-label={tx("Statement upload controls")}>
            <label>
              {tx("Statement password")}
              <input
                autoComplete="off"
                name="statementPassword"
                placeholder={tx("Optional for locked PDFs")}
                type="password"
                value={statementPassword}
                onChange={(event) => setStatementPassword(event.target.value)}
              />
            </label>
            <label className="file-button">
              {tx("Upload statement")}
              <input
                accept=".csv,.xls,.xlsx,.pdf,.txt"
                type="file"
                onChange={async (event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (!file) return;
                  setImportState("uploading");
                  setImportError("");
                  try {
                    const rows = await uploadStatement(accountId, file, statementPassword);
                    setData(rows);
                    setSelectedCategories({});
                    setImportState("done");
                  } catch (error) {
                    setImportError(error instanceof Error ? error.message : "Statement import failed.");
                    setImportState("failed");
                  } finally {
                    input.value = "";
                    setStatementPassword("");
                  }
                }}
              />
            </label>
          </div>
        }
      />
      {importState === "uploading" ? <p className="loading-note" role="status">{tx("Uploading and parsing statement.")}</p> : null}
      {importState === "failed" ? <p className="error-note" role="alert">{tx(importError || "Statement import failed.")}</p> : null}
      {importState === "done" ? <p className="success-note" role="status">{tx("Statement rows are ready for review.")}</p> : null}
      <Panel
        title="Rows needing attention"
        aside={
          <div className="import-review-panel-actions">
            <div className="segmented-control import-filter-control" aria-label={tx("Import row filter")}>
              <button type="button" className={duplicateFilter === "all" ? "active" : ""} aria-pressed={duplicateFilter === "all"} onClick={() => setDuplicateFilter("all")}>
                {tx("All")}
              </button>
              <button type="button" className={duplicateFilter === "duplicates" ? "active" : ""} aria-pressed={duplicateFilter === "duplicates"} onClick={() => setDuplicateFilter("duplicates")}>
                {tx("Possible duplicates")}
              </button>
            </div>
            <div className="import-bulk-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={importState === "saving" || !data.some((row) => !isDuplicateImportRow(row))}
                onClick={() => void approveImportRows(data.filter((row) => !isDuplicateImportRow(row)))}
              >
                {tx("Approve except duplicates")}
              </button>
              <button
                type="button"
                disabled={importState === "saving" || !data.length}
                onClick={() => void approveImportRows(data)}
              >
                {tx("Approve all")}
              </button>
              <button
                className="danger-button import-delete-all-button"
                type="button"
                disabled={importState === "saving" || !data.length}
                onClick={() => requestConfirmation({
                  title: "Confirm delete",
                  message: tx("Delete all import rows?"),
                  confirmLabel: "Delete all",
                  onConfirm: () => deleteImportRows(data)
                })}
              >
                {tx("Delete all")}
              </button>
            </div>
          </div>
        }
      >
        <div className="table-wrap import-review-table-wrap">
          <table className="import-review-table">
            <colgroup>
              <col className="import-source-col" />
              <col className="import-date-col" />
              <col className="import-description-col" />
              <col className="import-amount-col" />
              <col className="import-category-col" />
              <col className="import-action-col" />
            </colgroup>
            <caption>{tx("Imported transaction review queue")}</caption>
            <thead><tr><th scope="col">{tx("Source")}</th><th scope="col">{tx("Date")}</th><th scope="col">{tx("Description")}</th><th scope="col" className="numeric">{tx("Amount")}</th><th scope="col">{tx("Category")}</th><th scope="col">{tx("Action")}</th></tr></thead>
            <tbody>
              {visibleRows.map((row) => {
                const selectedCategory = categoryForRow(row);
                return (
                  <tr key={row.id}>
                    <td>{row.source}</td>
                    <td>{row.date ?? "-"}</td>
                    <td>{row.merchant}{row.isPossibleDuplicate ? <StatusPill tone="warn">{tx("possible duplicate")}</StatusPill> : null}</td>
                    <td className={`numeric ${importAmountValue(row) >= 0 ? "positive" : "negative"}`}>{signedImportAmount(row)}</td>
                    <td>
                      <select
                        aria-label={`${tx("Category")}: ${row.merchant}`}
                        className="table-select"
                        value={selectedCategory}
                        onChange={(event) => setCategoryForRow(row.id, event.target.value)}
                      >
                        {importCategoriesFor(selectedCategory).map((categoryName) => (
                          <option key={categoryName} value={categoryName}>{tx(categoryName)}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="inline-actions table-actions">
                        <button
                          type="button"
                          disabled={importState === "saving"}
                          onClick={() => void approveImportRow(row)}
                        >
                          {tx("Approve")}
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={importState === "saving"}
                          onClick={() => void deleteImportRow(row)}
                        >
                          {tx("Delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="import-card-list" aria-label={tx("Imported transaction review queue")}>
          {visibleRows.map((row) => {
            const selectedCategory = categoryForRow(row);
            return (
              <article className="import-card" key={row.id}>
                <div className="import-card-main">
                  <div>
                    <h3>{row.merchant}</h3>
                    {row.isPossibleDuplicate ? <StatusPill tone="warn">{tx("possible duplicate")}</StatusPill> : null}
                  </div>
                  <strong className={importAmountValue(row) >= 0 ? "positive" : "negative"}>{signedImportAmount(row)}</strong>
                </div>
                <div className="import-card-actions">
                  <button type="button" disabled={importState === "saving"} onClick={() => void approveImportRow(row)}>{tx("Approve")}</button>
                  <button className="secondary-button" type="button" disabled={importState === "saving"} onClick={() => void deleteImportRow(row)}>{tx("Delete")}</button>
                </div>
                <details className="import-card-details">
                  <summary>{tx("More details")}</summary>
                  <dl>
                    <div><dt>{tx("Source")}</dt><dd>{row.source}</dd></div>
                    <div><dt>{tx("Date")}</dt><dd>{row.date ?? "-"}</dd></div>
                    <div>
                      <dt>{tx("Category")}</dt>
                      <dd>
                        <select
                          aria-label={`${tx("Category")}: ${row.merchant}`}
                          className="table-select"
                          value={selectedCategory}
                          onChange={(event) => setCategoryForRow(row.id, event.target.value)}
                        >
                          {importCategoriesFor(selectedCategory).map((categoryName) => (
                            <option key={categoryName} value={categoryName}>{tx(categoryName)}</option>
                          ))}
                        </select>
                      </dd>
                    </div>
                  </dl>
                </details>
              </article>
            );
          })}
        </div>
        {!visibleRows.length ? <EmptyState title="No rows match this filter" description="Switch back to all rows to continue import review." /> : null}
      </Panel>
    </>
  );
}

export function PartiesView() {
  const { accountId, defaultCurrency, t, tx } = usePreferences();
  const loadParties = useCallback(() => getParties(accountId), [accountId]);
  const { data, setData } = useAsyncData(loadParties, [] as Party[]);
  const [showPartyForm, setShowPartyForm] = useState(false);
  const [partyState, setPartyState] = useState<SubmitState>("idle");
  const [partyActionMessage, setPartyActionMessage] = useState("");
  const partyFormRef = useRef<HTMLFormElement>(null);
  const partyWorkspaceRef = useRef<HTMLDivElement>(null);
  const shouldFocusOpenedPartyRef = useRef(false);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [partyDetail, setPartyDetail] = useState<PartyDetail | null>(null);
  const [stagedSplitExpenseIds, setStagedSplitExpenseIds] = useState<string[]>([]);
  const [detailState, setDetailState] = useState<SubmitState>("idle");
  const [participantState, setParticipantState] = useState<SubmitState>("idle");
  const [expenseState, setExpenseState] = useState<SubmitState>("idle");
  const [stagedSplitState, setStagedSplitState] = useState<SubmitState>("idle");
  const [stagedSplitMessage, setStagedSplitMessage] = useState("");
  const [partyDeleteState, setPartyDeleteState] = useState<SubmitState>("idle");
  const [partyExpenseDeleteState, setPartyExpenseDeleteState] = useState<SubmitState>("idle");
  const [friendQuery, setFriendQuery] = useState("");
  const [friendResults, setFriendResults] = useState<UserSearchResult[]>([]);
  const [searchedFriendQuery, setSearchedFriendQuery] = useState("");
  const [splitMode, setSplitMode] = useState<"even" | "manual" | "percentage" | "shares">("even");
  const [paidByParticipantId, setPaidByParticipantId] = useState("");
  const { requestConfirmation, confirmationDialog } = useConfirmationDialog();

  const participantById = useMemo(() => {
    const participants = new Map<string, PartyParticipant>();
    partyDetail?.participants.forEach((participant) => participants.set(participant.id, participant));
    return participants;
  }, [partyDetail]);
  const expenseById = useMemo(() => {
    const expenseMap = new Map<string, Expense>();
    partyDetail?.expenses.forEach((expense) => expenseMap.set(expense.id, expense));
    return expenseMap;
  }, [partyDetail]);
  const pendingSettlements = useMemo(
    () => partyDetail?.settlements.filter((settlement) => settlement.status === "pending_approval") ?? [],
    [partyDetail]
  );
  const localParticipant = useMemo(
    () => partyDetail?.participants.find((participant) => participant.accountId === accountId),
    [accountId, partyDetail]
  );
  const actionableSplits = useMemo(
    () => partyDetail?.splits.filter((split) => split.status !== "settled") ?? [],
    [partyDetail]
  );
  const settledPartyExpenseIds = useMemo(() => {
    const locked = new Set<string>();
    if (!partyDetail) return locked;
    const settledSplitIds = new Set(partyDetail.settlements.filter((settlement) => settlement.status === "settled").map((settlement) => settlement.splitId));
    for (const split of partyDetail.splits) {
      if (split.status === "settled" || settledSplitIds.has(split.id)) {
        locked.add(split.expenseId);
      }
    }
    return locked;
  }, [partyDetail]);
  const placeholderSearchText = searchedFriendQuery.trim();
  const normalizedPlaceholderSearchText = placeholderSearchText.toLowerCase();
  const participantAlreadyExists = partyDetail?.participants.some((participant) =>
    [participant.displayName, participant.email ?? ""].some((value) => value.trim().toLowerCase() === normalizedPlaceholderSearchText)
  ) ?? false;
  const canAddSearchAsPlaceholder = Boolean(placeholderSearchText) && friendResults.length === 0 && !participantAlreadyExists;
  const hasFriendSearchResults = friendResults.length > 0 || canAddSearchAsPlaceholder;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem("novacent-staged-split-expenses");
    if (!raw) return;
    try {
      const staged = JSON.parse(raw);
      if (Array.isArray(staged)) {
        setStagedSplitExpenseIds(staged.filter((item): item is string => typeof item === "string"));
      }
    } catch {
      window.sessionStorage.removeItem("novacent-staged-split-expenses");
    }
  }, []);

  function focusPartyWorkspaceAfterRender() {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const workspace = partyWorkspaceRef.current;
      workspace?.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstFormField = workspace?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "form input, form select, form textarea"
      );
      const firstField = firstFormField ?? workspace?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
      firstField?.focus({ preventScroll: true });
    });
  }

  function openParty(partyId: string) {
    shouldFocusOpenedPartyRef.current = true;
    setShowPartyForm(false);
    setSelectedPartyId(partyId);
    if (partyId === selectedPartyId && partyDetail) {
      shouldFocusOpenedPartyRef.current = false;
      focusPartyWorkspaceAfterRender();
    }
  }

  function closePartyWorkspace() {
    shouldFocusOpenedPartyRef.current = false;
    setSelectedPartyId("");
    setPartyDetail(null);
    setDetailState("idle");
    setFriendQuery("");
    setSearchedFriendQuery("");
    setFriendResults([]);
  }

  useEffect(() => {
    if (!selectedPartyId) {
      setPartyDetail(null);
      return;
    }

    let mounted = true;
    setDetailState("saving");
    getPartyDetail(accountId, selectedPartyId)
      .then((detail) => {
        if (!mounted) return;
        setPartyDetail(detail);
        setPaidByParticipantId((current) => current || detail.participants[0]?.id || "");
        setDetailState("saved");
        if (shouldFocusOpenedPartyRef.current) {
          shouldFocusOpenedPartyRef.current = false;
          focusPartyWorkspaceAfterRender();
        }
      })
      .catch(() => {
        if (mounted) {
          shouldFocusOpenedPartyRef.current = false;
          setDetailState("failed");
        }
      });

    return () => {
      mounted = false;
    };
  }, [accountId, selectedPartyId]);

  async function onCreateParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPartyState("saving");
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();

    try {
      if (!name) {
        throw new Error("Invalid party");
      }
      const party = await createParty(accountId, { name });
      setData((current) => [party, ...current]);
      formElement.reset();
      setShowPartyForm(false);
      setPartyState("saved");
      openParty(party.id);
    } catch {
      setPartyState("failed");
    }
  }

  async function runFriendSearch() {
    const searchText = friendQuery.trim();
    setSearchedFriendQuery(searchText);
    setParticipantState("saving");
    try {
      const users = searchText.length >= 2 ? await searchUsers(searchText) : [];
      setFriendResults(users);
      setParticipantState("idle");
    } catch {
      setParticipantState("failed");
    }
  }

  async function addParticipant(input: PartyParticipantInput) {
    if (!partyDetail) return;
    setParticipantState("saving");
    try {
      const participants = await addPartyParticipant(accountId, partyDetail.id, input);
      setPartyDetail((current) => (current ? { ...current, participants } : current));
      setData((current) =>
        current.map((party) =>
          party.id === partyDetail.id ? { ...party, members: participants.map((participant) => participant.displayName) } : party
        )
      );
      setFriendQuery("");
      setSearchedFriendQuery("");
      setFriendResults([]);
      setParticipantState("saved");
    } catch {
      setParticipantState("failed");
    }
  }

  async function onCreatePartyExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!partyDetail) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const merchant = String(form.get("merchant") ?? "").trim();
    const categoryName = String(form.get("category") ?? "Food");
    const amount = Number(form.get("amount"));
    const currency = String(form.get("currency") ?? defaultCurrency);
    const spentAt = String(form.get("date") ?? todayInputValue());
    const paidBy = String(form.get("paidBy") ?? paidByParticipantId);
    const participants = partyDetail.participants;
    const debtors = participants.filter((participant) => participant.id !== paidBy);

    try {
      setExpenseState("saving");
      if (!merchant || !paidBy || participants.length < 2 || !Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid party expense");
      }

      let splits: Array<{ participantId: string; amount: number }>;
      if (splitMode === "even") {
        splits = debtors.map((participant) => ({ participantId: participant.id, amount: Number((amount / participants.length).toFixed(2)) }));
      } else if (splitMode === "percentage") {
        const percentages = participants.map((participant) => ({
          participantId: participant.id,
          value: Number(form.get(`split-percent-${participant.id}`) ?? 0)
        }));
        const totalPercent = percentages.reduce((sum, split) => sum + split.value, 0);
        if (Math.abs(totalPercent - 100) > 0.01) {
          throw new Error("Invalid percentage split");
        }
        splits = percentages
          .filter((split) => split.participantId !== paidBy)
          .map((split) => ({ participantId: split.participantId, amount: Number(((amount * split.value) / 100).toFixed(2)) }))
          .filter((split) => Number.isFinite(split.amount) && split.amount > 0);
      } else if (splitMode === "shares") {
        const shares = participants.map((participant) => ({
          participantId: participant.id,
          value: Number(form.get(`split-share-${participant.id}`) ?? 0)
        }));
        const totalShares = shares.reduce((sum, split) => sum + split.value, 0);
        if (totalShares <= 0) {
          throw new Error("Invalid share split");
        }
        splits = shares
          .filter((split) => split.participantId !== paidBy)
          .map((split) => ({ participantId: split.participantId, amount: Number(((amount * split.value) / totalShares).toFixed(2)) }))
          .filter((split) => Number.isFinite(split.amount) && split.amount > 0);
      } else {
        splits = debtors
          .map((participant) => ({ participantId: participant.id, amount: Number(form.get(`split-${participant.id}`) ?? 0) }))
          .filter((split) => Number.isFinite(split.amount) && split.amount > 0);
      }
      const manualTotal = splits.reduce((sum, split) => sum + split.amount, 0);
      if (!splits.length || manualTotal > amount) {
        throw new Error("Invalid split amounts");
      }

      const paidByParticipant = participantById.get(paidBy);
      const result = await createPartyExpense(accountId, partyDetail.id, {
        merchant,
        categoryName,
        amount,
        currency,
        spentAt,
        paidByParticipantId: paidBy,
        excludeFromLedger: paidByParticipant?.accountId !== accountId,
        splits
      });
      setPartyDetail((current) =>
        current
          ? {
              ...current,
              expenses: [result.expense, ...current.expenses],
              splits: [...result.splits, ...current.splits]
            }
          : current
      );
      formElement.reset();
      setSplitMode("even");
      setPaidByParticipantId(participants[0]?.id ?? "");
      setExpenseState("saved");
    } catch {
      setExpenseState("failed");
    }
  }

  async function addStagedExpensesToOpenParty() {
    if (!partyDetail || !stagedSplitExpenseIds.length) return;
    if (partyDetail.participants.length < 2) {
      setStagedSplitState("failed");
      setStagedSplitMessage(tx("Add at least one more participant before adding staged expenses."));
      return;
    }
    setStagedSplitState("saving");
    setStagedSplitMessage("");
    try {
      await addExistingExpensesToParty(accountId, partyDetail.id, stagedSplitExpenseIds);
      const detail = await getPartyDetail(accountId, partyDetail.id);
      setPartyDetail(detail);
      setStagedSplitExpenseIds([]);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("novacent-staged-split-expenses");
      }
      setStagedSplitState("saved");
      setStagedSplitMessage(tx("Selected expenses added to the party split."));
      setPartyActionMessage(tx("Selected expenses added to the party split."));
    } catch (error) {
      setStagedSplitState("failed");
      setStagedSplitMessage(error instanceof Error ? error.message : tx("Unable to add selected expenses. Add at least two participants to the party first."));
    }
  }

  async function markSplitSettled(split: PartySplit) {
    if (!partyDetail) return;
    const participant = participantById.get(split.participantId);
    if (!participant) return;

    setPartyActionMessage("");
    try {
      const settlement = await markPartySplitSettled(accountId, partyDetail.id, split, participant.kind);
      setPartyDetail((current) =>
        current
          ? {
              ...current,
              splits: current.splits.map((candidate) =>
                candidate.id === split.id ? { ...candidate, status: settlement.status === "settled" ? "settled" : "settlement_pending" } : candidate
              ),
              settlements: [settlement, ...current.settlements]
            }
          : current
      );
      setPartyActionMessage(settlement.status === "settled" ? tx("External placeholder settled directly.") : tx("Settlement approval request created."));
    } catch {
      setPartyActionMessage(tx("Unable to mark this split as settled."));
    }
  }

  async function reviewSettlement(settlement: PartySettlement, action: "approve" | "reject") {
    if (!partyDetail) return;
    try {
      const result = await approvePartySettlement(accountId, partyDetail.id, settlement.id, action);
      setPartyDetail((current) =>
        current
          ? {
              ...current,
              settlements: current.settlements.map((candidate) =>
                candidate.id === settlement.id ? { ...candidate, status: result.status === "settled" ? "settled" : "rejected" } : candidate
              ),
              splits: current.splits.map((split) =>
                split.id === settlement.splitId ? { ...split, status: action === "approve" ? "settled" : "open" } : split
              )
            }
          : current
      );
      setPartyActionMessage(action === "approve" ? tx("Settlement approved.") : tx("Settlement rejected."));
    } catch {
      setPartyActionMessage(tx("Unable to review settlement."));
    }
  }

  function onDeleteSelectedParty() {
    if (!partyDetail) return;
    const partyToDelete = partyDetail;
    requestConfirmation({
      title: "Confirm delete",
      message: `${tx("Delete")} ${partyToDelete.name} ${tx("and all unlocked party expenses?")}`,
      confirmLabel: "Delete party",
      onConfirm: async () => {
        setPartyDeleteState("saving");
        try {
          await deleteParty(accountId, partyToDelete.id);
          setData((current) => current.filter((party) => party.id !== partyToDelete.id));
          setSelectedPartyId("");
          setPartyDetail(null);
          setPartyDeleteState("saved");
        } catch {
          setPartyDeleteState("failed");
        }
      }
    });
  }

  function onDeletePartyExpense(expense: Expense) {
    if (!partyDetail) return;
    const partyId = partyDetail.id;
    requestConfirmation({
      title: "Confirm delete",
      message: `${tx("Delete")} ${expense.merchant} ${tx("from this party and the overall expense ledger?")}`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        setPartyExpenseDeleteState("saving");
        try {
          await deletePartyExpense(accountId, partyId, expense.id);
          setPartyDetail((current) => {
            if (!current) return current;
            const removedSplitIds = current.splits.filter((split) => split.expenseId === expense.id).map((split) => split.id);
            return {
              ...current,
              expenses: current.expenses.filter((candidate) => candidate.id !== expense.id),
              splits: current.splits.filter((split) => split.expenseId !== expense.id),
              settlements: current.settlements.filter((settlement) => !removedSplitIds.includes(settlement.splitId))
            };
          });
          setPartyExpenseDeleteState("saved");
        } catch {
          setPartyExpenseDeleteState("failed");
        }
      }
    });
  }

  return (
    <>
      {confirmationDialog}
      <PageHeader
        title={t("parties")}
        description="Track shared expenses, external participants, and settlements that need approval."
        action={
          selectedPartyId ? (
            <button className="secondary-button" type="button" onClick={closePartyWorkspace}>
              {tx("Back to parties")}
            </button>
          ) : (
            <button
              type="button"
              aria-expanded={showPartyForm}
              onClick={() => {
                setShowPartyForm(true);
                focusFormAfterRender(() => partyFormRef.current);
              }}
            >
              {tx("Create party")}
            </button>
          )
        }
      />
      {partyActionMessage ? <p className="success-note" role="status">{partyActionMessage}</p> : null}
      {partyDeleteState === "saved" ? <p className="success-note" role="status">{tx("Party deleted.")}</p> : null}
      {partyDeleteState === "failed" ? <p className="error-note" role="alert">{tx("Unable to delete party. Parties with settled expenses are locked.")}</p> : null}
      {!selectedPartyId ? (
        <>
          {showPartyForm ? (
            <Panel title="Create party">
              <form ref={partyFormRef} className="form-grid" onSubmit={onCreateParty}>
                <label>{tx("Party name")}<input name="name" placeholder={tx("Weekend friends")} required /></label>
                <button className="form-submit" type="submit" disabled={partyState === "saving"}>{partyState === "saving" ? tx("Saving") : tx("Save party")}</button>
              </form>
              {partyState === "failed" ? <p className="error-note" role="alert">{tx("Unable to save party.")}</p> : null}
            </Panel>
          ) : null}
          {partyState === "saved" ? <p className="success-note" role="status">{tx("Party saved.")}</p> : null}
          <Panel title="Group balances">
            <div className="card-list">
              {data.map((party) => (
                <button
                  className="party-card-button"
                  type="button"
                  key={party.id}
                  onClick={() => openParty(party.id)}
                >
                  <h3>{party.name}</h3>
                  <p>{party.members.join(", ")}</p>
                  <strong className={signedAmountClass(party.balance)}>{formatSignedAmount(party.balance, party.balanceCurrency ?? defaultCurrency)}</strong>
                  <span>{tx("Open party")}</span>
                </button>
              ))}
            </div>
            {!data.length ? <EmptyState title="No parties yet" description="Create a party to track shared expenses and settlements." /> : null}
          </Panel>
        </>
      ) : null}
      {selectedPartyId && detailState === "saving" ? <LoadingNote label="Loading party workspace" /> : null}
      {selectedPartyId && detailState === "failed" ? <p className="error-note" role="alert">{tx("Unable to load party details.")}</p> : null}
      {selectedPartyId && partyDetail ? (
        <Panel
          title={`${partyDetail.name} ${tx("workspace")}`}
          aside={
            partyDetail.canManage ? (
              <button className="danger-button" type="button" onClick={() => void onDeleteSelectedParty()}>
                {tx("Delete party")}
              </button>
            ) : null
          }
        >
          <div className="party-workspace" ref={partyWorkspaceRef}>
            <section className="party-section" aria-label={tx("Party participants")}>
              <h3>{tx("Participants")}</h3>
              <div className="participant-list">
                {partyDetail.participants.map((participant) => (
                  <span className="participant-chip" key={participant.id}>
                    {participant.displayName}
                    <small>{participant.kind === "registered" ? tx("registered") : tx("placeholder")}</small>
                  </span>
                ))}
              </div>
              <div className="split-controls">
                <label className="wide-field">{tx("Search friend")}<input value={friendQuery} onChange={(event) => {
                  setFriendQuery(event.target.value);
                  setSearchedFriendQuery("");
                  setFriendResults([]);
                }} placeholder={tx("Name or email")} /></label>
                <button type="button" onClick={runFriendSearch} disabled={participantState === "saving"}>{tx("Search")}</button>
              </div>
              {hasFriendSearchResults ? (
                <div className="result-list">
                  {friendResults.map((user) => (
                    <button
                      className="secondary-button"
                      type="button"
                      key={user.id}
                      onClick={() => addParticipant({ kind: "registered", displayName: user.name, userId: user.id, accountId: user.defaultAccountId })}
                    >
                      {tx("Add")} {user.name}
                    </button>
                  ))}
                  {canAddSearchAsPlaceholder ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void addParticipant({ kind: "external", displayName: placeholderSearchText })}
                    >
                      {tx("Add")} {placeholderSearchText} {tx("as non-registered person")}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {participantState === "saved" ? <p className="success-note" role="status">{tx("Participant list updated.")}</p> : null}
              {participantState === "failed" ? <p className="error-note" role="alert">{tx("Unable to update participant list.")}</p> : null}
            </section>

            <section className="party-section" aria-label={tx("Add party expense")}>
              <h3>{tx("Add party expense")}</h3>
              {stagedSplitExpenseIds.length ? (
                <div className="staged-split-callout">
                  <div>
                    <p>{tx("You have selected expenses waiting to be added to this party split.")}</p>
                    {partyDetail.participants.length < 2 ? <p className="muted-note">{tx("Add at least one more participant before adding staged expenses.")}</p> : null}
                    {stagedSplitState === "failed" && stagedSplitMessage ? <p className="error-note" role="alert">{tx(stagedSplitMessage)}</p> : null}
                    {stagedSplitState === "saved" && stagedSplitMessage ? <p className="success-note" role="status">{tx(stagedSplitMessage)}</p> : null}
                  </div>
                  <button type="button" disabled={partyDetail.participants.length < 2 || stagedSplitState === "saving"} onClick={() => void addStagedExpensesToOpenParty()}>
                    {stagedSplitState === "saving" ? tx("Saving") : tx("Add staged expenses")}
                  </button>
                </div>
              ) : null}
              <form className="form-grid" onSubmit={onCreatePartyExpense}>
                <label>{tx("Merchant")}<input name="merchant" required /></label>
                <label>{tx("Category")}<select name="category"><CategoryOptions /></select></label>
                <label>{tx("Amount")}<input name="amount" type="number" min="0.01" step="0.01" required /></label>
                <label>{tx("Currency")}<select name="currency" defaultValue={defaultCurrency}><CurrencyOptions /></select></label>
                <DateField label="Date" name="date" defaultValue={todayInputValue()} required />
                <label>{tx("Paid by")}<select name="paidBy" value={paidByParticipantId} onChange={(event) => setPaidByParticipantId(event.target.value)} required>{partyDetail.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.displayName}</option>)}</select></label>
                <label>{tx("Split mode")}<select value={splitMode} onChange={(event) => setSplitMode(event.target.value as "even" | "manual" | "percentage" | "shares")}><option value="even">{tx("Even split")}</option><option value="manual">{tx("Manual amounts")}</option><option value="percentage">{tx("Percentages")}</option><option value="shares">{tx("Shares")}</option></select></label>
                {splitMode === "manual"
                  ? partyDetail.participants
                      .filter((participant) => participant.id !== paidByParticipantId)
                      .map((participant) => (
                        <label key={participant.id}>{participant.displayName} {tx("owes")}<input name={`split-${participant.id}`} type="number" min="0" step="0.01" /></label>
                      ))
                  : null}
                {splitMode === "percentage"
                  ? partyDetail.participants.map((participant) => (
                      <label key={participant.id}>{participant.displayName} %<input name={`split-percent-${participant.id}`} type="number" min="0" max="100" step="0.01" defaultValue={Number((100 / partyDetail.participants.length).toFixed(2))} /></label>
                    ))
                  : null}
                {splitMode === "shares"
                  ? partyDetail.participants.map((participant) => (
                      <label key={participant.id}>{participant.displayName} {tx("shares")}<input name={`split-share-${participant.id}`} type="number" min="0" step="1" defaultValue={1} /></label>
                    ))
                  : null}
                <button className="form-submit" type="submit" disabled={expenseState === "saving"}>{expenseState === "saving" ? tx("Saving") : tx("Save party expense")}</button>
              </form>
              {expenseState === "saved" ? <p className="success-note" role="status">{tx("Party expense and splits saved.")}</p> : null}
              {expenseState === "failed" ? <p className="error-note" role="alert">{tx("Unable to save party expense or splits.")}</p> : null}
            </section>

            <section className="party-section" aria-label={tx("Party expenses")}>
              <h3>{tx("Party expenses")}</h3>
              {partyExpenseDeleteState === "saved" ? <p className="success-note" role="status">{tx("Party expense deleted.")}</p> : null}
              {partyExpenseDeleteState === "failed" ? <p className="error-note" role="alert">{tx("Unable to delete party expense. Settled party expenses are locked.")}</p> : null}
              <div className="table-wrap">
                <table>
                  <caption>{tx("Party expenses that feed the split ledger")}</caption>
                  <thead><tr><th scope="col">{tx("Date")}</th><th scope="col">{tx("Merchant")}</th><th scope="col">{tx("Category")}</th><th scope="col" className="numeric">{tx("Amount")}</th><th scope="col">{tx("Action")}</th></tr></thead>
                  <tbody>
                    {partyDetail.expenses.map((expense) => {
                      const locked = settledPartyExpenseIds.has(expense.id);
                      return (
                        <tr key={expense.id}>
                          <td>{expense.date}</td>
                          <td>{expense.merchant}</td>
                          <td>{tx(expense.category)}</td>
                          <td className={`numeric ${moneyFlowClass(expense.amount)}`}>{formatMoneyFlow(expense.amount, expense.currency ?? "INR")}</td>
                          <td>
                            {partyDetail.canManage && !locked ? (
                              <button className="danger-button" type="button" onClick={() => void onDeletePartyExpense(expense)}>{tx("Delete")}</button>
                            ) : (
                              <span className="muted-note">{locked ? tx("Settled") : tx("Admin only")}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!partyDetail.expenses.length ? <EmptyState title="No party expenses yet" description="Add a party expense to start tracking splits." /> : null}
            </section>

            <section className="party-section" aria-label={tx("Party settlement actions")}>
              <h3>{tx("Splits and settlements")}</h3>
              <div className="table-wrap">
                <table>
                  <caption>{tx("Party split ledger")}</caption>
                  <thead><tr><th scope="col">{tx("Expense")}</th><th scope="col">{tx("Paid by")}</th><th scope="col">{tx("Owed by")}</th><th scope="col" className="numeric">{tx("Amount")}</th><th scope="col">{tx("Status")}</th><th scope="col">{tx("Action")}</th></tr></thead>
                  <tbody>
                    {actionableSplits.map((split) => {
                      const participant = participantById.get(split.participantId);
                      const payer = split.paidByParticipantId ? participantById.get(split.paidByParticipantId) : undefined;
                      const expense = expenseById.get(split.expenseId);
                      const canMarkSettled = split.status === "open" && (split.participantId === localParticipant?.id || participant?.kind === "external");
                      return (
                        <tr key={split.id}>
                          <td>{expense?.merchant ?? tx("Party expense")}</td>
                          <td>{payer?.displayName ?? tx("Unknown")}</td>
                          <td>{participant?.displayName ?? tx("Participant")}</td>
                          <td className="numeric negative">{formatOutflowAmount(split.amount, split.currency)}</td>
                          <td><StatusPill tone={split.status === "open" ? "warn" : "good"}>{split.status === "open" ? tx("open") : tx("approval pending")}</StatusPill></td>
                          <td>
                            {canMarkSettled ? <button type="button" onClick={() => void markSplitSettled(split)}>{tx("Mark settled")}</button> : <span className="muted-note">{split.status === "open" ? `${tx("Waiting for")} ${participant?.displayName ?? tx("Participant")}` : tx("Waiting approval")}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!actionableSplits.length ? <EmptyState title="No open splits" description="Add a party expense to generate split settlement actions." /> : null}
              {pendingSettlements.length ? (
                <div className="stack">
                  <h3>{tx("Approval requests")}</h3>
                  {pendingSettlements.map((settlement) => {
                    const participant = participantById.get(settlement.participantId);
                    const approvalParticipant = settlement.approvalParticipantId ? participantById.get(settlement.approvalParticipantId) : undefined;
                    const canReviewLocally = !settlement.approvalParticipantId || approvalParticipant?.id === localParticipant?.id;
                    return (
                      <article className="detail-card" key={settlement.id}>
                        <h3>{participant?.displayName ?? tx("Participant")} {tx("marked settled")}</h3>
                        <p><span className="positive">{formatInflowAmount(settlement.amount, settlement.currency)}</span> {tx("needs approval from")} {approvalParticipant?.displayName ?? tx("the payer")} {tx("before the split closes.")}</p>
                        {canReviewLocally ? (
                          <div className="inline-actions">
                            <button type="button" onClick={() => void reviewSettlement(settlement, "approve")}>{tx("Approve")}</button>
                            <button className="secondary-button" type="button" onClick={() => void reviewSettlement(settlement, "reject")}>{tx("Reject")}</button>
                          </div>
                        ) : (
                          <p className="muted-note">{tx("Waiting for")} {approvalParticipant?.displayName ?? tx("the payer")} {tx("to review.")}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

export function ReportsView() {
  const { accountId, defaultCurrency, t, tx } = usePreferences();
  const [reportRange, setReportRange] = useState(() => reportRangeForPreset("1y"));
  const loadReports = useCallback(
    () => getReports(accountId, { startDate: reportRange.startDate, endDate: reportRange.endDate }, defaultCurrency),
    [accountId, defaultCurrency, reportRange.endDate, reportRange.startDate]
  );
  const { data, loading, error } = useAsyncData(loadReports, emptyReportData);
  const hasReportData = data.categories.length || data.cashflow.length || data.budgetVariance.length || data.merchantTrends.length || data.parties.length || data.currencies.length;
  return (
    <>
      <PageHeader
        title={t("reports")}
        description="NovaCent reporting for category mix, cash flow, budget variance, merchants, parties, and currencies."
        action={
          <div className="inline-actions report-export-actions">
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([reportDataToCsv(data)], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "novacent-report.csv";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              {tx("Export CSV")}
            </button>
            <button className="secondary-button" type="button" onClick={() => window.print()}>
              {tx("Export PDF")}
            </button>
          </div>
        }
      />
      <section className="report-filter-bar" aria-label={tx("Report timeframe")}>
        <div>
          <p className="filter-label">{tx("Report timeframe")}</p>
          <div className="segmented-control report-range-presets">
            {reportRangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={reportRange.preset === option.value ? "active" : ""}
                aria-pressed={reportRange.preset === option.value}
                onClick={() => setReportRange(reportRangeForPreset(option.value))}
              >
                {tx(option.label)}
              </button>
            ))}
          </div>
          <select
            className="report-range-select"
            aria-label={tx("Report timeframe")}
            value={reportRange.preset}
            onChange={(event) => {
              const preset = event.target.value as ReportRangePreset;
              if (preset === "custom") return;
              setReportRange(reportRangeForPreset(preset));
            }}
          >
            {reportRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>{tx(option.label)}</option>
            ))}
            {reportRange.preset === "custom" ? <option value="custom">{tx("Custom range")}</option> : null}
          </select>
        </div>
        <div className="report-date-range" aria-label={tx("Date range")}>
          <DateField label="From" value={reportRange.startDate ?? ""} onChange={(date) => setReportRange((current) => ({ ...current, preset: "custom", startDate: date }))} />
          <DateField label="To" value={reportRange.endDate ?? ""} onChange={(date) => setReportRange((current) => ({ ...current, preset: "custom", endDate: date }))} />
        </div>
      </section>
      {loading ? <ChartSkeleton label="Loading NovaCent report charts" /> : null}
      {error ? <p className="error-note" role="alert">{tx(error)}</p> : null}
      {!loading && !error && !hasReportData ? <EmptyState title="No report data for this timeframe" description="Try All or a wider date range to include more transactions." /> : null}
      <section className="report-summary" aria-label={tx("Report summary metrics")}>
        <MetricCard label="Tracked spend" value={formatCurrency(data.categories.reduce((sum, row) => sum + row.value, 0), defaultCurrency)} detail="Across active report categories" />
        <MetricCard label="Cash retained" value={formatCurrency(data.cashflow.reduce((sum, row) => sum + row.income - row.spend, 0), defaultCurrency)} detail="Income minus spend in visible months" />
        <MetricCard label="Largest budget usage" value={`${Math.max(...data.budgetVariance.map((row) => row.usage), 0)}%`} detail="Highest active category utilization" />
        <MetricCard label="Currencies" value={String(data.currencies.length)} detail="Original spend currencies represented" />
      </section>
      <div className="report-grid">
        <Panel title="Spend by category">
          <CategoryBreakdownChart data={data.categories} />
          <div className="simple-summary" aria-label={tx("Simple category bar summary")}>
            <BarList title="Spend by category" rows={data.categories} />
          </div>
        </Panel>
        <Panel title="Cash flow trend">
          <CashFlowTrendChart data={data.cashflow} />
        </Panel>
        <Panel title="Budget variance">
          <BudgetVarianceChart data={data.budgetVariance} />
        </Panel>
        <Panel title="Merchant trends">
          <MerchantTrendsChart data={data.merchantTrends} />
        </Panel>
        <Panel title="Parties and currencies">
          <div className="split-visuals">
            <PartySummaryChart data={data.parties} />
            <SummaryBarsChart data={data.currencies} title="Currency exposure" label="Spend by original currency chart" />
          </div>
        </Panel>
      </div>
    </>
  );
}

function SupportForm() {
  const { accountId, tx } = usePreferences();
  const [supportState, setSupportState] = useState<SubmitState>("idle");

  async function onSubmitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input: SupportRequestInput = {
      name: String(form.get("supportName") ?? "").trim(),
      type: String(form.get("supportType") ?? "report_issue") as SupportRequestInput["type"],
      comments: String(form.get("supportComments") ?? "").trim()
    };

    try {
      setSupportState("saving");
      await submitSupportRequest(accountId, input);
      formElement.reset();
      setSupportState("saved");
    } catch {
      setSupportState("failed");
    }
  }

  return (
    <Panel title="Customer support">
      <form className="support-form" onSubmit={onSubmitSupport}>
        <label>{tx("Name")}<input name="supportName" autoComplete="name" required /></label>
        <label>{tx("Request type")}<select name="supportType" defaultValue="report_issue"><option value="add_feature">{tx("Add feature")}</option><option value="report_issue">{tx("Report issue")}</option><option value="praise">{tx("Praise")}</option></select></label>
        <label className="wide-field">{tx("Comments")}<textarea name="supportComments" rows={4} required /></label>
        <button className="form-submit" type="submit" disabled={supportState === "saving"}>{supportState === "saving" ? tx("Saving") : tx("Send support request")}</button>
      </form>
      {supportState === "saved" ? <p className="success-note" role="status">{tx("Support request saved.")}</p> : null}
      {supportState === "failed" ? <p className="error-note" role="alert">{tx("Unable to save support request.")}</p> : null}
    </Panel>
  );
}

export function SupportView() {
  const { t } = usePreferences();
  return (
    <>
      <PageHeader title={t("support")} description="Send feature requests, issue reports, or praise to the NovaCent team." />
      <SupportForm />
    </>
  );
}

export function HowToUseView() {
  const { language } = usePreferences();
  const content = guideContent[language];
  return (
    <>
      <PageHeader
        title={content.pageTitle}
        description={content.pageDescription}
        action={<Link className="secondary-button guide-header-link" href="/settings">{content.backToSettings}</Link>}
      />
      <Panel title={content.quickStartTitle}>
        <div className="guide-quick-start" aria-label={content.quickStartAria}>
          {content.quickStart.map((item, index) => (
            <article key={item.title}>
              <strong>{index + 1}</strong>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </Panel>
      <section className="guide-grid" aria-label={content.sectionsAria}>
        {content.sections.map((section) => (
          <article className="guide-card" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
        ))}
      </section>
    </>
  );
}

export function SettingsView() {
  const { accountId, setAccountId, defaultCurrency, setDefaultCurrency, theme, setTheme, language, setLanguage, t, tx } = usePreferences();
  const howToUseContent = guideContent[language];
  const { data: accountOptions } = useAsyncData(getAccounts, [] as Account[]);
  const [saveState, setSaveState] = useState<SubmitState>("idle");

  return (
    <>
      <PageHeader title={t("settings")} description="Workspace preferences, sync posture, and localization readiness." />
      <Panel title="Preferences">
        <form
          className="form-grid preferences-form"
          onSubmit={(event) => {
            event.preventDefault();
            setSaveState("saved");
          }}
        >
          <label>{t("account")}<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accountOptions.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label>{t("theme")}<select value={theme} onChange={(event) => setTheme(event.target.value as "light" | "dark")}><option value="light">{t("light")}</option><option value="dark">{t("dark")}</option></select></label>
          <label>{t("language")}<select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>{Object.entries(languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <label>{tx("Default currency")}<select value={defaultCurrency} onChange={(event) => setDefaultCurrency(event.target.value as typeof defaultCurrency)}><CurrencyOptions /></select></label>
          <div className="preferences-actions">
            <p className="muted-note">{tx("This is used for new entries. Existing expenses keep the currency they were saved with.")}</p>
            <button className="form-submit" type="submit">{t("save")}</button>
          </div>
        </form>
        {saveState === "saved" ? <p className="success-note" role="status">{tx("Preferences saved on this device.")}</p> : null}
      </Panel>
      <Panel title="Help and guidance">
        <div className="settings-link-card">
          <div>
            <h3>{howToUseContent.pageTitle}</h3>
            <p>{howToUseContent.settingsDescription}</p>
          </div>
          <Link className="secondary-button" href="/how-to-use">{howToUseContent.openGuide}</Link>
        </div>
      </Panel>
      <Panel title="Offline readiness">
        <ul className="check-list">
          <li>{tx("Local preferences persist in browser storage.")}</li>
          <li>{tx("Live APIs are used by default; set NEXT_PUBLIC_USE_MOCKS=true for demo data.")}</li>
          <li>{tx("Legacy app-shell caches are cleared in live mode so old demo screens do not keep rendering after refresh.")}</li>
          <li>{tx("Offline banner reacts to browser connectivity events.")}</li>
        </ul>
      </Panel>
    </>
  );
}
