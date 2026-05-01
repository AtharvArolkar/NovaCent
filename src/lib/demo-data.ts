import { appConfig } from "@/lib/app-config";
import type {
  Account,
  Budget,
  Category,
  CategoryRule,
  Expense,
  ImportBatch,
  NotificationItem,
  Party,
  ReportSummary,
  Trip
} from "@/lib/domain";

const now = new Date().toISOString();

export const demoAccounts: Account[] = [
  {
    id: "acc-primary",
    userId: "demo-user",
    name: "Primary INR Account",
    baseCurrency: appConfig.baseCurrency,
    isDefault: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "acc-travel",
    userId: "demo-user",
    name: "Travel Wallet",
    baseCurrency: appConfig.baseCurrency,
    isDefault: false,
    createdAt: now,
    updatedAt: now
  }
];

export const demoCategories: Category[] = [
  { id: "cat-food", accountId: "acc-primary", name: "Food", color: "#0f766e", icon: "utensils", isSystem: true },
  { id: "cat-travel", accountId: "acc-primary", name: "Travel", color: "#2563eb", icon: "plane", isSystem: true },
  { id: "cat-rent", accountId: "acc-primary", name: "Rent", color: "#b45309", icon: "home", isSystem: true },
  { id: "cat-shopping", accountId: "acc-primary", name: "Shopping", color: "#be123c", icon: "bag", isSystem: true },
  { id: "cat-health", accountId: "acc-primary", name: "Health", color: "#7c3aed", icon: "heart", isSystem: true },
  { id: "cat-fuel", accountId: "acc-primary", name: "Fuel", color: "#0891b2", icon: "fuel", isSystem: true },
  { id: "cat-loan-emi", accountId: "acc-primary", name: "Loan/EMI", color: "#64748b", icon: "receipt", isSystem: true },
  { id: "cat-others", accountId: "acc-primary", name: "Others", color: "#475569", icon: "circle", isSystem: true }
];

export const demoCategoryRules: CategoryRule[] = [
  { id: "rule-swiggy", accountId: "acc-primary", pattern: "Swiggy", categoryId: "cat-food", categoryName: "Food" },
  { id: "rule-uber", accountId: "acc-primary", pattern: "Uber", categoryId: "cat-travel", categoryName: "Travel" },
  { id: "rule-amazon", accountId: "acc-primary", pattern: "Amazon", categoryId: "cat-shopping", categoryName: "Shopping" },
  { id: "rule-fuel", accountId: "acc-primary", pattern: "Fuel", categoryId: "cat-fuel", categoryName: "Fuel" },
  { id: "rule-petrol", accountId: "acc-primary", pattern: "Petrol", categoryId: "cat-fuel", categoryName: "Fuel" },
  { id: "rule-emi", accountId: "acc-primary", pattern: "EMI", categoryId: "cat-loan-emi", categoryName: "Loan/EMI" },
  { id: "rule-loan", accountId: "acc-primary", pattern: "Loan", categoryId: "cat-loan-emi", categoryName: "Loan/EMI" }
];

export const demoExpenses: Expense[] = [
  {
    id: "exp-1",
    accountId: "acc-primary",
    source: "manual",
    merchant: "Swiggy",
    categoryId: "cat-food",
    categoryName: "Food",
    original: { amount: 1280, currency: "INR" },
    base: { amount: 1280, currency: "INR" },
    spentAt: "2026-04-29",
    syncStatus: "synced",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "exp-2",
    accountId: "acc-primary",
    source: "recurring",
    merchant: "Apartment Rent",
    categoryId: "cat-rent",
    categoryName: "Rent",
    original: { amount: 32000, currency: "INR" },
    base: { amount: 32000, currency: "INR" },
    spentAt: "2026-04-01",
    syncStatus: "synced",
    recurringRuleId: "rec-rent",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "exp-3",
    accountId: "acc-primary",
    source: "trip",
    merchant: "Dubai Metro",
    categoryId: "cat-travel",
    categoryName: "Travel",
    original: { amount: 60, currency: "AED" },
    base: { amount: 1364, currency: "INR" },
    exchangeRate: {
      from: "AED",
      to: "INR",
      rate: 22.733,
      provider: "frankfurter",
      fetchedAt: now
    },
    spentAt: "2026-04-20",
    tripId: "trip-dubai",
    syncStatus: "synced",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "exp-4",
    accountId: "acc-primary",
    source: "import",
    merchant: "Amazon",
    categoryId: "cat-shopping",
    categoryName: "Shopping",
    original: { amount: 4299, currency: "INR" },
    base: { amount: 4299, currency: "INR" },
    spentAt: "2026-04-18",
    syncStatus: "pending",
    clientMutationId: "offline-1",
    createdAt: now,
    updatedAt: now
  }
];

