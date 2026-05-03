import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { getCurrencyRate } from "@/lib/server/currency";
import { handleApiError, ok } from "@/lib/server/http";
import { hydrateBudgetSpend } from "@/lib/server/budgets";
import { collections, getDb } from "@/lib/server/mongodb";
import { investmentAmountForSignedAmount, spendImpactForSignedAmount } from "@/lib/spend-impact";
import type { Budget, Expense, Money } from "@/lib/domain";

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function normalizeCurrency(currency?: string) {
  return currency?.toUpperCase() || "INR";
}

function monthBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function yearBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

type RateCache = Map<string, number>;

async function rateForCurrency(fromCurrency: string, toCurrency: string, cache: RateCache) {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return 1;

  const key = `${from}:${to}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const rate = await getCurrencyRate(from, to);
  cache.set(key, rate.rate);
  return rate.rate;
}

async function convertMoney(money: Money | undefined, targetCurrency: string, cache: RateCache) {
  if (!money) return 0;

  const sourceCurrency = normalizeCurrency(money.currency);
  const amount = Number(money.amount ?? 0);
  if (!Number.isFinite(amount)) return 0;
  if (sourceCurrency === normalizeCurrency(targetCurrency)) return roundMoney(amount);

  try {
    const rate = await rateForCurrency(sourceCurrency, targetCurrency, cache);
    return roundMoney(amount * rate);
  } catch {
    return roundMoney(amount);
  }
}

async function expenseAmountInCurrency(expense: Expense, targetCurrency: string, cache: RateCache) {
  const target = normalizeCurrency(targetCurrency);

  if (normalizeCurrency(expense.original?.currency) === target) {
    return roundMoney(Number(expense.original?.amount ?? 0));
  }

  if (normalizeCurrency(expense.base?.currency) === target) {
    return roundMoney(Number(expense.base?.amount ?? 0));
  }

  return convertMoney(expense.original ?? expense.base, target, cache);
}

async function spendImpactInCurrency(expense: Expense, targetCurrency: string, cache: RateCache) {
  const amount = await expenseAmountInCurrency(expense, targetCurrency, cache);
  return spendImpactForSignedAmount(amount, expense);
}

async function investmentAmountInCurrency(expense: Expense, targetCurrency: string, cache: RateCache) {
  const amount = await expenseAmountInCurrency(expense, targetCurrency, cache);
  return investmentAmountForSignedAmount(amount, expense);
}

async function totalSpendImpact(expenses: Expense[], targetCurrency: string, cache: RateCache) {
  const amounts = await Promise.all(expenses.map((expense) => spendImpactInCurrency(expense, targetCurrency, cache)));
  return Math.max(0, roundMoney(amounts.reduce((sum, amount) => sum + amount, 0)));
}

async function totalInvestmentImpact(expenses: Expense[], targetCurrency: string, cache: RateCache) {
  const amounts = await Promise.all(expenses.map((expense) => investmentAmountInCurrency(expense, targetCurrency, cache)));
  return Math.max(0, roundMoney(amounts.reduce((sum, amount) => sum + amount, 0)));
}

async function remainingBudgetInCurrency(budgets: Budget[], targetCurrency: string, cache: RateCache) {
  const amounts = await Promise.all(
    budgets.map((budget) => {
      const remaining = Math.max(0, Number(budget.limit?.amount ?? 0) - Number(budget.spent?.amount ?? 0));
      return convertMoney({ amount: remaining, currency: budget.limit?.currency ?? budget.spent?.currency ?? targetCurrency }, targetCurrency, cache);
    })
  );
  return roundMoney(amounts.reduce((sum, amount) => sum + amount, 0));
}

export async function GET(request: Request) {
  try {
    const { accountId, account } = await requireAccountAccess(accountIdFromRequest(request));
    const url = new URL(request.url);
    const targetCurrency = normalizeCurrency(url.searchParams.get("targetCurrency") ?? account.baseCurrency);
    const { start: monthStart, end: monthEnd } = monthBounds();
    const { start: yearStart, end: yearEnd } = yearBounds();
    const db = await getDb();
    const expenseQuery = {
      accountId,
      excludeFromLedger: { $ne: true },
      spentAt: { $gte: monthStart, $lt: monthEnd }
    };
    const yearlyExpenseQuery = {
      accountId,
      excludeFromLedger: { $ne: true },
      spentAt: { $gte: yearStart, $lt: yearEnd }
    };

    const [summaryExpenses, yearlySummaryExpenses, recentExpenses, budgets, pendingImports] = await Promise.all([
      db.collection<Expense>(collections.expenses).find(expenseQuery).project<Expense>({
        _id: 0,
        id: 1,
        accountId: 1,
        source: 1,
        merchant: 1,
        description: 1,
        categoryId: 1,
        categoryName: 1,
        original: 1,
        base: 1,
        spentAt: 1,
        notes: 1,
        moneyFlowType: 1,
        syncStatus: 1,
        createdAt: 1,
        updatedAt: 1
      }).toArray(),
      db.collection<Expense>(collections.expenses).find(yearlyExpenseQuery).project<Expense>({
        _id: 0,
        id: 1,
        accountId: 1,
        source: 1,
        merchant: 1,
        description: 1,
        categoryId: 1,
        categoryName: 1,
        original: 1,
        base: 1,
        spentAt: 1,
        notes: 1,
        moneyFlowType: 1,
        syncStatus: 1,
        createdAt: 1,
        updatedAt: 1
      }).toArray(),
      db.collection<Expense>(collections.expenses).find({ accountId, excludeFromLedger: { $ne: true } }).sort({ spentAt: -1, createdAt: -1 }).limit(5).toArray(),
      db.collection<Budget>(collections.budgets).find({ accountId }).sort({ categoryName: 1 }).toArray(),
      db.collection(collections.importRows).countDocuments({ accountId, status: { $nin: ["approved", "deleted"] } })
    ]);

    const rateCache: RateCache = new Map();
    const hydratedBudgets = await hydrateBudgetSpend(db, accountId, budgets, { includeExpenses: false });
    const monthlyBudgets = hydratedBudgets.filter((budget) => (budget.period ?? "monthly") === "monthly");
    const yearlyBudgets = hydratedBudgets.filter((budget) => budget.period === "yearly");
    const [totalSpend, totalInvested, remainingBudget, monthlyRemainingBudget, yearlyRemainingBudget] = await Promise.all([
      totalSpendImpact(summaryExpenses, targetCurrency, rateCache),
      totalInvestmentImpact(yearlySummaryExpenses, targetCurrency, rateCache),
      remainingBudgetInCurrency(hydratedBudgets, targetCurrency, rateCache),
      remainingBudgetInCurrency(monthlyBudgets, targetCurrency, rateCache),
      remainingBudgetInCurrency(yearlyBudgets, targetCurrency, rateCache)
    ]);

    return ok({
      totalSpend,
      totalInvested,
      remainingBudget,
      monthlyRemainingBudget,
      yearlyRemainingBudget,
      pendingImports,
      budgets: hydratedBudgets,
      expenses: recentExpenses
    });
  } catch (error) {
    return handleApiError(error);
  }
}
