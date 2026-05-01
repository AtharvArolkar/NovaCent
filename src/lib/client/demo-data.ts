export type Account = {
  id: string;
  name: string;
  currency: string;
  type: "personal" | "family" | "business";
};

export type Expense = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  owner: string;
  status: "cleared" | "pending" | "needs-review";
  source?: string;
  tripId?: string;
  partyId?: string;
  settlementId?: string;
  canDelete?: boolean;
};

export type Budget = {
  id: string;
  category: string;
  limit: number;
  spent: number;
  scope?: "overall" | "category";
  currency?: string;
  period?: "monthly" | "yearly";
  alertThreshold?: number;
};

export type Trip = {
  id: string;
  name: string;
  dates: string;
  spend: number;
  budget: number;
  members: number;
};

export type Party = {
  id: string;
  name: string;
  balance: number;
  members: string[];
};

export type ImportRow = {
  id: string;
  batchId?: string;
  source: string;
  merchant: string;
  amount: number;
  confidence: number;
  suggestedCategory: string;
  isPossibleDuplicate?: boolean;
};

export const accounts: Account[] = [
  { id: "primary-inr", name: "Primary INR Account", currency: "INR", type: "personal" },
  { id: "family", name: "Family Shared View", currency: "INR", type: "family" },
  { id: "travel-wallet", name: "Travel Wallet", currency: "INR", type: "personal" }
];

export const expenses: Expense[] = [
  { id: "ex-001", date: "2026-04-29", merchant: "Swiggy", category: "Food", amount: 1280, owner: "Atharv", status: "cleared" },
  { id: "ex-002", date: "2026-04-28", merchant: "Uber India", category: "Travel", amount: 640, owner: "Atharv", status: "pending" },
  { id: "ex-003", date: "2026-04-27", merchant: "Netflix", category: "Subscriptions", amount: 649, owner: "Atharv", status: "cleared" },
  { id: "ex-004", date: "2026-04-25", merchant: "HDFC statement row", category: "Uncategorized", amount: 1844, owner: "Import review", status: "needs-review" },
  { id: "ex-005", date: "2026-04-22", merchant: "Dubai Metro", category: "Travel", amount: 1364, owner: "Dubai trip", status: "cleared" }
];

export const budgets: Budget[] = [
  { id: "bu-001", category: "Food", limit: 15000, spent: 12750 },
  { id: "bu-002", category: "Shopping", limit: 9000, spent: 4299 },
  { id: "bu-003", category: "Travel", limit: 25000, spent: 15340 },
  { id: "bu-004", category: "Subscriptions", limit: 3000, spent: 2297 }
];

export const trips: Trip[] = [
  { id: "tr-001", name: "Dubai workation", dates: "May 8-11", spend: 15340, budget: 30000, members: 3 },
  { id: "tr-002", name: "Goa weekend", dates: "Jun 14-16", spend: 9800, budget: 18000, members: 4 }
];

export const parties: Party[] = [
  { id: "pa-001", name: "Goa friends trip", balance: 5200, members: ["Atharv", "Anu", "Raj"] },
  { id: "pa-002", name: "Flat expenses", balance: -1280, members: ["Atharv", "Priya", "External: Cook"] }
];

export const imports: ImportRow[] = [
  { id: "im-001", source: "HDFC_April_2026.pdf", merchant: "Swiggy Instamart", amount: 938, confidence: 91, suggestedCategory: "Food" },
  { id: "im-002", source: "ICICI_April.csv", merchant: "Unknown POS 4192", amount: 1844, confidence: 41, suggestedCategory: "Shopping" },
  { id: "im-003", source: "SBI_Card.xlsx", merchant: "Uber India", amount: 640, confidence: 88, suggestedCategory: "Travel" }
];
