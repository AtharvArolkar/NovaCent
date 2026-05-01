import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { createNotification } from "@/lib/server/notifications";
import { created, handleApiError, ok, problem } from "@/lib/server/http";
import { settlementSchema } from "@/lib/server/schemas";

interface RouteContext {
  params: Promise<{ partyId: string }> | { partyId: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { partyId } = await context.params;
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const party = await db.collection(collections.parties).findOne({ id: partyId, accountId });

    if (!party) {
      return problem("Party was not found.", 404);
    }

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
    const { accountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = settlementSchema.parse(await request.json());
    const db = await getDb();
    const party = await db.collection(collections.parties).findOne({ id: partyId, accountId });

    if (!party) {
      return problem("Party was not found.", 404);
    }

    const participant = (party.participants ?? []).find((item: { id: string }) => item.id === payload.participantId);
    if (!participant) {
      return problem("Settlement participant is not part of this party.", 422);
    }

    if (participant.kind !== payload.participantKind) {
      return problem("Settlement participant kind does not match party participant.", 422);
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

    const requiresApproval = payload.participantKind === "registered";
    const now = new Date().toISOString();
    const settlement = {
      id: crypto.randomUUID(),
      accountId,
      partyId,
      splitId: payload.splitId,
      participantId: payload.participantId,
      participantKind: payload.participantKind,
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
    await createNotification({
      accountId,
      userId: user.id,
      title: requiresApproval ? "Settlement pending approval" : "Settlement recorded",
      body: requiresApproval ? "A registered participant settlement is waiting for approval." : "An external participant settlement was recorded directly.",
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
