import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createRequire } from "node:module";
import type { CategoryRule, ImportRow } from "@/lib/domain";
import { classifyMoneyFlowType, suggestedInvestmentCategoryForText } from "@/lib/spend-impact";

type RawRecord = Record<string, unknown>;
type ParseStatementOptions = {
  statementPassword?: string;
};
type PdfTextItem = { str?: string; transform?: number[]; width?: number };
type PdfPage = {
  getTextContent: (options: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }) => Promise<{ items: PdfTextItem[] }>;
};
type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => void;
};
type PdfJs = {
  disableWorker: boolean;
  getDocument: (source: { data: Uint8Array; password?: string }) => Promise<PdfDocument>;
};

const merchantKeys = [
  "merchant",
  "description",
  "details",
  "narration",
  "particulars",
  "transaction",
  "transaction details",
  "transaction remarks",
  "remarks",
  "memo",
  "payee",
  "beneficiary name",
  "remitter name",
  "beneficiary/remitter name"
];
const amountKeys = ["amount", "transaction amount", "txn amount", "net amount", "value", "amt"];
const withdrawalKeys = ["withdrawal", "withdrawals", "withdrawal amount", "withdrawal amt", "debit", "debits", "debit amount", "debit amt", "dr", "paid out", "payment", "payments", "money out", "outflow"];
const depositKeys = ["deposit", "deposits", "deposit amount", "deposit amt", "credit", "credits", "credit amount", "credit amt", "cr", "paid in", "receipt", "receipts", "money in", "inflow", "received"];
const balanceKeys = ["balance", "running balance", "closing balance", "available balance"];
const referenceKeys = ["reference", "ref", "ref no", "reference no", "reference number", "utr", "utr no", "transaction id", "transaction ref", "txn ref", "document number", "sequence", "sequence no", "cheque", "cheque no", "chq", "chq no", "rrn", "arn"];
const directionKeys = ["type", "transaction type", "debit credit", "debit/credit", "dr cr", "dr/cr", "d/c", "payment receipt", "payment/receipt"];
const dateKeys = ["date", "transaction date", "spent at", "posted date", "posting date", "post date", "value date", "value dt", "book date", "txn date", "txn dt", "tran date", "tran dt", "date posted"];
const currencyKeys = ["currency", "ccy", "curr"];
const statementAmountPattern = /(?:₹|rs\.?|inr|\$|€|£)?\s*[-+]?(?:\d{1,3}(?:,\d{2,3})+|\d+)\.\d{1,2}/gi;
const statementMonthPattern = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const statementDatePattern = new RegExp(`\\b(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{1,2}[-\\s]${statementMonthPattern}[-\\s]\\d{2,4})\\b`, "i");
const require = createRequire(import.meta.url);

export class StatementPasswordError extends Error {
  constructor(message: string, readonly reason: "required" | "invalid") {
    super(message);
    this.name = "StatementPasswordError";
  }
}

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickValue(record: RawRecord, keys: string[], options: { contains?: boolean; exclude?: string[] } = {}) {
  const normalizedKeys = keys.map(normalizeFieldName);
  const excluded = new Set((options.exclude ?? []).flatMap((key) => [key, normalizeFieldName(key)]));
  const entries = Object.entries(record)
    .map(([name, value]) => ({ name, normalized: normalizeFieldName(name), value }))
    .filter((entry) => !excluded.has(entry.normalized));

  for (const key of normalizedKeys) {
    const found = entries.find((entry) => entry.normalized === key);
    if (found?.value !== undefined && found.value !== null && String(found.value).trim()) {
      return String(found.value).trim();
    }
  }

  if (options.contains) {
    for (const key of normalizedKeys.filter((item) => item.length >= 3)) {
      const found = entries.find((entry) => entry.normalized.includes(key));
      if (found?.value !== undefined && found.value !== null && String(found.value).trim()) {
        return String(found.value).trim();
      }
    }
  }

  return "";
}

