"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createExpense, getAccounts, getBudgets, getExpenses, getImportRows, getOverview, getReports, getTripsAndParties, reportDataToCsv, reviewImportRow, uploadStatement } from "@/lib/client/expense-service";
import type { Account, Budget, Expense, ImportRow, Party, Trip } from "@/lib/client/demo-data";
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

function useAsyncData<T>(loader: () => Promise<T>, initial: T) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
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
  return <p className="loading-note" role="status">{label}</p>;
}

function ExpenseTable({ rows }: { rows: Expense[] }) {
  if (!rows.length) return <EmptyState title="No expenses yet" description="New spending will appear here once imported or added." />;
  return (
    <div className="table-wrap">
      <table>
        <caption>Expense ledger with merchant, category, owner, amount, and status</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Merchant</th>
            <th scope="col">Category</th>
            <th scope="col">Owner</th>
            <th scope="col" className="numeric">Amount</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((expense) => (
            <tr key={expense.id}>
              <td>{expense.date}</td>
              <td>{expense.merchant}</td>
              <td>{expense.category}</td>
              <td>{expense.owner}</td>
              <td className="numeric">{money.format(expense.amount)}</td>
              <td><StatusPill tone={expense.status === "cleared" ? "good" : expense.status === "pending" ? "warn" : "bad"}>{expense.status}</StatusPill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BudgetList({ rows }: { rows: Budget[] }) {
  return (
    <div className="stack">
      {rows.map((budget) => {
        const percent = Math.round((budget.spent / budget.limit) * 100);
        return (
          <article className="budget-row" key={budget.id}>
            <div>
              <h3>{budget.category}</h3>
              <p>{money.format(budget.spent)} of {money.format(budget.limit)}</p>
            </div>
            <ProgressBar label={`${budget.category} spend`} value={percent} />
          </article>
        );
      })}
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="chart-alt" role="img" aria-label={`${title} bar chart. ${rows.map((row) => `${row.label}: ${money.format(row.value)}`).join(", ")}`}>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>{row.label}</span>
          <div><i style={{ width: `${(row.value / max) * 100}%` }} /></div>
          <b>{money.format(row.value)}</b>
        </div>
      ))}
    </div>
  );
}

export function DashboardView() {
  const { accountId, t } = usePreferences();
  const loadOverview = useCallback(() => getOverview(accountId), [accountId]);
  const { data, loading } = useAsyncData(loadOverview, { totalSpend: 0, remainingBudget: 0, monthlyRunway: 0, pendingImports: 0, budgets: [], expenses: [] });

  return (
    <>
      <PageHeader title={t("dashboard")} description="A calm command center for personal, trip, party, and imported spending." action={<button type="button">{t("syncNow")}</button>} />
      {loading ? <LoadingNote label="Loading dashboard" /> : null}
      <section className="metric-grid" aria-label="Key account metrics">
        <MetricCard label={t("totalSpend")} value={money.format(data.totalSpend)} detail="Across visible transactions this month" />
        <MetricCard label={t("remainingBudget")} value={money.format(data.remainingBudget)} detail="Available across active envelopes" />
        <MetricCard label={t("monthlyRunway")} value={`${data.monthlyRunway} days`} detail="At the current seven-day average" />
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
  const { accountId, t } = usePreferences();
  const loadExpenses = useCallback(() => getExpenses(accountId), [accountId]);
  const { data, setData, error } = useAsyncData(loadExpenses, []);
  const [query, setQuery] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const filtered = useMemo(
    () => data.filter((expense) => `${expense.merchant} ${expense.category} ${expense.owner}`.toLowerCase().includes(query.toLowerCase())),
    [data, query]
  );

  async function onQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("saving");
    const form = new FormData(event.currentTarget);
    const merchant = String(form.get("merchant") ?? "").trim();
    const categoryName = String(form.get("category") ?? "Uncategorized");
    const amount = Number(form.get("amount"));
    const spentAt = String(form.get("date") ?? new Date().toISOString().slice(0, 10));
    const currency = String(form.get("currency") ?? "INR");

    try {
      const expense = await createExpense(accountId, { merchant, categoryName, amount, currency, spentAt });
      setData((rows) => [expense, ...rows]);
      event.currentTarget.reset();
      setSubmitState("saved");
    } catch {
      setSubmitState("failed");
    }
  }

  return (
    <>
      <PageHeader title={t("expenses")} description="Search, add, and review every transaction before it hits reports." action={<button type="button">{t("addExpense")}</button>} />
      {error ? <p className="error-note" role="alert">{error}</p> : null}
      <Panel title="Expense ledger" aside={<label className="search-box"><span>{t("search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Merchant, category, owner" /></label>}>
        <ExpenseTable rows={filtered} />
      </Panel>
      <Panel title="Quick add">
        <form className="form-grid" onSubmit={onQuickAdd}>
          <label>Merchant<input name="merchant" required /></label>
          <label>Category<select name="category"><option>Food</option><option>Shopping</option><option>Travel</option><option>Subscriptions</option><option>Health</option></select></label>
          <label>Amount<input name="amount" type="number" min="0" step="0.01" required /></label>
          <label>Currency<select name="currency"><option>INR</option><option>USD</option><option>EUR</option><option>AED</option></select></label>
          <label>Date<input name="date" type="date" required /></label>
          <button type="submit" disabled={submitState === "saving"}>{submitState === "saving" ? "Saving" : t("save")}</button>
        </form>
        {submitState === "saved" ? <p className="success-note" role="status">Expense saved or queued for sync.</p> : null}
        {submitState === "failed" ? <p className="error-note" role="alert">Unable to save expense.</p> : null}
      </Panel>
    </>
  );
}

export function BudgetsView() {
  const { accountId } = usePreferences();
  const loadBudgets = useCallback(() => getBudgets(accountId), [accountId]);
  const { data } = useAsyncData(loadBudgets, []);
  return (
    <>
      <PageHeader title="Budgets" description="Track limits, spot overspend early, and keep categories honest." action={<button type="button">New budget</button>} />
      <Panel title="Active budgets"><BudgetList rows={data} /></Panel>
    </>
  );
}

export function TripsView() {
  const { accountId } = usePreferences();
  const loadTripsAndParties = useCallback(() => getTripsAndParties(accountId), [accountId]);
  const { data } = useAsyncData(loadTripsAndParties, { trips: [] as Trip[], parties: [] as Party[] });
  return (
    <>
      <PageHeader title="Trips and parties" description="Plan shared spending, settle balances, and keep travel budgets visible." action={<button type="button">Create group</button>} />
      <div className="content-grid">
        <Panel title="Trips">
          <div className="card-list">
            {data.trips.map((trip) => (
              <article className="detail-card" key={trip.id}>
                <h3>{trip.name}</h3>
                <p>{trip.dates} - {trip.members} members</p>
                <ProgressBar label={`${trip.name} budget`} value={Math.round((trip.spend / trip.budget) * 100)} />
              </article>
            ))}
          </div>
        </Panel>
        <Panel title="Parties">
          <div className="card-list">
            {data.parties.map((party) => (
              <article className="detail-card" key={party.id}>
                <h3>{party.name}</h3>
                <p>{party.members.join(", ")}</p>
                <strong className={party.balance >= 0 ? "positive" : "negative"}>{money.format(party.balance)}</strong>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

export function ImportReviewView() {
  const { accountId } = usePreferences();
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
        title="Import review"
        description="Triage low-confidence rows before posting them into the ledger."
        action={
          <label className="file-button">
            Upload statement
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
      {importState === "uploading" ? <p className="loading-note" role="status">Uploading and parsing statement.</p> : null}
      {importState === "failed" ? <p className="error-note" role="alert">Statement import failed.</p> : null}
      {importState === "done" ? <p className="success-note" role="status">Statement rows are ready for review.</p> : null}
      <Panel
        title="Rows needing attention"
        aside={
          <div className="segmented-control" aria-label="Import row filter">
            <button type="button" className={duplicateFilter === "all" ? "active" : ""} aria-pressed={duplicateFilter === "all"} onClick={() => setDuplicateFilter("all")}>
              All
            </button>
            <button type="button" className={duplicateFilter === "duplicates" ? "active" : ""} aria-pressed={duplicateFilter === "duplicates"} onClick={() => setDuplicateFilter("duplicates")}>
              Possible duplicates
            </button>
          </div>
        }
      >
        <div className="table-wrap">
          <table>
            <caption>Imported transaction review queue</caption>
            <thead><tr><th scope="col">Source</th><th scope="col">Merchant</th><th scope="col">Suggested category</th><th scope="col" className="numeric">Amount</th><th scope="col">Confidence</th><th scope="col">Action</th></tr></thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.source}</td>
                  <td>{row.merchant}{row.isPossibleDuplicate ? <StatusPill tone="warn">possible duplicate</StatusPill> : null}</td>
                  <td>{row.suggestedCategory}</td>
                  <td className="numeric">{money.format(row.amount)}</td>
                  <td><ProgressBar label={`${row.merchant} match confidence`} value={row.confidence} /></td>
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
                        Approve
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
                        Delete
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
  const { accountId } = usePreferences();
  const loadTripsAndParties = useCallback(() => getTripsAndParties(accountId), [accountId]);
  const { data } = useAsyncData(loadTripsAndParties, { trips: [] as Trip[], parties: [] as Party[] });
  return (
    <>
      <PageHeader title="Parties" description="Track shared expenses, external participants, and settlements that need approval." action={<button type="button">Create party</button>} />
      <Panel title="Group balances">
        <div className="card-list">
          {data.parties.map((party) => (
            <article className="detail-card" key={party.id}>
              <h3>{party.name}</h3>
              <p>{party.members.join(", ")}</p>
              <strong className={party.balance >= 0 ? "positive" : "negative"}>{money.format(party.balance)}</strong>
              <div className="inline-actions">
                <button type="button">Mark external settled</button>
                <button className="secondary-button" type="button">Review approvals</button>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </>
  );
}

export function ReportsView() {
  const { accountId } = usePreferences();
  const loadReports = useCallback(() => getReports(accountId), [accountId]);
  const { data, loading } = useAsyncData(loadReports, emptyReportData);
  return (
    <>
      <PageHeader
        title="Reports"
        description="NovaCent reporting for category mix, cash flow, budget variance, merchants, trips, parties, and currencies."
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
              Export CSV
            </button>
            <button className="secondary-button" type="button" onClick={() => window.print()}>
              Export PDF
            </button>
          </div>
        }
      />
      {loading ? <ChartSkeleton label="Loading NovaCent report charts" /> : null}
      <section className="report-summary" aria-label="Report summary metrics">
        <MetricCard label="Tracked spend" value={money.format(data.categories.reduce((sum, row) => sum + row.value, 0))} detail="Across active report categories" />
        <MetricCard label="Cash retained" value={money.format(data.cashflow.reduce((sum, row) => sum + row.income - row.spend, 0))} detail="Income minus spend in visible months" />
        <MetricCard label="Largest budget usage" value={`${Math.max(...data.budgetVariance.map((row) => row.usage), 0)}%`} detail="Highest active category utilization" />
        <MetricCard label="Currencies" value={String(data.currencies.length)} detail="Original spend currencies represented" />
      </section>
      <div className="report-grid">
        <Panel title="Spend by category">
          <CategoryBreakdownChart data={data.categories} />
          <div className="simple-summary" aria-label="Simple category bar summary">
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
        <Panel title="Trips">
          <SummaryBarsChart data={data.trips} title="Trip spend" label="Trip spend summary chart" />
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
  const { accountId, setAccountId, theme, setTheme, language, setLanguage, t } = usePreferences();
  const { data: accountOptions } = useAsyncData(getAccounts, [] as Account[]);
  return (
    <>
      <PageHeader title={t("settings")} description="Workspace preferences, sync posture, and localization readiness." />
      <Panel title="Preferences">
        <form className="form-grid">
          <label>{t("account")}<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accountOptions.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label>{t("theme")}<select value={theme} onChange={(event) => setTheme(event.target.value as "light" | "dark")}><option value="light">{t("light")}</option><option value="dark">{t("dark")}</option></select></label>
          <label>{t("language")}<select value={language} onChange={(event) => setLanguage(event.target.value as "en" | "es")}><option value="en">English</option><option value="es">Espanol</option></select></label>
          <label>Default currency<select><option>INR</option><option>USD</option><option>EUR</option><option>AED</option></select></label>
          <button type="submit">{t("save")}</button>
        </form>
      </Panel>
      <Panel title="Offline readiness">
        <ul className="check-list">
          <li>Local preferences persist in browser storage.</li>
          <li>Live APIs are used by default; set NEXT_PUBLIC_USE_MOCKS=true for demo data.</li>
          <li>Offline banner reacts to browser connectivity events.</li>
        </ul>
      </Panel>
    </>
  );
}
