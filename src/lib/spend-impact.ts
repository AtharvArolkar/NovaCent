export type SpendImpactInput = {
  source?: string;
  merchant?: string;
  description?: string;
  notes?: string;
  categoryName?: string;
  category?: string;
  moneyFlowType?: MoneyFlowType;
};

export type MoneyFlowType = "spend" | "income" | "transfer" | "investment";

export const investmentCategoryNames = [
  "Investments",
  "Mutual Funds",
  "Stocks",
  "Postal Investments",
  "Insurance Investments",
  "PPF/NPS",
  "Fixed Deposits",
  "Recurring Deposits",
  "Bonds",
  "Gold",
  "Crypto",
  "Other Investments"
] as const;

const investmentCategorySet = new Set(investmentCategoryNames.map((category) => category.toLowerCase()));

export function isInvestmentCategoryName(categoryName?: string) {
  return Boolean(categoryName && investmentCategorySet.has(categoryName.trim().toLowerCase()));
}

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

const mutualFundKeywordPatterns = [
  /\bmutual\s*funds?\b/i,
  /\bmf\b/i,
  /\bsip\b/i,
  /\bxsip\b/i,
  /\bsystematic\s+investment\b/i,
  /\bamc\b/i,
  /\bfolio\b/i,
  /\bbse\s*star\s*mf\b/i,
  /\bbsestarmf\b/i,
  /\bstar\s*mf\b/i,
  /\bnse\s*nmf\b/i,
  /\bnmf\s*ii\b/i,
  /\bnse\s*mfss\b/i,
  /\bmutual\s+funds?\s+service\s+system\b/i,
  /\bmf\s*utility\b/i,
  /\bmfu\b/i,
  /\bmf\s+utilities\s+india\b/i,
  /\bfunds?\s*india\b/i,
  /\b(?:computer\s+age\s+management\s+services|cams(?:\s*online)?)\b/i,
  /\bkfin(?:tech|ologies)?\b/i,
  /\bkfin\s+technologies\b/i,
  /\bkarvy\b/i,
  /\bindian\s+clearing\s+corp(?:oration)?(?:\s+(?:ltd|limited))?\b/i,
  /\biccl\b/i,
  /\bnj\s+india\b/i,
  /\bprudent\s+corporate\b/i,
  /\bclearfunds\b/i,
  /\bkuvera\b/i,
  /\bet\s*money\b/i,
  /\bscripbox\b/i,
  /\bindmoney\b/i,
  /\bppfas\b/i,
  /\bparag\s+parikh\b/i,
  /\b360\s*one\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\biifl\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\baditya\s+birla\s+sun\s+life\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\baxis\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bbajaj\s+finserv\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bbandhan\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bidfc\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bbank\s+of\s+india\s+(?:mutual|mf|investment\s+managers|asset\s+management|amc)\b/i,
  /\bboi\s+axa\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bbaroda\s+(?:bnp\s+paribas|pioneer)\s+(?:mutual|mf|asset\s+management|amc)?\b/i,
  /\bcanara\s+robeco\b/i,
  /\bdsp\s+(?:mutual|mf|asset\s+managers?|blackrock)\b/i,
  /\bedelweiss\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bfranklin\s+templeton\b/i,
  /\bgroww\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bhdfc\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bhelios\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bhsbc\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bicici\s+(?:prudential|pru)\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bil&?fs\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\binvesco\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\biti\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bjio\s*blackrock\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bjm\s+financial\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bkotak\s+mahindra\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\blic\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bmahindra\s+manulife\b/i,
  /\bmirae\s+asset\b/i,
  /\bmotilal\s+oswal\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bnavi\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bnippon\s+india\b/i,
  /\bnj\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bold\s+bridge\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bpgim\s+india\b/i,
  /\bquant\s+(?:mutual|mf|money\s+managers)\b/i,
  /\bquantum\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bsamco\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bsbi\s+(?:mutual|mf|funds?\s+management|asset\s+management|amc)\b/i,
  /\bshriram\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bsundaram\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\btata\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\btaurus\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\btrust\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bunion\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\buti\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bwhite\s*oak\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bzerodha\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\babakkus\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bcapitalmind\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bchoice\s+(?:mutual|mf|asset\s+management|amc)\b/i,
  /\bunifi\s+(?:mutual|mf|asset\s+management|amc)\b/i
];

