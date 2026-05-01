import { z } from "zod";
import { appConfig } from "@/lib/app-config";

export const objectIdLike = z.string().min(1);

export const moneySchema = z.object({
  amount: z.coerce.number().finite().nonnegative(),
  currency: z.string().min(3).max(8).transform((value) => value.toUpperCase())
});

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128)
});

export const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

export const accountSchema = z.object({
  name: z.string().min(2).max(120),
  baseCurrency: z.string().min(3).max(8).default(appConfig.baseCurrency)
});

export const expenseSchema = z.object({
  merchant: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
  categoryId: z.string().min(1),
  categoryName: z.string().min(1).max(80),
  original: moneySchema,
  spentAt: z.string().min(8),
  notes: z.string().max(1000).optional(),
  source: z.enum(["manual", "recurring", "import", "trip", "party"]).default("manual"),
  tripId: z.string().optional(),
  partyId: z.string().optional(),
  recurringRuleId: z.string().optional(),
  clientMutationId: z.string().optional()
});

export const recurringExpenseSchema = z.object({
  merchant: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
  categoryId: z.string().min(1),
  categoryName: z.string().min(1).max(80),
  original: moneySchema,
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.coerce.number().int().min(1).max(36).default(1),
  startsAt: z.string().min(8),
  endsAt: z.string().min(8).optional(),
  nextRunAt: z.string().min(8).optional(),
  autoCreate: z.coerce.boolean().default(false),
  notes: z.string().max(1000).optional()
});

export const recurringExpensePatchSchema = recurringExpenseSchema.partial().extend({
  status: z.enum(["active", "paused", "ended"]).optional()
});

export const recurringExpenseRunSchema = z.object({
  spentAt: z.string().min(8).optional()
});

export const budgetSchema = z.object({
  categoryId: z.string().min(1),
  categoryName: z.string().min(1).max(80),
  limit: moneySchema,
  alertThreshold: z.coerce.number().min(1).max(100).default(appConfig.defaultBudgetAlertThreshold)
});

export const categoryRuleSchema = z.object({
  pattern: z.string().min(2).max(120),
  categoryId: z.string().min(1),
  categoryName: z.string().min(1).max(80)
});

export const tripSchema = z.object({
  name: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  startsAt: z.string().min(8),
  endsAt: z.string().optional(),
  baseCurrency: z.string().min(3).max(8).default(appConfig.baseCurrency),
  participantCount: z.coerce.number().int().min(1).default(1)
});

export const partyParticipantSchema = z.object({
  kind: z.enum(["registered", "external"]),
  displayName: z.string().min(1).max(120),
  userId: z.string().optional(),
  accountId: z.string().optional()
});

export const partySchema = z.object({
  name: z.string().min(2).max(120),
  participants: z.array(partyParticipantSchema).min(1)
});

export const settlementSchema = z.object({
  splitId: z.string().min(1),
  participantId: z.string().min(1),
  participantKind: z.enum(["registered", "external"]),
  amount: moneySchema,
  approvalReason: z.string().max(500).optional()
});

export const splitSchema = z.object({
  expenseId: z.string().min(1),
  splits: z.array(z.object({
    participantId: z.string().min(1),
    amount: moneySchema
  })).min(1)
});

export const settlementApprovalSchema = z.object({
  action: z.enum(["approve", "reject"]).default("approve"),
  reason: z.string().max(500).optional()
});

export const importRowReviewSchema = z.object({
  rowId: z.string().min(1),
  action: z.enum(["approve", "delete"]),
  merchant: z.string().min(1).optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  spentAt: z.string().optional(),
  original: moneySchema.optional(),
  confirmDuplicate: z.coerce.boolean().default(false),
  overrideReason: z.string().max(500).optional()
});

export const importApproveSchema = z.object({
  rows: z.array(importRowReviewSchema)
});

export const resetRequestSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase())
});

export const resetPasswordSchema = z.object({
  token: z.string().min(24),
  password: z.string().min(8).max(128)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128)
});
