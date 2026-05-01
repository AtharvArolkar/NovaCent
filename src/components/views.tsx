"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addPartyParticipant, approvePartySettlement, createBudget, createExpense, createParty, createPartyExpense, deleteBudget, deleteExpense, deleteParty, deletePartyExpense, getAccounts, getBudgets, getExpenses, getImportRows, getOverview, getParties, getPartyDetail, getReports, markPartySplitSettled, reportDataToCsv, reviewImportRow, searchUsers, syncPendingOutbox, updateBudget, uploadStatement } from "@/lib/client/expense-service";
import type { PartyDetail, PartyParticipant, PartyParticipantInput, PartySettlement, PartySplit, UserSearchResult } from "@/lib/client/expense-service";
import type { Account, Budget, Expense, ImportRow, Party } from "@/lib/client/demo-data";
import { languages, type Language } from "@/lib/client/dictionary";
import type { ReportingChartData } from "@/lib/reporting";
import { usePreferences } from "@/lib/client/preferences";
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

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

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

type SubmitState = "idle" | "saving" | "saved" | "failed";

function confirmDelete(message: string) {
  return typeof window !== "undefined" && window.confirm(message);
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

function ExpenseTable({ rows, onDelete }: { rows: Expense[]; onDelete?: (expense: Expense) => void }) {
  const { tx } = usePreferences();
  if (!rows.length) return <EmptyState title="No expenses yet" description="New spending will appear here once imported or added." />;
  const showActions = Boolean(onDelete);
  return (
    <div className="table-wrap">
      <table>
        <caption>{tx("Expense ledger with merchant, category, owner, amount, and status")}</caption>
        <thead>
          <tr>
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
          {rows.map((expense) => (
            <tr key={expense.id}>
              <td>{expense.date}</td>
              <td>{expense.merchant}</td>
              <td>{tx(expense.category)}</td>
              <td>{expense.owner}</td>
              <td className="numeric">{money.format(expense.amount)}</td>
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
          ))}
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
        const percent = Math.round((budget.spent / budget.limit) * 100);
        return (
          <article className="budget-row" key={budget.id}>
            <div>
              <h3>{tx(budget.category)}</h3>
              <p>{money.format(budget.spent)} {tx("of")} {money.format(budget.limit)}</p>
            </div>
            <ProgressBar label={`${tx(budget.category)} ${tx("spend")}`} value={percent} />
          </article>
        );
      })}
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const { tx } = usePreferences();
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="chart-alt" role="img" aria-label={`${tx(title)} ${tx("bar chart")}. ${rows.map((row) => `${tx(row.label)}: ${money.format(row.value)}`).join(", ")}`}>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>{tx(row.label)}</span>
          <div><i style={{ width: `${(row.value / max) * 100}%` }} /></div>
          <b>{money.format(row.value)}</b>
        </div>
      ))}
    </div>
  );
}