export function suggestedInvestmentCategoryForText(input: SpendImpactInput) {
  const text = normalizedText(input);
  if (!text || investmentExclusionKeywords.some((keyword) => text.includes(keyword))) {
    return undefined;
  }

  if (mutualFundKeywordPatterns.some((pattern) => pattern.test(text))) {
    return "Mutual Funds";
  }

  if (/\b(zerodha|groww|upstox|angel\s*(?:one|broking)?|5\s*paisa|sharekhan|motilal\s+oswal|hdfc\s+securities|icici\s+direct|kotak\s+securities|dhan|fyers|paytm\s+money|demat|nsdl|cdsl|trading|broking|stocks?|shares?|equit(?:y|ies)|ipo|asba|right(?:s)?\s+issue|smallcase)\b/i.test(text)) {
    return "Stocks";
  }

  if (/\b(post\s+office|postal|nsc|national\s+savings\s+certificate|kvp|kisan\s+vikas\s+patra|scss|senior\s+citizens?\s+savings?\s+scheme|sukanya|ssa|monthly\s+income\s+scheme|po\s*mis)\b/i.test(text)) {
    return "Postal Investments";
  }

  if (/\b(lic|ulip|endowment|life\s+insurance|policy\s+premium|insurance\s+premium|pension\s+plan|hdfc\s+life|icici\s+prudential|sbi\s+life|max\s+life|tata\s+aia|bajaj\s+allianz\s+life|kotak\s+life|pnb\s+metlife)\b/i.test(text)) {
    return "Insurance Investments";
  }

  if (/\b(ppf|public\s+provident\s+fund|nps|national\s+pension|pran|protean|nsdl\s*e[- ]?gov|epf|vpf|provident\s+fund|apy|atal\s+pension)\b/i.test(text)) {
    return "PPF/NPS";
  }

  if (/\b(fixed\s+deposit|term\s+deposit|fd|fd\s+(?:booking|creation|opening))\b/i.test(text)) {
    return "Fixed Deposits";
  }

  if (/\b(recurring\s+deposit|rd|rd\s+(?:installment|instalment|booking))\b/i.test(text)) {
    return "Recurring Deposits";
  }

  if (/\b(bonds?|ncd|debenture|g[- ]?sec|t[- ]?bill|treasury\s+bill|rbi\s+bonds?|bharat\s+bond|reit|invit|pms|portfolio\s+management|aif|alternate\s+investment|wint\s+wealth|grip\s+invest|goldenpi)\b/i.test(text)) {
    return "Bonds";
  }

  if (/\b(sgb|sovereign\s+gold|digital\s+gold)\b/i.test(text)) {
    return "Gold";
  }

  if (/\b(crypto(?:currency)?|bitcoin|ethereum|coindcx|coinswitch|wazirx)\b/i.test(text)) {
    return "Crypto";
  }

  return undefined;
}

const investmentExclusionKeywords = [
  "loan",
  "emi",
  "mortgage",
  "home loan",
  "personal loan",
  "vehicle loan",
  "car loan",
  "bike loan",
  "education loan",
  "gold loan",
  "credit card",
  "cc payment",
  "card payment",
  "repayment",
  "installment",
  "instalment",
  "interest payment",
  "finance charge",
  "late fee",
  "processing fee",
  "dp charges",
  "demat charges",
  "brokerage charge",
  "brokerage charges",
  "annual maintenance charge",
  "health insurance",
  "medical insurance",
  "motor insurance",
  "vehicle insurance",
  "car insurance",
  "bike insurance",
  "two wheeler insurance",
  "travel insurance"
];