function normalizeMoneyNumber(value: string) {
  let normalized = value.replace(/[^\d,.-]/g, "");
  if (normalized.includes(",") && !normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const decimalDigits = normalized.length - lastComma - 1;
    normalized = decimalDigits > 0 && decimalDigits <= 2
      ? `${normalized.slice(0, lastComma).replace(/[.,]/g, "")}.${normalized.slice(lastComma + 1)}`
      : normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(/,/g, "");
  }
  return normalized;
}

function directionFromText(value: string): "withdrawal" | "deposit" | undefined {
  const normalized = value.toLowerCase();
  const compact = normalized.replace(/[^a-z]/g, "");
  if (["c", "cr", "credit"].includes(compact)) {
    return "deposit";
  }
  if (["d", "dr", "debit"].includes(compact)) {
    return "withdrawal";
  }
  const depositHint = /\b(cr|credit|deposit|deposited|receipt|received|refund|cashback|salary|interest|paid in|money in|inflow)\b/.test(normalized);
  const withdrawalHint = /\b(dr|debit|withdrawal|withdrawn|payment|paid out|purchase|sent|money out|outflow)\b/.test(normalized);
  if (withdrawalHint && !depositHint) {
    return "withdrawal";
  }
  if (depositHint && !withdrawalHint) {
    return "deposit";
  }
  if (withdrawalHint && depositHint) {
    return /\b(deposit|deposited|receipt|received|refund|cashback|salary|interest|paid in|money in|inflow)\b/.test(normalized)
      ? "deposit"
      : "withdrawal";
  }
  return undefined;
}

function parseMoneyToken(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { amount: 0, signedAmount: 0, explicitSign: false };
  }

  const direction = directionFromText(raw);
  const parenthesized = /^\s*\(.*\)\s*$/.test(raw);
  const explicitSign = parenthesized || /^\s*[-+]/.test(raw) || Boolean(direction);
  const magnitude = Number(normalizeMoneyNumber(raw));
  const amount = Number.isFinite(magnitude) ? Math.abs(magnitude) : 0;
  const isNegative = parenthesized || /^\s*-/.test(raw) || direction === "withdrawal";
  return {
    amount,
    signedAmount: isNegative ? -amount : amount,
    explicitSign
  };
}

function parseAmount(value: string) {
  return parseMoneyToken(value).amount;
}