export const demoBudgets: Budget[] = [
  {
    id: "budget-food",
    accountId: "acc-primary",
    categoryId: "cat-food",
    categoryName: "Food",
    period: "monthly",
    limit: { amount: 15000, currency: "INR" },
    alertThreshold: 80,
    spent: { amount: 12750, currency: "INR" }
  },
  {
    id: "budget-shopping",
    accountId: "acc-primary",
    categoryId: "cat-shopping",
    categoryName: "Shopping",
    period: "monthly",
    limit: { amount: 9000, currency: "INR" },
    alertThreshold: 75,
    spent: { amount: 4299, currency: "INR" }
  }
];

export const demoTrips: Trip[] = [
  {
    id: "trip-dubai",
    accountId: "acc-primary",
    name: "Dubai workation",
    destination: "Dubai",
    startsAt: "2026-04-19",
    endsAt: "2026-04-25",
    baseCurrency: "INR",
    participantCount: 3
  }
];

export const demoParties: Party[] = [
  {
    id: "party-goa",
    accountId: "acc-primary",
    name: "Goa friends trip",
    createdAt: now,
    participants: [
      { id: "part-you", partyId: "party-goa", kind: "registered", displayName: "You", userId: "demo-user", accountId: "acc-primary" },
      { id: "part-anu", partyId: "party-goa", kind: "external", displayName: "Anu" },
      { id: "part-raj", partyId: "party-goa", kind: "external", displayName: "Raj" }
    ]
  }
];

export const demoImportBatch: ImportBatch = {
  id: "import-hdfc-april",
  accountId: "acc-primary",
  fileName: "HDFC_April_2026.pdf",
  status: "review",
  createdAt: now,
  rows: [
    {
      id: "row-1",
      batchId: "import-hdfc-april",
      status: "review",
      merchant: "Swiggy Instamart",
      spentAt: "2026-04-27",
      original: { amount: 938, currency: "INR" },
      suggestedCategoryName: "Food",
      confidence: 0.91,
      rawText: "UPI/SWIGGYINSTAMART/938.00"
    },
    {
      id: "row-2",
      batchId: "import-hdfc-april",
      status: "review",
      merchant: "Uber India",
      spentAt: "2026-04-23",
      original: { amount: 640, currency: "INR" },
      suggestedCategoryName: "Travel",
      confidence: 0.88,
      rawText: "UPI/UBER/640.00"
    }
  ]
};

export const demoNotifications: NotificationItem[] = [
  {
    id: "note-budget",
    accountId: "acc-primary",
    title: "Food budget crossed 80%",
    body: "You have used 85% of your Food budget for this month.",
    tone: "warning",
    read: false,
    createdAt: now
  },
  {
    id: "note-sync",
    accountId: "acc-primary",
    title: "1 expense waiting to sync",
    body: "The app will save it to MongoDB when you are online.",
    tone: "info",
    read: false,
    createdAt: now
  }
];

export const demoReport: ReportSummary = {
  totalSpent: { amount: 38943, currency: "INR" },
  budgetUsage: 78,
  pendingSyncCount: 1,
  categoryBreakdown: [
    { category: "Rent", amount: 32000, color: "#b45309" },
    { category: "Shopping", amount: 4299, color: "#be123c" },
    { category: "Travel", amount: 1364, color: "#2563eb" },
    { category: "Food", amount: 1280, color: "#0f766e" }
  ],
  monthlyTrend: [
    { month: "Jan", amount: 31400, income: 0, spend: 31400 },
    { month: "Feb", amount: 36500, income: 0, spend: 36500 },
    { month: "Mar", amount: 34200, income: 0, spend: 34200 },
    { month: "Apr", amount: 38943, income: 0, spend: 38943 }
  ],
  budgetVariance: [
    { categoryName: "Overall spend", limitAmount: 50000, actualAmount: 38943, remainingAmount: 11057, usagePercent: 78 }
  ],
  merchantTrends: [
    { month: "Apr", food: 1280, travel: 1364, shopping: 4299, subscriptions: 0 }
  ],
  tripSpend: [{ trip: "Dubai workation", amount: 1364 }],
  partyBalances: [{ party: "Goa friends trip", outstanding: 5200, settled: 2400 }],
  currencyExposure: [{ currency: "INR", amount: 38943 }]
};
