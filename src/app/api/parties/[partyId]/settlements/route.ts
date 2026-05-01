import { accountIdFromRequest, getCurrentUser, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { createNotification } from "@/lib/server/notifications";
import { created, handleApiError, ok, problem } from "@/lib/server/http";
import { settlementSchema } from "@/lib/server/schemas";
import { partyAccessQuery } from "@/lib/server/party-access";
import { recordSettlementLedgerEntries } from "@/lib/server/settlement-ledger";

interface RouteContext {
  params: Promise<{ partyId: string }> | { partyId: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const { accountId: selectedAccountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const party = await db.collection(collections.parties).findOne(partyAccessQuery({ partyId, selectedAccountId, userId: user.id }));

    if (!party) {
      return problem("Party was not found.", 404);
    }

    const accountId = party.accountId;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const query: Record<string, unknown> = { accountId, partyId };
    if (status) {
      query.status = status;
    }

    const settlements = await db.collection(collections.settlements).find(query).sort({ requestedAt: -1 }).toArray();
    return ok({ settlements });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const requestedAccountId = accountIdFromRequest(request);
    const user = await getCurrentUser();
    const payload = settlementSchema.parse(await request.json());
    const db = await getDb();
    const directAccount = requestedAccountId ? await requireAccountAccess(requestedAccountId).catch(() => null) : null;
    const party = await db.collection(collections.parties).findOne(
      partyAccessQuery({
        partyId,
        selectedAccountId: directAccount?.accountId,
        userId: user.id
      })
    );

    if (!party) {
      return problem("Party was not found.", 404);
    }

    const accountId = party.accountId;
    const participant = (party.participants ?? []).find((item: { id: string }) => item.id === payload.participantId);
    if (!participant) {
      return problem("Settlement participant is not part of this party.", 422);
    }

    if (participant.kind !== payload.participantKind) {
      return problem("Settlement participant kind does not match party participant.", 422);
    }

    const actorIsParticipant = participant.userId === user.id || participant.accountId === directAccount?.accountId;
    const ownerSettlingExternal = directAccount?.accountId === accountId && participant.kind === "external";
    if (!actorIsParticipant && !ownerSettlingExternal) {
      return problem("You cannot mark this participant settled.", 403);
    }

    const split = await db.collection(collections.splits).findOne({
      id: payload.splitId,
      accountId,
      partyId,
      participantId: payload.participantId,
      status: { $ne: "settled" }
    });
    if (!split) {
      return problem("Open split was not found.", 404);
    }

    const approvalParticipant = (party.participants ?? []).find((item: { id: string }) => item.id === split.paidByParticipantId);
    const requiresApproval = payload.participantKind === "registered" && approvalParticipant?.kind === "registered";
    const approvalAccountId = approvalParticipant?.accountId ?? accountId;
    const approvalUserId = approvalParticipant?.userId ?? user.id;
    const now = new Date().toISOString();
    const settlement = {
      id: crypto.randomUUID(),
      accountId,
      partyId,
      splitId: payload.splitId,
      participantId: payload.participantId,
      participantKind: payload.participantKind,
      requestedByUserId: user.id,
      approvalParticipantId: approvalParticipant?.id,
      approvalUserId: requiresApproval ? approvalUserId : undefined,
      amount: payload.amount,
      requiresApproval,
      status: requiresApproval ? "pending_approval" : "settled",
      requestedAt: now,
      approvedAt: requiresApproval ? undefined : now,
      approvalReason: payload.approvalReason
    };
    await db.collection(collections.settlements).insertOne(settlement);
    await db.collection(collections.splits).updateOne(
      { id: payload.splitId, accountId, partyId },
      { $set: { status: requiresApproval ? "settlement_pending" : "settled", updatedAt: now } }
    );
    if (!requiresApproval) {
      const ledgerEntries = await recordSettlementLedgerEntries({ db, party, split, settlement });
      if (ledgerEntries.length) {
        await db.collection(collections.settlements).updateOne(
          { id: settlement.id, accountId, partyId },
          { $set: { ledgerExpenseIds: ledgerEntries.map((entry) => entry.id) } }
        );
      }
    }
    await createNotification({
      accountId: requiresApproval ? approvalAccountId : accountId,
      userId: requiresApproval ? approvalUserId : user.id,
      title: requiresApproval ? "Settlement pending approval" : "Settlement recorded",
      body: requiresApproval
        ? `${participant.displayName ?? "A registered participant"} marked a split as settled. Please review it.`
        : "An external participant settlement was recorded directly.",
      tone: requiresApproval ? "info" : "success",
      eventType: "settlement",
      entityType: "settlement",
      entityId: settlement.id
    });
    return created({ settlement });
  } catch (error) {
    return handleApiError(error);
  }
}
