import type { Db } from "mongodb";
import type { Party, PartyParticipant, Split } from "@/lib/domain";
import { collections } from "@/lib/server/mongodb";

type PartyWithParticipants = Pick<Party, "id" | "name" | "participants">;

function amountLabel(split: Split) {
  return `${split.amount.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${split.amount.currency}`;
}

async function accountFallbacksForParticipants(db: Db, participants: PartyParticipant[]) {
  const missingAccountUserIds = participants
    .filter((participant) => participant.kind === "registered" && !participant.accountId && participant.userId)
    .map((participant) => participant.userId as string);

  if (!missingAccountUserIds.length) {
    return new Map<string, string>();
  }

  const users = await db.collection(collections.users)
    .find({ id: { $in: Array.from(new Set(missingAccountUserIds)) } })
    .project<{ id: string; defaultAccountId?: string }>({ id: 1, defaultAccountId: 1 })
    .toArray();

  return new Map(users.filter((user) => user.defaultAccountId).map((user) => [user.id, user.defaultAccountId as string]));
}

export async function notifyPartySplitParticipants(input: {
  db: Db;
  party: PartyWithParticipants;
  splits: Split[];
  actorUserId: string;
  actorAccountId: string;
  merchant?: string;
}) {
  if (!input.splits.length) {
    return;
  }

  const participantById = new Map((input.party.participants ?? []).map((participant) => [participant.id, participant]));
  const participantSplits = new Map<string, Split[]>();

  for (const split of input.splits) {
    participantSplits.set(split.participantId, [...(participantSplits.get(split.participantId) ?? []), split]);
  }

  const participantsToNotify = Array.from(participantSplits.keys())
    .map((participantId) => participantById.get(participantId))
    .filter((participant): participant is PartyParticipant => participant !== undefined && participant.kind === "registered")
    .filter((participant) => participant.userId !== input.actorUserId && participant.accountId !== input.actorAccountId);
  const accountFallbacks = await accountFallbacksForParticipants(input.db, participantsToNotify);
  const now = new Date().toISOString();
  const notifications = participantsToNotify.flatMap((participant) => {
    const accountId = participant.accountId ?? (participant.userId ? accountFallbacks.get(participant.userId) : undefined);
    const splits = participantSplits.get(participant.id) ?? [];
    if (!accountId || !splits.length) {
      return [];
    }

    const body = splits.length === 1
      ? `You have a new split in ${input.party.name}${input.merchant ? ` for ${input.merchant}` : ""}: ${amountLabel(splits[0])}.`
      : `You have ${splits.length} new splits in ${input.party.name}.`;

    return [{
      id: crypto.randomUUID(),
      accountId,
      userId: participant.userId,
      title: "New party split added",
      body,
      tone: "info" as const,
      read: false,
      eventType: "party_split",
      entityType: "party",
      entityId: input.party.id,
      createdAt: now
    }];
  });

  if (notifications.length) {
    await input.db.collection(collections.notifications).insertMany(notifications, { ordered: false });
  }
}
