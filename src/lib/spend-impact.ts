export type SpendImpactInput = {
  source?: string;
  merchant?: string;
  description?: string;
  notes?: string;
  categoryName?: string;
  category?: string;
};

const ignoredImportedTransferKeywords = [
  "self transfer",
  "own transfer",
  "own account",
  "own acct",
  "between own accounts",
  "internal transfer",
  "account transfer",
  "transfer from self",
  "transfer to self",
  "upi self",
  "auto sweep",
  "sweep in",
  "sweep out",
  "sweep transfer",
  "fixed deposit",
  "fd maturity",
  "fd closure",
  "rd maturity",
  "maturity proceeds",
  "wallet load",
  "wallet topup",
  "mutual fund redemption",
  "mf redemption",
  "investment redemption"
];

const ignoredImportedCreditKeywords = [
  "salary",
  "payroll",
  "wage",
  "wages",
  "stipend",
  "bonus",
  "incentive",
  "pension",
  "dividend",
  "interest credit",
  "interest paid"
];

function normalizedText(input: SpendImpactInput) {
  return [
    input.merchant,
    input.description,
    input.notes,
    input.categoryName,
    input.category
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isIgnoredImportedCashflow(input: SpendImpactInput, signedAmount: number) {
  if (input.source !== "import") {
    return false;
  }

  const text = normalizedText(input);
  if (!text) {
    return false;
  }

  if (ignoredImportedTransferKeywords.some((keyword) => text.includes(keyword))) {
    return true;
  }

  return signedAmount < 0 && ignoredImportedCreditKeywords.some((keyword) => text.includes(keyword));
}

export function spendImpactForSignedAmount(signedAmount: number, input: SpendImpactInput) {
  if (!Number.isFinite(signedAmount)) {
    return 0;
  }

  if (input.source === "settlement") {
    return signedAmount;
  }

  if (isIgnoredImportedCashflow(input, signedAmount)) {
    return 0;
  }

  if (input.source === "import") {
    return signedAmount;
  }

  return Math.max(signedAmount, 0);
}
