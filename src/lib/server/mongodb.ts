import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "novacent";

declare global {
  // eslint-disable-next-line no-var
  var __rupeeFlowMongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URI is required. Copy .env.example to .env.local and set MONGODB_URI.");
  }

  if (!global.__rupeeFlowMongoClientPromise) {
    const client = new MongoClient(uri);
    global.__rupeeFlowMongoClientPromise = client.connect();
  }

  return global.__rupeeFlowMongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

export const collections = {
  users: "users",
  accounts: "accounts",
  categories: "categories",
  categoryRules: "categoryRules",
  expenses: "expenses",
  recurringRules: "recurringRules",
  budgets: "budgets",
  notifications: "notifications",
  trips: "trips",
  parties: "parties",
  splits: "splits",
  settlements: "settlements",
  importBatches: "importBatches",
  importRows: "importRows",
  currencyRates: "currencyRates",
  passwordResetTokens: "passwordResetTokens"
} as const;

export async function ensureCoreIndexes() {
  const db = await getDb();
  await Promise.all([
    db.collection(collections.users).createIndex({ email: 1 }, { unique: true }),
    db.collection(collections.accounts).createIndex({ userId: 1, isDefault: -1 }),
    db.collection(collections.expenses).createIndex({ accountId: 1, spentAt: -1 }),
    db.collection(collections.expenses).createIndex({ accountId: 1, clientMutationId: 1 }, { unique: true, sparse: true }),
    db.collection(collections.recurringRules).createIndex({ accountId: 1, status: 1, nextRunAt: 1 }),
    db.collection(collections.budgets).createIndex({ accountId: 1, categoryId: 1 }),
    db.collection(collections.trips).createIndex({ accountId: 1, startsAt: -1 }),
    db.collection(collections.parties).createIndex({ accountId: 1, createdAt: -1 }),
    db.collection(collections.splits).createIndex({ accountId: 1, partyId: 1, status: 1 }),
    db.collection(collections.settlements).createIndex({ accountId: 1, partyId: 1, status: 1 }),
    db.collection(collections.importBatches).createIndex({ accountId: 1, createdAt: -1 }),
    db.collection(collections.importRows).createIndex({ accountId: 1, batchId: 1, status: 1 }),
    db.collection(collections.importRows).createIndex({ accountId: 1, duplicateKey: 1 }),
    db.collection(collections.notifications).createIndex({ accountId: 1, userId: 1, createdAt: -1 }),
    db.collection(collections.currencyRates).createIndex({ from: 1, to: 1, provider: 1 }, { unique: true }),
  ]);
}
