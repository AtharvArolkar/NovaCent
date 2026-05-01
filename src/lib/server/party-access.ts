type PartyAccessQueryInput = {
  partyId?: string;
  selectedAccountId?: string | null;
  userId?: string | null;
};

export function partyAccessQuery(input: PartyAccessQueryInput) {
  const clauses: Record<string, unknown>[] = [];

  if (input.selectedAccountId) {
    clauses.push({ accountId: input.selectedAccountId });
    clauses.push({ "participants.accountId": input.selectedAccountId });
  }

  if (input.userId) {
    clauses.push({ "participants.userId": input.userId });
  }

  const query: Record<string, unknown> = {};
  if (input.partyId) {
    query.id = input.partyId;
  }

  if (!clauses.length) {
    query.id = "__no_party_access__";
    return query;
  }

  query.$or = clauses;
  return query;
}

export function partyAccountIds(party: unknown) {
  const record = typeof party === "object" && party ? party as { accountId?: unknown; participants?: unknown } : {};
  const participants = Array.isArray(record.participants) ? record.participants : [];
  return Array.from(
    new Set(
      [
        record.accountId,
        ...participants.map((participant) =>
          typeof participant === "object" && participant ? (participant as { accountId?: unknown }).accountId : undefined
        )
      ].filter((accountId): accountId is string => typeof accountId === "string" && accountId.length > 0)
    )
  );
}