export function DashboardView() {
  const { accountId, t, tx } = usePreferences();
  const loadOverview = useCallback(() => getOverview(accountId), [accountId]);
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
        <MetricCard label={t("totalSpend")} value={money.format(data.totalSpend)} detail="Across visible transactions this month" />
        <MetricCard label={t("remainingBudget")} value={money.format(data.remainingBudget)} detail="Available across active envelopes" />
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
  const { accountId, t, tx } = usePreferences();
  const loadExpenses = useCallback(() => getExpenses(accountId), [accountId]);
  const { data, setData, error } = useAsyncData(loadExpenses, []);
  const [query, setQuery] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [deleteState, setDeleteState] = useState<SubmitState>("idle");
  const quickAddRef = useRef<HTMLFormElement>(null);
  const filtered = useMemo(
    () => data.filter((expense) => `${expense.merchant} ${expense.category} ${expense.owner}`.toLowerCase().includes(query.toLowerCase())),
    [data, query]
  );

  async function onQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitState("saving");
    const form = new FormData(formElement);
    const merchant = String(form.get("merchant") ?? "").trim();
    const categoryName = String(form.get("category") ?? "Uncategorized");
    const amount = Number(form.get("amount"));
    const spentAt = String(form.get("date") ?? new Date().toISOString().slice(0, 10));
    const currency = String(form.get("currency") ?? "INR");

    try {
      const expense = await createExpense(accountId, { merchant, categoryName, amount, currency, spentAt });
      setData((rows) => [expense, ...rows]);
      formElement.reset();
      setSubmitState("saved");
    } catch {
      setSubmitState("failed");
    }
  }

  async function onDeleteExpense(expense: Expense) {
    if (!confirmDelete(`${tx("Delete")} ${expense.merchant} ${tx("from expenses? This cannot be undone.")}`)) return;
    setDeleteState("saving");
    try {
      await deleteExpense(accountId, expense.id);
      setData((rows) => rows.filter((row) => row.id !== expense.id));
      setDeleteState("saved");
    } catch {
      setDeleteState("failed");
    }
  }

  return (
    <>
      <PageHeader
        title={t("expenses")}
        description="Search, add, and review every transaction before it hits reports."
        action={
          <button
            type="button"
            onClick={() => {
              focusFirstFormField(quickAddRef.current);
            }}
          >
            {t("addExpense")}
          </button>
        }
      />
      {error ? <p className="error-note" role="alert">{tx(error)}</p> : null}
      {deleteState === "saved" ? <p className="success-note" role="status">{tx("Expense deleted.")}</p> : null}
      {deleteState === "failed" ? <p className="error-note" role="alert">{tx("Unable to delete expense. Settled party expenses and settlement rows are locked.")}</p> : null}
      <Panel title="Quick add">
        <form ref={quickAddRef} className="form-grid" onSubmit={onQuickAdd}>
          <label>{tx("Merchant")}<input name="merchant" required /></label>
          <label>{tx("Category")}<select name="category"><option value="Food">{tx("Food")}</option><option value="Shopping">{tx("Shopping")}</option><option value="Travel">{tx("Travel")}</option><option value="Subscriptions">{tx("Subscriptions")}</option><option value="Health">{tx("Health")}</option></select></label>
          <label>{tx("Amount")}<input name="amount" type="number" min="0" step="0.01" required /></label>
          <label>{tx("Currency")}<select name="currency"><option>INR</option><option>USD</option><option>EUR</option><option>AED</option></select></label>
          <label>{tx("Date")}<input name="date" type="date" defaultValue={todayInputValue()} required /></label>
          <button className="form-submit" type="submit" disabled={submitState === "saving"}>{submitState === "saving" ? tx("Saving") : t("save")}</button>
        </form>
        {submitState === "saved" ? <p className="success-note" role="status">{tx("Expense saved or queued for sync.")}</p> : null}
        {submitState === "failed" ? <p className="error-note" role="alert">{tx("Unable to save expense.")}</p> : null}
      </Panel>
      <Panel title="Expense ledger" aside={<label className="search-box"><span>{t("search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx("Merchant, category, owner")} /></label>}>
        <ExpenseTable rows={filtered} onDelete={onDeleteExpense} />
      </Panel>
    </>
  );
}

export function BudgetsView() {
  const { accountId, t, tx } = usePreferences();
  const loadBudgets = useCallback(() => getBudgets(accountId), [accountId]);
  const { data, setData } = useAsyncData(loadBudgets, [] as Budget[]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetState, setBudgetState] = useState<SubmitState>("idle");
  const [budgetDeleteState, setBudgetDeleteState] = useState<SubmitState>("idle");
  const budgetFormRef = useRef<HTMLFormElement>(null);

  async function onCreateBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBudgetState("saving");
    const form = new FormData(formElement);
    const categoryName = String(form.get("categoryName") ?? "").trim();
    const scope = String(form.get("scope") ?? "overall") as "overall" | "category";
    const limit = Number(form.get("limit"));
    const currency = String(form.get("currency") ?? "INR");
    const period = String(form.get("period") ?? "monthly") as "monthly" | "yearly";
    const alertThreshold = Number(form.get("alertThreshold") || 80);

    try {
      if (!categoryName || !Number.isFinite(limit) || limit <= 0) {
        throw new Error("Invalid budget");
      }
      const budgetInput = { categoryName, scope, limit, currency, period, alertThreshold };
      const budget = editingBudget
        ? await updateBudget(accountId, editingBudget.id, budgetInput)
        : await createBudget(accountId, budgetInput);
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

  async function onDeleteBudget(budget: Budget) {
    if (!confirmDelete(`${tx("Delete")} ${tx(budget.category)} ${tx("budget?")}`)) return;
    setBudgetDeleteState("saving");
    try {
      await deleteBudget(accountId, budget.id);
      setData((rows) => rows.filter((row) => row.id !== budget.id));
      setBudgetDeleteState("saved");
    } catch {
      setBudgetDeleteState("failed");
    }
  }

  return (
    <>
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
            <label>{tx("Currency")}<select name="currency" defaultValue={editingBudget?.currency ?? "INR"}><option>INR</option><option>USD</option><option>EUR</option><option>AED</option></select></label>
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
            const percent = Math.round((budget.spent / budget.limit) * 100);
            const period = budget.period ?? "monthly";
            return (
              <article className="budget-row managed-row" key={budget.id}>
                <div>
                  <h3>{tx(budget.category)}</h3>
                  <p>{budget.scope === "overall" ? tx("Overall spend") : tx("Single category")}</p>
                  <p>{money.format(budget.spent)} {tx("of")} {money.format(budget.limit)} {period === "yearly" ? tx("this year") : tx("this month")}</p>
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
              </article>
            );
          })}
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
  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data) {
      const key = `${row.merchant.trim().toLowerCase()}|${row.amount}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [data]);
  const visibleRows = useMemo(
    () =>
      duplicateFilter === "duplicates"
        ? data.filter((row) => row.isPossibleDuplicate || (duplicateKeys.get(`${row.merchant.trim().toLowerCase()}|${row.amount}`) ?? 0) > 1)
        : data,
    [data, duplicateFilter, duplicateKeys]
  );

  return (
    <>
      <PageHeader
        title={tx("Import review")}
        description="Triage low-confidence rows before posting them into the ledger."
        action={
          <label className="file-button">
            {tx("Upload statement")}
            <input
              accept=".csv,.xls,.xlsx,.pdf,.txt"
              type="file"
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                setImportState("uploading");
                try {
                  const rows = await uploadStatement(accountId, file);
                  setData(rows);
                  setImportState("done");
                } catch {
                  setImportState("failed");
                } finally {
                  event.currentTarget.value = "";
                }
              }}
            />
          </label>
        }
      />
      {importState === "uploading" ? <p className="loading-note" role="status">{tx("Uploading and parsing statement.")}</p> : null}
      {importState === "failed" ? <p className="error-note" role="alert">{tx("Statement import failed.")}</p> : null}
      {importState === "done" ? <p className="success-note" role="status">{tx("Statement rows are ready for review.")}</p> : null}
      <Panel
        title="Rows needing attention"
        aside={
          <div className="segmented-control" aria-label={tx("Import row filter")}>
            <button type="button" className={duplicateFilter === "all" ? "active" : ""} aria-pressed={duplicateFilter === "all"} onClick={() => setDuplicateFilter("all")}>
              {tx("All")}
            </button>
            <button type="button" className={duplicateFilter === "duplicates" ? "active" : ""} aria-pressed={duplicateFilter === "duplicates"} onClick={() => setDuplicateFilter("duplicates")}>
              {tx("Possible duplicates")}
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table>
            <caption>{tx("Imported transaction review queue")}</caption>
            <thead><tr><th scope="col">{tx("Source")}</th><th scope="col">{tx("Merchant")}</th><th scope="col">{tx("Suggested category")}</th><th scope="col" className="numeric">{tx("Amount")}</th><th scope="col">{tx("Confidence")}</th><th scope="col">{tx("Action")}</th></tr></thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.source}</td>
                  <td>{row.merchant}{row.isPossibleDuplicate ? <StatusPill tone="warn">{tx("possible duplicate")}</StatusPill> : null}</td>
                  <td>{tx(row.suggestedCategory)}</td>
                  <td className="numeric">{money.format(row.amount)}</td>
                  <td><ProgressBar label={`${row.merchant} ${tx("match confidence")}`} value={row.confidence} /></td>
                  <td>
                    <div className="inline-actions">
                      <button
                        type="button"
                        disabled={importState === "saving"}
                        onClick={async () => {
                          setImportState("saving");
                          await reviewImportRow(accountId, row, "approve");
                          await reload();
                          setImportState("done");
                        }}
                      >
                        {tx("Approve")}
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={importState === "saving"}
                        onClick={async () => {
                          setImportState("saving");
                          await reviewImportRow(accountId, row, "delete");
                          setData((rows) => rows.filter((candidate) => candidate.id !== row.id));
                          setImportState("done");
                        }}
                      >
                        {tx("Delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleRows.length ? <EmptyState title="No rows match this filter" description="Switch back to all rows to continue import review." /> : null}
      </Panel>
    </>
  );
}

export function PartiesView() {
  const { accountId, t, tx } = usePreferences();
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
  const [detailState, setDetailState] = useState<SubmitState>("idle");
  const [participantState, setParticipantState] = useState<SubmitState>("idle");
  const [expenseState, setExpenseState] = useState<SubmitState>("idle");
  const [partyDeleteState, setPartyDeleteState] = useState<SubmitState>("idle");
  const [partyExpenseDeleteState, setPartyExpenseDeleteState] = useState<SubmitState>("idle");
  const [friendQuery, setFriendQuery] = useState("");
  const [friendResults, setFriendResults] = useState<UserSearchResult[]>([]);
  const [searchedFriendQuery, setSearchedFriendQuery] = useState("");
  const [splitMode, setSplitMode] = useState<"even" | "manual">("even");
  const [paidByParticipantId, setPaidByParticipantId] = useState("");

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
    const currency = String(form.get("currency") ?? "INR");
    const spentAt = String(form.get("date") ?? todayInputValue());
    const paidBy = String(form.get("paidBy") ?? paidByParticipantId);
    const participants = partyDetail.participants;
    const debtors = participants.filter((participant) => participant.id !== paidBy);

    try {
      setExpenseState("saving");
      if (!merchant || !paidBy || participants.length < 2 || !Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid party expense");
      }

      const splits =
        splitMode === "even"
          ? debtors.map((participant) => ({ participantId: participant.id, amount: Number((amount / participants.length).toFixed(2)) }))
          : debtors
              .map((participant) => ({ participantId: participant.id, amount: Number(form.get(`split-${participant.id}`) ?? 0) }))
              .filter((split) => Number.isFinite(split.amount) && split.amount > 0);
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

  async function onDeleteSelectedParty() {
    if (!partyDetail || !confirmDelete(`${tx("Delete")} ${partyDetail.name} ${tx("and all unlocked party expenses?")}`)) return;
    setPartyDeleteState("saving");
    try {
      await deleteParty(accountId, partyDetail.id);
      setData((current) => current.filter((party) => party.id !== partyDetail.id));
      setSelectedPartyId("");
      setPartyDetail(null);
      setPartyDeleteState("saved");
    } catch {
      setPartyDeleteState("failed");
    }
  }

  async function onDeletePartyExpense(expense: Expense) {
    if (!partyDetail || !confirmDelete(`${tx("Delete")} ${expense.merchant} ${tx("from this party and the overall expense ledger?")}`)) return;
    setPartyExpenseDeleteState("saving");
    try {
      await deletePartyExpense(accountId, partyDetail.id, expense.id);
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

  return (
    <>
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
                  <strong className={party.balance >= 0 ? "positive" : "negative"}>{money.format(party.balance)}</strong>
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
              <form className="form-grid" onSubmit={onCreatePartyExpense}>
                <label>{tx("Merchant")}<input name="merchant" required /></label>
                <label>{tx("Category")}<select name="category"><option value="Food">{tx("Food")}</option><option value="Shopping">{tx("Shopping")}</option><option value="Travel">{tx("Travel")}</option><option value="Subscriptions">{tx("Subscriptions")}</option><option value="Health">{tx("Health")}</option></select></label>
                <label>{tx("Amount")}<input name="amount" type="number" min="0.01" step="0.01" required /></label>
                <label>{tx("Currency")}<select name="currency"><option>INR</option><option>USD</option><option>EUR</option><option>AED</option></select></label>
                <label>{tx("Date")}<input name="date" type="date" defaultValue={todayInputValue()} required /></label>
                <label>{tx("Paid by")}<select name="paidBy" value={paidByParticipantId} onChange={(event) => setPaidByParticipantId(event.target.value)} required>{partyDetail.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.displayName}</option>)}</select></label>
                <label>{tx("Split mode")}<select value={splitMode} onChange={(event) => setSplitMode(event.target.value as "even" | "manual")}><option value="even">{tx("Even split")}</option><option value="manual">{tx("Manual amounts")}</option></select></label>
                {splitMode === "manual"
                  ? partyDetail.participants
                      .filter((participant) => participant.id !== paidByParticipantId)
                      .map((participant) => (
                        <label key={participant.id}>{participant.displayName} {tx("owes")}<input name={`split-${participant.id}`} type="number" min="0" step="0.01" /></label>
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
                          <td className="numeric">{money.format(expense.amount)}</td>
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
                          <td className="numeric">{money.format(split.amount)}</td>
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
                        <p>{money.format(settlement.amount)} {tx("needs approval from")} {approvalParticipant?.displayName ?? tx("the payer")} {tx("before the split closes.")}</p>
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
  const { accountId, t, tx } = usePreferences();
  const loadReports = useCallback(() => getReports(accountId), [accountId]);
  const { data, loading } = useAsyncData(loadReports, emptyReportData);
  return (
    <>
      <PageHeader
        title={t("reports")}
        description="NovaCent reporting for category mix, cash flow, budget variance, merchants, parties, and currencies."
        action={
          <div className="inline-actions">
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
      {loading ? <ChartSkeleton label="Loading NovaCent report charts" /> : null}
      <section className="report-summary" aria-label={tx("Report summary metrics")}>
        <MetricCard label="Tracked spend" value={money.format(data.categories.reduce((sum, row) => sum + row.value, 0))} detail="Across active report categories" />
        <MetricCard label="Cash retained" value={money.format(data.cashflow.reduce((sum, row) => sum + row.income - row.spend, 0))} detail="Income minus spend in visible months" />
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

export function SettingsView() {
  const { accountId, setAccountId, theme, setTheme, language, setLanguage, t, tx } = usePreferences();
  const { data: accountOptions } = useAsyncData(getAccounts, [] as Account[]);
  const [saveState, setSaveState] = useState<SubmitState>("idle");
  return (
    <>
      <PageHeader title={t("settings")} description="Workspace preferences, sync posture, and localization readiness." />
      <Panel title="Preferences">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setSaveState("saved");
          }}
        >
          <label>{t("account")}<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accountOptions.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label>{t("theme")}<select value={theme} onChange={(event) => setTheme(event.target.value as "light" | "dark")}><option value="light">{t("light")}</option><option value="dark">{t("dark")}</option></select></label>
          <label>{t("language")}<select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>{Object.entries(languages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <label>{tx("Default currency")}<select><option>INR</option><option>USD</option><option>EUR</option><option>AED</option></select></label>
          <button className="form-submit" type="submit">{t("save")}</button>
        </form>
        {saveState === "saved" ? <p className="success-note" role="status">{tx("Preferences saved on this device.")}</p> : null}
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