const investmentKeywordPatterns = [
  /\binvest(?:ment|ments|ed|ing)?\b/i,
  ...mutualFundKeywordPatterns,
  /\bnse\s+clearing\s+(?:ltd|limited)\b/i,
  /\bnational\s+securities\s+clearing\s+corp(?:oration)?(?:\s+(?:ltd|limited))?\b/i,
  /\bnsccl\b/i,
  /\bzerodha\b/i,
  /\bgroww\b/i,
  /\bupstox\b/i,
  /\bangel\s*(?:one|broking)?\b/i,
  /\b5\s*paisa\b/i,
  /\bsharekhan\b/i,
  /\bmotilal\s+oswal\b/i,
  /\bhdfc\s+securities\b/i,
  /\bicici\s+direct\b/i,
  /\bkotak\s+securities\b/i,
  /\bdhan\b/i,
  /\bfyers\b/i,
  /\bpaytm\s+money\b/i,
  /\bkuvera\b/i,
  /\bet\s*money\b/i,
  /\bscripbox\b/i,
  /\bindmoney\b/i,
  /\bsmallcase\b/i,
  /\bdemat\b/i,
  /\bnsdl\b/i,
  /\bcdsl\b/i,
  /\btrading\b/i,
  /\bbroking\b/i,
  /\bstocks?\b/i,
  /\bshares?\b/i,
  /\bequit(?:y|ies)\b/i,
  /\bipo\b/i,
  /\basba\b/i,
  /\bright(?:s)?\s+issue\b/i,
  /\bppf\b/i,
  /\bpublic\s+provident\s+fund\b/i,
  /\bnps\b/i,
  /\bnational\s+pension\b/i,
  /\bpran\b/i,
  /\bprotean\b/i,
  /\bnsdl\s*e[- ]?gov\b/i,
  /\bepf\b/i,
  /\bvpf\b/i,
  /\bprovident\s+fund\b/i,
  /\bapy\b/i,
  /\batal\s+pension\b/i,
  /\bfixed\s+deposit\b/i,
  /\bterm\s+deposit\b/i,
  /\bfd\b/i,
  /\bfd\s+(?:booking|creation|opening)\b/i,
  /\brecurring\s+deposit\b/i,
  /\brd\b/i,
  /\brd\s+(?:installment|instalment|booking)\b/i,
  /\bpost\s+office\b/i,
  /\bpostal\b/i,
  /\bnsc\b/i,
  /\bnational\s+savings\s+certificate\b/i,
  /\bkvp\b/i,
  /\bkisan\s+vikas\s+patra\b/i,
  /\bscss\b/i,
  /\bsenior\s+citizens?\s+savings?\s+scheme\b/i,
  /\bsukanya\b/i,
  /\bssa\b/i,
  /\bmonthly\s+income\s+scheme\b/i,
  /\bpo\s*mis\b/i,
  /\bbonds?\b/i,
  /\bncd\b/i,
  /\bdebenture\b/i,
  /\bg[- ]?sec\b/i,
  /\bt[- ]?bill\b/i,
  /\btreasury\s+bill\b/i,
  /\brbi\s+bonds?\b/i,
  /\bbharat\s+bond\b/i,
  /\bsgb\b/i,
  /\bsovereign\s+gold\b/i,
  /\bdigital\s+gold\b/i,
  /\breit\b/i,
  /\binvit\b/i,
  /\bpms\b/i,
  /\bportfolio\s+management\b/i,
  /\baif\b/i,
  /\balternate\s+investment\b/i,
  /\blic\b/i,
  /\bulip\b/i,
  /\bendowment\b/i,
  /\blife\s+insurance\b/i,
  /\bpolicy\s+premium\b/i,
  /\binsurance\s+premium\b/i,
  /\bpension\s+plan\b/i,
  /\bhdfc\s+life\b/i,
  /\bicici\s+prudential\b/i,
  /\bsbi\s+life\b/i,
  /\bmax\s+life\b/i,
  /\btata\s+aia\b/i,
  /\bbajaj\s+allianz\s+life\b/i,
  /\bkotak\s+life\b/i,
  /\bpnb\s+metlife\b/i,
  /\bcrypto(?:currency)?\b/i,
  /\bbitcoin\b/i,
  /\bethereum\b/i,
  /\bcoindcx\b/i,
  /\bcoinswitch\b/i,
  /\bwazirx\b/i,
  /\bwint\s+wealth\b/i,
  /\bgrip\s+invest\b/i,
  /\bgoldenpi\b/i
];

const investmentMandatePatterns = [
  /\bnach\b/i,
  /\becs\b/i,
  /\bmandate\b/i,
  /\bautopay\b/i,
  /\bupi\s+mandate\b/i
];

const investmentMandateContextPatterns = [
  /\bsip\b/i,
  /\bmf\b/i,
  /\bmutual\s*fund\b/i,
  /\bamc\b/i,
  /\bipo\b/i,
  /\basba\b/i,
  /\bnps\b/i,
  /\bppf\b/i,
  /\brd\b/i,
  /\bfd\b/i,
  /\binsurance\b/i,
  /\bpolicy\b/i
];

export function isInvestmentCashflow(input: SpendImpactInput) {
  if (input.moneyFlowType === "investment") {
    return true;
  }

  if (isInvestmentCategoryName(input.categoryName) || isInvestmentCategoryName(input.category)) {
    return true;
  }

  const text = normalizedText(input);
  if (!text) {
    return false;
  }

  if (investmentExclusionKeywords.some((keyword) => text.includes(keyword))) {
    return false;
  }

  if (investmentKeywordPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  return investmentMandatePatterns.some((pattern) => pattern.test(text)) &&
    investmentMandateContextPatterns.some((pattern) => pattern.test(text));
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

  if (isInvestmentCashflow(input)) {
    return 0;
  }

  if (isIgnoredImportedCashflow(input, signedAmount)) {
    return 0;
  }

  if (input.source === "import") {
    return signedAmount;
  }

  return Math.max(signedAmount, 0);
}

export function investmentAmountForSignedAmount(signedAmount: number, input: SpendImpactInput) {
  if (!Number.isFinite(signedAmount) || !isInvestmentCashflow(input)) {
    return 0;
  }

  return Math.max(signedAmount, 0);
}

export function classifyMoneyFlowType(signedAmount: number, input: SpendImpactInput): MoneyFlowType {
  if (input.moneyFlowType) {
    return input.moneyFlowType;
  }

  if (isInvestmentCashflow(input)) {
    return "investment";
  }

  if (input.source === "import" && isIgnoredImportedCashflow(input, signedAmount)) {
    return signedAmount < 0 ? "income" : "transfer";
  }

  return signedAmount < 0 ? "income" : "spend";
}
