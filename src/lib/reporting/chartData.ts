export interface LabeledAmount {
  label: string;
  value: number;
}

export interface CashFlowPoint {
  label: string;
  income: number;
  spend: number;
}

export interface BudgetVariancePoint {
  label: string;
  budget: number;
  actual: number;
  remaining: number;
  usage: number;
}

export interface MerchantTrendPoint {
  label: string;
  food: number;
  travel: number;
  shopping: number;
  subscriptions: number;
}

export interface PartySummaryPoint {
  label: string;
  outstanding: number;
  settled: number;
}

export interface ReportingChartData {
  totalSpent?: number;
  categories: LabeledAmount[];
  cashflow: CashFlowPoint[];
  investments: LabeledAmount[];
  budgetVariance: BudgetVariancePoint[];
  merchantTrends: MerchantTrendPoint[];
  trips: LabeledAmount[];
  parties: PartySummaryPoint[];
  currencies: LabeledAmount[];
}

export const buildBudgetVariance = (
  budgets: { category: string; limit: number; spent: number }[],
): BudgetVariancePoint[] =>
  budgets.map((budget) => {
    const remaining = budget.limit - budget.spent;
    return {
      label: budget.category,
      budget: budget.limit,
      actual: budget.spent,
      remaining,
      usage: budget.limit > 0 ? Math.round((budget.spent / budget.limit) * 100) : 0,
    };
  });

export const buildCategoryBreakdown = (
  budgets: { category: string; spent: number }[],
): LabeledAmount[] =>
  budgets
    .map((budget) => ({ label: budget.category, value: budget.spent }))
    .sort((left, right) => right.value - left.value);
