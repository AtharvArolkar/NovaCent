import type { Db } from "mongodb";
import type { Expense, Money, PartyParticipant } from "@/lib/domain";
import { convertToBase } from "@/lib/server/currency";
import { collections } from "@/lib/server/mongodb";

type StoredParty = {
  id?: string;
  name?: string;
  participants?: PartyParticipant[];
  [key: string]: unknown;
};

type StoredSplit = {
  id?: string;
  partyId?: string;
  expenseId?: string;
  paidByParticipantId?: string;
  participantId?: string;
  amount?: Money;
  [key: string]: unknown;
};

type StoredSettlement = {
  id?: string;
  partyId?: string;
  splitId?: string;
  participantId?: string;
  amount?: Money;
  status?: string;
  approvedAt?: string;
  requestedAt?: string;
  [key: string]: unknown;
};

function settlementExpenseBase(input: {
  accountId: string;
  original: Money;
  base: Money;
  exchangeRate?: Awaited<ReturnType<typeof convertToBase>>["exchangeRate"];
  merchant: string;
  categoryId: string;
  categoryName: string;
  partyId: string;
  splitId: string;
  settlementId: string;
  spentAt: string;
}) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    accountId: input.accountId,
    source: "settlement" as const,
    merchant: input.merchant,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    original: input.original,
    base: input.base,
    exchangeRate: input.exchangeRate,
    spentAt: input.spentAt,
    partyId: input.partyId,
    splitId: input.splitId,
    settlementId: input.settlementId,
    syncStatus: "synced" as const,
    duplicateKey: `settlement:${input.settlementId}:${input.accountId}:${input.categoryId}`,
    createdAt: now,
    updatedAt: now
  } satisfies Expense & { duplicateKey: string };
}

async function ledgerEntryFor(input: {
  db: Db;
  participant: PartyParticipant;
  original: Money;
  merchant: string;
  categoryId: string;
  categoryName: string;
  partyId: string;
  splitId: string;
  settlementId: string;
  spentAt: string;
}) {
  if (input.participant.kind !== "registered" || !input.participant.accountId) {
    return null;
  }

  const account = await input.db.collection(collections.accounts).findOne({ id: input.participant.accountId });
  if (!account?.baseCurrency) {
    return null;
  }

  const conversion = await convertToBase(input.original, account.baseCurrency);
  return settlementExpenseBase({
    accountId: input.participant.accountId,
    original: input.original,
    base: conversion.base,
    exchangeRate: conversion.exchangeRate,
    merchant: input.merchant,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    partyId: input.partyId,
    splitId: input.splitId,
    settlementId: input.settlementId,
    spentAt: input.spentAt
  });
}

export async function recordSettlementLedgerEntries(input: { db: Db; party: StoredParty; split: StoredSplit; settlement: StoredSettlement }) {
  if (!input.settlement.id || !input.settlement.amount || !input.split.id || !input.split.participantId) {
    return [];
  }

  const existing = await input.db.collection(collections.expenses).findOne({ settlementId: input.settlement.id });
  if (existing) {
    return [];
  }

  const participants = input.party.participants ?? [];
  const debtor = participants.find((participant) => participant.id === input.split.participantId);
  const receiver = participants.find((participant) => participant.id === input.split.paidByParticipantId);

  if (!debtor || !receiver) {
    return [];
  }

  const spentAt = input.settlement.approvedAt ?? input.settlement.requestedAt ?? new Date().toISOString();
  const entries = await Promise.all([
    ledgerEntryFor({
      db: input.db,
      participant: debtor,
      original: input.settlement.amount,
      merchant: `Settlement paid to ${receiver.displayName}`,
      categoryId: "cat-party-settlements",
      categoryName: "Party settlements",
      partyId: input.party.id ?? input.split.partyId ?? input.settlement.partyId ?? "",
      splitId: input.split.id,
      settlementId: input.settlement.id,
      spentAt
    }),
    ledgerEntryFor({
      db: input.db,
      participant: receiver,
      original: { amount: -input.settlement.amount.amount, currency: input.settlement.amount.currency },
      merchant: `Reimbursement from ${debtor.displayName}`,
      categoryId: "cat-reimbursements",
      categoryName: "Reimbursements",
      partyId: input.party.id ?? input.split.partyId ?? input.settlement.partyId ?? "",
      splitId: input.split.id,
      settlementId: input.settlement.id,
      spentAt
    })
  ]);

  const ledgerEntries = entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (ledgerEntries.length) {
    await input.db.collection(collections.expenses).insertMany(ledgerEntries);
  }

  return ledgerEntries;
}
