import type { Db } from "mongodb";

import type { Account, Party, PartyParticipant, UserProfile } from "@/lib/domain";
import { collections } from "@/lib/server/mongodb";

export async function ensurePartyOwnerParticipant(db: Db, party: Party): Promise<Party> {
  const participants = party.participants ?? [];
  const account = await db.collection<Account>(collections.accounts).findOne({ id: party.accountId });
  if (participants.some((participant) => participant.accountId === party.accountId || (account?.userId && participant.userId === account.userId))) {
    return party;
  }

  const owner = account?.userId ? await db.collection<UserProfile>(collections.users).findOne({ id: account.userId }) : null;
  const ownerParticipant: PartyParticipant = {
    id: crypto.randomUUID(),
    partyId: party.id,
    kind: "registered",
    displayName: owner?.name ?? account?.name ?? "Party owner",
    userId: account?.userId,
    accountId: party.accountId,
    email: owner?.email
  };
  const nextParty = {
    ...party,
    participants: [ownerParticipant, ...participants],
    updatedAt: new Date().toISOString()
  };

  await db.collection(collections.parties).updateOne(
    { id: party.id, accountId: party.accountId },
    { $set: { participants: nextParty.participants, updatedAt: nextParty.updatedAt } }
  );

  return nextParty;
}
