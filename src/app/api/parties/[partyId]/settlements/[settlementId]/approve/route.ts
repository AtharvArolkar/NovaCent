import { accountIdFromRequest, getCurrentUser, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { createNotification } from "@/lib/server/notifications";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { partyAccessQuery } from "@/lib/server/party-access";
import { settlementApprovalSchema } from "@/lib/server/schemas";
import { recordSettlementLedgerEntries } from "@/lib/server/settlement-ledger";

interface RouteContext {
  params: Promise<{ partyId: string; settlementId: string }> | { partyId: string; settlementId: string };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { partyId, settlementId } = await context.params;
    const requestedAccountId = accountIdFromRequest(request);
    const user = await getCurrentUser();
    const payload = settlementApprovalSchema.parse(await request.json().catch(() => ({})));
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
    const settlement = await db.collection(collections.settlements).findOne({ id: settlementId, accountId, partyId, status: "pending_approval" });
    if (!settlement) {
      return problem("Pending settlement was not found.", 404);
    }
    const approvalParticipant = (party.participants ?? []).find((participant: { id: string }) => participant.id === settlement.approvalParticipantId);
    const participantCanApprove = approvalParticipant?.userId === user.id || approvalParticipant?.accountId === directAccount?.accountId;
    const legacyOwnerApproval = directAccount?.accountId === accountId && !settlement.approvalParticipantId;
    if (!participantCanApprove && !legacyOwnerApproval) {
      return problem("You cannot approve this settlement.", 403);
    }

    const now = new Date().toISOString();
    const nextStatus = payload.action === "reject" ? "rejected" : "settled";
    const split = await db.collection(collections.splits).findOne({ id: settlement.splitId, accountId, partyId });
    if (!split) {
      return problem("Settlement split was not found.", 404);
    }

    await db.collection(collections.settlements).updateOne(
      { id: settlementId, accountId, partyId, status: "pending_approval" },
      {
        $set: {
          status: nextStatus,
          approvedAt: payload.action === "approve" ? now : undefined,
          rejectedAt: payload.action === "reject" ? now : undefined,
          approvalReason: payload.reason
        }
      }
    );
    await db.collection(collections.splits).updateOne(
      { id: settlement.splitId, accountId, partyId },
      { $set: { status: payload.action === "approve" ? "settled" : "open", updatedAt: now } }
    );
    if (payload.action === "approve") {
      const ledgerEntries = await recordSettlementLedgerEntries({ db, party, split, settlement: { ...settlement, status: nextStatus, approvedAt: now } });
      if (ledgerEntries.length) {
        await db.collection(collections.settlements).updateOne(
          { id: settlementId, accountId, partyId },
          { $set: { ledgerExpenseIds: ledgerEntries.map((entry) => entry.id) } }
        );
      }
    }
    await createNotification({
      accountId,
      userId: user.id,
      title: payload.action === "approve" ? "Settlement approved" : "Settlement rejected",
      body: payload.action === "approve" ? "A registered participant settlement was approved." : "A registered participant settlement was rejected.",
      tone: payload.action === "approve" ? "success" : "warning",
      eventType: "settlement",
      entityType: "settlement",
      entityId: settlementId
    });

    return ok({ settlementId, status: nextStatus });
  } catch (error) {
    return handleApiError(error);
  }
}