const defaultCategoryRules: Array<{ pattern: RegExp; categoryName: string }> = [
  { pattern: /\b(loan|emi)\b/i, categoryName: "Loan/EMI" },
  { pattern: /\b(grocery|groceries|supermarket|mart|dmart|d-mart|bigbasket|blinkit|zepto|jiomart|reliance\s+fresh|more\s+retail|nature'?s?\s+basket|instamart)\b/i, categoryName: "Groceries" },
  { pattern: /\b(swiggy|zomato|dominos|pizza\s+hut|mcdonald|burger\s+king|kfc|food\s+delivery)\b/i, categoryName: "Food" },
  { pattern: /\b(restaurant|cafe|cafeteria|dining|hotel|eatery|foodcourt)\b/i, categoryName: "Dining" },
  { pattern: /\b(fuel|petrol|diesel|iocl|indian\s+oil|hpcl|hindustan\s+petroleum|bpcl|bharat\s+petroleum|shell)\b/i, categoryName: "Fuel" },
  { pattern: /\b(bike|motorcycle|two[-\s]?wheeler|scooter|helmet|tyre|tire|puncture|bike\s+service|service\s+center|spare|motocycle|motorcycle\s+liquid)\b/i, categoryName: "Bike Expense" },
  { pattern: /\b(uber|ola|rapido|metro|bus|train|irctc|railway|cab|taxi|auto|rickshaw|toll|fastag|parking)\b/i, categoryName: "Transport" },
  { pattern: /\b(electricity|water\s+bill|gas\s+bill|broadband|internet|wifi|wi-fi|mobile\s+bill|airtel|jiofiber|jio\s+fiber|vi\s+bill|bsnl|mseb|mahavitaran|adani\s+electricity|tata\s+power)\b/i, categoryName: "Utilities" },
  { pattern: /\b(rent|landlord|tenant|house\s+rent|flat\s+rent)\b/i, categoryName: "Rent" },
  { pattern: /\b(school|college|tuition|course|class|exam|fees|udemy|coursera|upgrad)\b/i, categoryName: "Education" },
  { pattern: /\b(movie|cinema|bookmyshow|gaming|game|spotify|prime\s+video|hotstar|netflix|theatre)\b/i, categoryName: "Entertainment" },
  { pattern: /\b(salon|saloon|haircut|spa|beauty|grooming|personal\s+care)\b/i, categoryName: "Personal Care" },
  { pattern: /\b(household|home\s+centre|homecenter|ikea|furniture|hardware|appliance|decor|home\s+decor)\b/i, categoryName: "Household" },
  { pattern: /\b(health\s+insurance|motor\s+insurance|vehicle\s+insurance|insurance\s+premium|policy\s+premium)\b/i, categoryName: "Insurance" },
  { pattern: /\b(income\s+tax|property\s+tax|road\s+tax|tax\s+payment|gst)\b/i, categoryName: "Taxes" },
  { pattern: /\b(gift|donation|charity|present)\b/i, categoryName: "Gifts" }
];

function categoryForMerchant(merchant: string, rules: CategoryRule[]) {
  const rule = rules.find((item) => merchant.toLowerCase().includes(item.pattern.toLowerCase()));
  if (rule?.categoryName) return rule.categoryName;
  return defaultCategoryRules.find((item) => item.pattern.test(merchant))?.categoryName ?? "Uncategorized";
}

function classifiedImportRowFields(input: {
  merchant: string;
  description?: string;
  direction: "withdrawal" | "deposit";
  signedAmount: number;
  rules: CategoryRule[];
}) {
  const ruleCategory = input.direction === "deposit" ? "Reimbursements" : categoryForMerchant(input.merchant, input.rules);
  const moneyFlowType = classifyMoneyFlowType(input.signedAmount, {
    source: "import",
    merchant: input.merchant,
    description: input.description,
    categoryName: ruleCategory
  });

  const investmentCategory = suggestedInvestmentCategoryForText({
    source: "import",
    merchant: input.merchant,
    description: input.description,
    categoryName: ruleCategory
  }) ?? "Investments";

  return {
    moneyFlowType,
    suggestedCategoryName: moneyFlowType === "investment" && ruleCategory === "Uncategorized" ? investmentCategory : ruleCategory
  };
}

function rowFromRecord(record: RawRecord, batchId: string, rules: CategoryRule[]): ImportRow | null {
  const description = pickValue(record, merchantKeys, { contains: true });
  const reference = pickValue(record, referenceKeys, { contains: true });
  const dateValue = pickValue(record, dateKeys, { contains: true });
  const dateMatch = dateValue.match(statementDatePattern);
  const spentAt = dateMatch?.[0] ? normalizeStatementDate(dateMatch[0]) : dateValue || new Date().toISOString().slice(0, 10);
  const currency = (pickValue(record, currencyKeys) || "INR").toUpperCase();
  const withdrawalValue = pickValue(record, withdrawalKeys, { contains: true, exclude: balanceKeys });
  const depositValue = pickValue(record, depositKeys, { contains: true, exclude: balanceKeys });
  const balanceValue = pickValue(record, balanceKeys, { contains: true });
  const amountValue = pickValue(record, amountKeys);
  const directionValue = pickValue(record, directionKeys, { contains: true });
  let withdrawalAmount = parseAmount(withdrawalValue);
  let depositAmount = parseAmount(depositValue);
  const balanceAmount = parseAmount(balanceValue);

  if (withdrawalAmount <= 0 && depositAmount <= 0) {
    const parsedAmount = parseMoneyToken(amountValue);
    const direction = directionFromText(directionValue) ?? directionFromText(amountValue) ?? directionFromText(description);
    if (direction === "deposit" || (parsedAmount.explicitSign && parsedAmount.signedAmount > 0 && direction !== "withdrawal")) {
      depositAmount = parsedAmount.amount;
    } else {
      withdrawalAmount = parsedAmount.amount;
    }
  }

  const direction = withdrawalAmount > 0 ? "withdrawal" : "deposit";
  const amount = direction === "withdrawal" ? withdrawalAmount : -depositAmount;
  const merchant = description || (reference ? `Reference ${reference}` : "");

  if (!merchant || (withdrawalAmount <= 0 && depositAmount <= 0)) {
    return null;
  }
  const classification = classifiedImportRowFields({ merchant, description, direction, signedAmount: amount, rules });

  return {
    id: crypto.randomUUID(),
    batchId,
    status: "review",
    merchant,
    description: merchant,
    reference,
    direction,
    spentAt,
    original: { amount, currency },
    withdrawalAmount: withdrawalAmount > 0 ? { amount: withdrawalAmount, currency } : undefined,
    depositAmount: depositAmount > 0 ? { amount: depositAmount, currency } : undefined,
    balanceAmount: balanceAmount > 0 ? { amount: balanceAmount, currency } : undefined,
    suggestedCategoryName: classification.suggestedCategoryName,
    moneyFlowType: classification.moneyFlowType,
    confidence: description && (withdrawalValue || depositValue) ? 90 : 78,
    rawText: JSON.stringify(record)
  };
}

function excelSerialDateToIso(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) {
    return "";
  }

  return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

function excelCellToText(value: unknown, options: { dateLike?: boolean } = {}) {
  if (value === undefined || value === null) {
    return "";
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const dateText = options.dateLike ? excelSerialDateToIso(value) : "";
    return dateText || String(value);
  }

  return String(value).replace(/\u00a0/g, " ").trim();
}

function headerCellMatches(value: string, keys: string[]) {
  const normalized = normalizeFieldName(value);
  return keys.some((key) => {
    const normalizedKey = normalizeFieldName(key);
    return normalized === normalizedKey || (normalizedKey.length >= 3 && normalized.includes(normalizedKey));
  });
}

function isExcelTransactionHeader(cells: string[]) {
  const line = normalizeStatementLine(cells.filter(Boolean).join(" "));
  if (!line) {
    return false;
  }
  if (isTransactionTableHeader(line)) {
    return true;
  }

  const hasDate = cells.some((cell) => headerCellMatches(cell, dateKeys));
  const hasDescription = cells.some((cell) =>
    headerCellMatches(cell, merchantKeys.filter((key) => key !== "transaction"))
  );
  const hasMoneyColumn = cells.some((cell) => headerCellMatches(cell, [...withdrawalKeys, ...depositKeys, ...amountKeys, ...balanceKeys]));
  if (hasDate && hasDescription && hasMoneyColumn) {
    return true;
  }

  if (isStatementMetadataLine(line)) {
    return false;
  }

  return hasDate && hasDescription && hasMoneyColumn;
}

function uniqueExcelHeaders(cells: string[]) {
  const seen = new Map<string, number>();
  return cells.map((cell, index) => {
    const base = cell || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base} ${count + 1}` : base;
  });
}

function rowToRecord(headers: string[], row: unknown[]) {
  return headers.reduce<RawRecord>((record, header, index) => {
    const dateLike = headerCellMatches(header, dateKeys);
    const value = excelCellToText(row[index], { dateLike });
    if (value) {
      record[header] = value;
    }
    return record;
  }, {});
}

function excelRowToLine(row: unknown[], headers?: string[]) {
  return normalizeStatementLine(
    row
      .map((cell, index) => {
        const header = headers?.[index] ?? "";
        const dateLike = header ? headerCellMatches(header, dateKeys) : index <= 1;
        return excelCellToText(cell, { dateLike });
      })
      .filter(Boolean)
      .join(" ")
  );
}

function parseRowsFromExcelGrid(grid: unknown[][], batchId: string, rules: CategoryRule[]) {
  const rows: ImportRow[] = [];
  let headers: string[] | undefined;

  for (const row of grid) {
    const cells = row.map((cell) => excelCellToText(cell));
    const line = normalizeStatementLine(cells.filter(Boolean).join(" "));
    if (!line) {
      continue;
    }

    if (isExcelTransactionHeader(cells)) {
      headers = uniqueExcelHeaders(cells);
      continue;
    }

    if (!headers || isStatementMetadataLine(line)) {
      continue;
    }

    if (isTransactionTableEnd(line)) {
      headers = undefined;
      continue;
    }

    const recordRow = rowFromRecord(rowToRecord(headers, row), batchId, rules);
    if (recordRow) {
      rows.push(recordRow);
      continue;
    }

    const lineRow = rowFromStatementLine(excelRowToLine(row, headers), batchId, rules, { foundTableHeader: true });
    if (lineRow) {
      rows.push(lineRow);
    }
  }

  return rows;
}

function parseRowsFromWorkbook(workbook: XLSX.WorkBook, batchId: string, rules: CategoryRule[]) {
  const rows: ImportRow[] = [];
  const sheetLines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
    rows.push(...parseRowsFromExcelGrid(grid, batchId, rules));
    sheetLines.push(...grid.map((row) => excelRowToLine(row)).filter(Boolean));
  }

  return rows.length ? rows : parseRowsFromText(sheetLines.join("\n"), batchId, rules);
}

function normalizeStatementLine(line: string) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/(\d{1,2}[/-]\d{1,2}[/-]\d{4})(?=\d)/g, "$1 ")
    .replace(/(\d+\.\d{2})(?=\d)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTransactionTableHeader(line: string) {
  const normalized = ` ${line.toLowerCase().replace(/[^a-z0-9/ ]+/g, " ")} `;
  const hasDate = /\b(date|txn date|tran date|transaction date|value date|posting date|post date|book date)\b/.test(normalized);
  const hasDescription = /\b(description|narration|particulars|remarks|details|transaction|payee|beneficiary|remitter)\b/.test(normalized);
  const hasMoneyColumn = /\b(withdrawal|debit|dr|deposit|credit|cr|amount|balance|paid in|paid out|money in|money out)\b/.test(normalized);
  return hasDate && hasDescription && hasMoneyColumn && !/\b(statement date|from date|to date|opening date)\b/.test(normalized);
}

function isStatementMetadataLine(line: string) {
  const normalized = ` ${line.toLowerCase().replace(/[^a-z0-9/ ]+/g, " ")} `;
  return /\b(account opening date|opening date|min(?:imum)? balance|minimum account balance|average monthly balance|amb|required balance|customer id|account number|account no|branch|ifsc|micr|nominee|statement period|period from|from date|to date|generated on|computer generated|page no|opening balance|closing balance|total withdrawal|total deposit|total debit|total credit|transaction summary|statement summary|summary)\b/.test(normalized);
}

function isTransactionTableEnd(line: string) {
  const normalized = ` ${line.toLowerCase().replace(/[^a-z0-9/ ]+/g, " ")} `;
  return /\b(closing balance|total withdrawal|total deposit|total debit|total credit|transaction summary|statement summary|end of statement|generated on|computer generated)\b/.test(normalized);
}

function isLikelyTransactionContinuationLine(line: string) {
  return Boolean(statementDatePattern.test(line) && statementAmountMatches(line).length > 0);
}

function transactionCandidateLines(lines: string[]) {
  const candidates: string[] = [];
  let insideTable = false;
  let foundHeader = false;

  for (const line of lines) {
    if (isTransactionTableHeader(line)) {
      insideTable = true;
      foundHeader = true;
      continue;
    }

    if (insideTable && isTransactionTableEnd(line)) {
      insideTable = false;
      continue;
    }

    if (isStatementMetadataLine(line)) {
      continue;
    }

    if (!insideTable) {
      if (!foundHeader || !isLikelyTransactionContinuationLine(line)) {
        continue;
      }
      insideTable = true;
    }

    candidates.push(line);
  }

  if (foundHeader) {
    return { lines: candidates, foundHeader };
  }

  return { lines: lines.filter((line) => !isStatementMetadataLine(line)), foundHeader };
}

function normalizeStatementDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const monthNameMatch = value.match(new RegExp(`^(\\d{1,2})[-\\s](${statementMonthPattern})[-\\s](\\d{2,4})$`, "i"));
  if (monthNameMatch) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = monthNames.findIndex((name) => monthNameMatch[2].toLowerCase().startsWith(name)) + 1;
    const year = (monthNameMatch[3].length === 2 ? `20${monthNameMatch[3]}` : monthNameMatch[3]).padStart(4, "0");
    return `${year}-${String(month).padStart(2, "0")}-${monthNameMatch[1].padStart(2, "0")}`;
  }

  const [dayPart, monthPart, yearPart] = value.split(/[/-]/);
  const year = (yearPart.length === 2 ? `20${yearPart}` : yearPart).padStart(4, "0");
  return `${year}-${monthPart.padStart(2, "0")}-${dayPart.padStart(2, "0")}`;
}

function statementAmountMatches(text: string) {
  statementAmountPattern.lastIndex = 0;
  return Array.from(text.matchAll(statementAmountPattern)).map((match) => ({
    token: match[0],
    amount: parseAmount(match[0])
  }));
}

function mergeWrappedTransactionLines(lines: string[]) {
  const merged: string[] = [];
  let pending = "";

  for (const line of lines) {
    if (isTransactionTableHeader(line) || isStatementMetadataLine(line) || isTransactionTableEnd(line)) {
      if (pending) {
        merged.push(pending);
        pending = "";
      }
      continue;
    }

    const hasDate = statementDatePattern.test(line);
    if (hasDate) {
      if (pending) {
        merged.push(pending);
      }
      pending = line;
      continue;
    }

    if (pending) {
      pending = `${pending} ${line}`;
    }
  }

  if (pending) {
    merged.push(pending);
  }

  return merged;
}

function findReference(text: string, dateIndex: number) {
  const beforeDate = text.slice(0, dateIndex);
  const candidates = beforeDate
    .split(/\s+/)
    .map((token) => token.replace(/^[^\w]+|[^\w]+$/g, ""))
    .filter(Boolean);
  return candidates.find((token) => /\d{6,}/.test(token)) ?? candidates.find((token) => /[A-Z]{2,}\d{3,}/i.test(token));
}

function cleanDescription(text: string, dateToken: string, amountTokens: string[], reference?: string) {
  let description = ` ${text} `;
  description = description.replace(dateToken, " ");
  for (const amountToken of amountTokens) {
    description = description.replace(amountToken, " ");
  }
  if (reference) {
    description = description.replace(reference, " ");
  }

  description = description
    .replace(/\b(?:date|value date|transaction date|ref|ref no|reference|description|narration|particulars|withdrawal|withdrawals|debit|deposit|credit|balance|amount|chq|cheque|utr|dr|cr)\b/gi, " ")
    .replace(/\b\d{6,}\b/g, " ")
    .replace(/[|:_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /\p{L}/u.test(description) ? description : "";
}

function rowFromStatementLine(line: string, batchId: string, rules: CategoryRule[], options: { foundTableHeader?: boolean } = {}): ImportRow | null {
  const normalizedLine = normalizeStatementLine(line);
  const dateMatch = normalizedLine.match(statementDatePattern);

  if (!dateMatch || dateMatch.index === undefined) {
    return null;
  }

  const spentAt = normalizeStatementDate(dateMatch[1]);
  const afterDate = normalizedLine.slice(dateMatch.index + dateMatch[0].length);
  const amountMatches = statementAmountMatches(afterDate);

  if (!amountMatches.length) {
    return null;
  }

  const reference = findReference(normalizedLine, dateMatch.index);
  const dateIsAtTransactionStart = dateMatch.index <= 24 || Boolean(reference);
  if (!options.foundTableHeader && !dateIsAtTransactionStart && amountMatches.length < 2) {
    return null;
  }

  const relevantAmounts = amountMatches.slice(-3);
  let withdrawalAmount = 0;
  let depositAmount = 0;
  let balanceAmount = 0;

  if (relevantAmounts.length >= 3) {
    withdrawalAmount = relevantAmounts[0].amount;
    depositAmount = relevantAmounts[1].amount;
    balanceAmount = relevantAmounts[2].amount;
  } else if (relevantAmounts.length === 2) {
    const lowerLine = normalizedLine.toLowerCase();
    const depositHint = /\b(cr|credit|deposit|deposited|received|refund|cashback)\b/.test(lowerLine) && !/\b(dr|debit|withdrawal|paid|purchase|sent|to)\b/.test(lowerLine);
    if (depositHint) {
      depositAmount = relevantAmounts[0].amount;
    } else {
      withdrawalAmount = relevantAmounts[0].amount;
    }
    balanceAmount = relevantAmounts[1].amount;
  } else {
    withdrawalAmount = relevantAmounts[0].amount;
  }

  if (withdrawalAmount <= 0 && depositAmount <= 0) {
    return null;
  }

  const description = cleanDescription(normalizedLine, dateMatch[0], amountMatches.map((match) => match.token), reference) || (reference ? `Reference ${reference}` : "");

  if (!description) {
    return null;
  }

  const direction = withdrawalAmount > 0 ? "withdrawal" : "deposit";
  const signedAmount = direction === "withdrawal" ? withdrawalAmount : -depositAmount;
  const classification = classifiedImportRowFields({ merchant: description, description, direction, signedAmount, rules });

  return {
    id: crypto.randomUUID(),
    batchId,
    status: "review",
    merchant: description,
    description,
    reference,
    direction,
    spentAt,
    original: { amount: signedAmount, currency: "INR" },
    withdrawalAmount: withdrawalAmount > 0 ? { amount: withdrawalAmount, currency: "INR" } : undefined,
    depositAmount: depositAmount > 0 ? { amount: depositAmount, currency: "INR" } : undefined,
    balanceAmount: balanceAmount > 0 ? { amount: balanceAmount, currency: "INR" } : undefined,
    suggestedCategoryName: classification.suggestedCategoryName,
    moneyFlowType: classification.moneyFlowType,
    confidence: reference ? 90 : 82,
    rawText: normalizedLine
  };
}

function parseRowsFromText(text: string, batchId: string, rules: CategoryRule[]): ImportRow[] {
  const rows: ImportRow[] = [];
  const rawLines = text.split(/\r?\n/).map(normalizeStatementLine).filter(Boolean);
  const { lines, foundHeader } = transactionCandidateLines(rawLines);
  const transactionLines = mergeWrappedTransactionLines(lines);

  for (const line of transactionLines) {
    const statementRow = rowFromStatementLine(line, batchId, rules, { foundTableHeader: foundHeader });
    if (statementRow) {
      rows.push(statementRow);
      continue;
    }

    statementAmountPattern.lastIndex = 0;
    const amountMatch = line.match(statementAmountPattern);
    if (!amountMatch) {
      continue;
    }

    const amount = parseAmount(amountMatch[0]);
    if (amount <= 0) {
      continue;
    }

    const dateMatch = line.match(statementDatePattern);
    const merchant = cleanDescription(line, dateMatch?.[0] ?? "", [amountMatch[0]]);

    if (!merchant) {
      continue;
    }

    const classification = classifiedImportRowFields({
      merchant,
      description: merchant,
      direction: "withdrawal",
      signedAmount: amount,
      rules
    });

    rows.push({
      id: crypto.randomUUID(),
      batchId,
      status: "review",
      merchant,
      description: merchant,
      direction: "withdrawal",
      spentAt: dateMatch?.[0] ? normalizeStatementDate(dateMatch[0]) : new Date().toISOString().slice(0, 10),
      original: { amount, currency: "INR" },
      withdrawalAmount: { amount, currency: "INR" },
      suggestedCategoryName: classification.suggestedCategoryName,
      moneyFlowType: classification.moneyFlowType,
      confidence: 62,
      rawText: line
    });
  }

  return rows;
}

function isPdfPasswordError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  return name.includes("password") || message.includes("password") || message.includes("encrypted");
}

async function parsePdfText(buffer: Buffer, statementPassword?: string) {
  const pdfjs = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js") as PdfJs;
  pdfjs.disableWorker = true;

  try {
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      password: statementPassword?.trim() || undefined
    });
    let text = "";

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false
      });
      const lineBuckets: Array<{ y: number; items: Array<{ text: string; x: number; width: number }> }> = [];

      for (const item of content.items) {
        const itemText = item.str?.replace(/\s+/g, " ").trim();
        if (!itemText) {
          continue;
        }

        const y = item.transform?.[5] ?? 0;
        const x = item.transform?.[4] ?? 0;
        const bucket = lineBuckets.find((line) => Math.abs(line.y - y) <= 2);
        const target = bucket ?? { y, items: [] };
        target.items.push({ text: itemText, x, width: item.width ?? itemText.length * 5 });
        if (!bucket) {
          lineBuckets.push(target);
        }
      }

      const pageText = lineBuckets
        .sort((left, right) => right.y - left.y)
        .map((line) => {
          const ordered = line.items.sort((left, right) => left.x - right.x);
          return ordered.reduce((value, item, index) => {
            if (index === 0) {
              return item.text;
            }
            const previous = ordered[index - 1];
            const gap = item.x - (previous.x + previous.width);
            return `${value}${gap > 1 ? " " : ""}${item.text}`;
          }, "");
        })
        .join("\n");
      text += `\n\n${pageText}`;
    }

    doc.destroy();
    return text;
  } catch (error) {
    if (isPdfPasswordError(error)) {
      throw new StatementPasswordError(
        statementPassword?.trim()
          ? "The statement password is incorrect. Please retry with the correct password."
          : "This statement is password protected. Enter the statement password and upload again.",
        statementPassword?.trim() ? "invalid" : "required"
      );
    }
    throw error;
  }
}

export async function parseStatementFile(file: File, batchId: string, rules: CategoryRule[], options: ParseStatementOptions = {}) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === "csv") {
    const parsed = Papa.parse<RawRecord>(buffer.toString("utf8"), { header: true, skipEmptyLines: true });
    const rows = parsed.data.map((record) => rowFromRecord(record, batchId, rules)).filter((row): row is ImportRow => Boolean(row));
    return rows.length ? rows : parseRowsFromText(buffer.toString("utf8"), batchId, rules);
  }

  if (extension === "xlsx" || extension === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    return parseRowsFromWorkbook(workbook, batchId, rules);
  }

  if (extension === "pdf") {
    const text = await parsePdfText(buffer, options.statementPassword);
    return parseRowsFromText(text, batchId, rules);
  }

  return parseRowsFromText(buffer.toString("utf8"), batchId, rules);
}
