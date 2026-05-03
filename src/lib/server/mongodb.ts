import { MongoClient, type Collection, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "novacent";

declare global {
  // eslint-disable-next-line no-var
  var __rupeeFlowMongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var __rupeeFlowMongoIndexesPromise: Promise<void> | undefined;
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
  const db = client.db(dbName);
  startCoreIndexBuild(db);
  return db;
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
  supportRequests: "supportRequests",
  trips: "trips",
  parties: "parties",
  splits: "splits",
  settlements: "settlements",
  importBatches: "importBatches",
  importRows: "importRows",
  currencyRates: "currencyRates",
  passwordResetTokens: "passwordResetTokens"
} as const;

function startCoreIndexBuild(db: Db) {
  if (!global.__rupeeFlowMongoIndexesPromise) {
    global.__rupeeFlowMongoIndexesPromise = ensureCoreIndexesForDb(db).catch((error) => {
      console.error("Unable to ensure MongoDB indexes", error);
      global.__rupeeFlowMongoIndexesPromise = undefined;
    });
  }
}

function optionalStringUniqueIndexName(field: string) {
  return `expenses_account_${field}_unique_string`;
}

function isOptionalStringUniqueIndex(index: { key?: Record<string, unknown>; unique?: boolean; partialFilterExpression?: Record<string, unknown> }, field: string) {
  const filter = index.partialFilterExpression?.[field];
  return (
    index.unique === true &&
    index.key?.accountId === 1 &&
    index.key?.[field] === 1 &&
    typeof filter === "object" &&
    filter !== null &&
    "$type" in filter &&
    (filter as { $type?: unknown }).$type === "string"
  );
}

function hasOptionalIndexKey(index: { key?: Record<string, unknown> }, field: string) {
  return index.key?.accountId === 1 && index.key?.[field] === 1;
}

function isIndexNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    ("codeName" in error || "code" in error) &&
    ((error as { codeName?: string }).codeName === "IndexNotFound" || (error as { code?: number }).code === 27)
  );
}

async function dropIndexIfExists(collection: Collection, indexName: string) {
  try {
    await collection.dropIndex(indexName);
  } catch (error) {
    if (!isIndexNotFound(error)) {
      throw error;
    }
  }
}

async function ensureOptionalStringUniqueIndex(collection: Collection, field: string) {
  const desiredName = optionalStringUniqueIndexName(field);
  const indexes = await collection.indexes();
  const existingDesiredIndex = indexes.find((index) => isOptionalStringUniqueIndex(index, field));

  if (existingDesiredIndex) {
    return;
  }

  const staleIndexes = indexes.filter((index) => index.name && hasOptionalIndexKey(index, field));
  for (const index of staleIndexes) {
    await dropIndexIfExists(collection, String(index.name));
  }

  await collection.createIndex(
    { accountId: 1, [field]: 1 },
    {
      name: desiredName,
      unique: true,
      partialFilterExpression: {
        [field]: { $type: "string" }
      }
    }
  );
}

async function ensureCoreIndexesForDb(db: Db) {
  const expensesCollection = db.collection(collections.expenses);
  await Promise.all([
    db.collection(collections.users).createIndex({ email: 1 }, { unique: true }),
    db.collection(collections.accounts).createIndex({ userId: 1, isDefault: -1 }),
    expensesCollection.createIndex({ accountId: 1, spentAt: -1 }),
    expensesCollection.createIndex({ accountId: 1, excludeFromLedger: 1, spentAt: -1, createdAt: -1 }),
    expensesCollection.createIndex({ accountId: 1, categoryId: 1, spentAt: -1 }),
    expensesCollection.createIndex({ accountId: 1, categoryName: 1, spentAt: -1 }),
    expensesCollection.createIndex({ accountId: 1, partyId: 1, spentAt: -1 }),
    expensesCollection.createIndex({ accountId: 1, duplicateKey: 1 }),
    ensureOptionalStringUniqueIndex(expensesCollection, "importRowId"),
    ensureOptionalStringUniqueIndex(expensesCollection, "clientMutationId"),
    db.collection(collections.recurringRules).createIndex({ accountId: 1, status: 1, nextRunAt: 1 }),
    db.collection(collections.budgets).createIndex({ accountId: 1, period: 1, categoryId: 1 }),
    db.collection(collections.trips).createIndex({ accountId: 1, startsAt: -1 }),
    db.collection(collections.parties).createIndex({ accountId: 1, createdAt: -1 }),
    db.collection(collections.splits).createIndex({ accountId: 1, partyId: 1, status: 1 }),
    db.collection(collections.settlements).createIndex({ accountId: 1, partyId: 1, status: 1 }),
    db.collection(collections.importBatches).createIndex({ accountId: 1, id: 1 }, { unique: true }),
    db.collection(collections.importBatches).createIndex({ accountId: 1, createdAt: -1 }),
    db.collection(collections.importRows).createIndex({ accountId: 1, id: 1 }, { unique: true }),
    db.collection(collections.importRows).createIndex({ accountId: 1, batchId: 1, status: 1 }),
    db.collection(collections.importRows).createIndex({ accountId: 1, status: 1, createdAt: -1 }),
    db.collection(collections.importRows).createIndex({ accountId: 1, duplicateKey: 1 }),
    db.collection(collections.notifications).createIndex({ accountId: 1, userId: 1, createdAt: -1 }),
    db.collection(collections.notifications).createIndex({ accountId: 1, createdAt: -1 }),
    db.collection(collections.supportRequests).createIndex({ accountId: 1, userId: 1, createdAt: -1 }),
    db.collection(collections.currencyRates).createIndex({ from: 1, to: 1, provider: 1 }, { unique: true }),
  ]);
}

export async function ensureCoreIndexes() {
  const client = await getMongoClient();
  await ensureCoreIndexesForDb(client.db(dbName));
}
