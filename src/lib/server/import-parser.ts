import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { CategoryRule, ImportRow } from "@/lib/domain";

type RawRecord = Record<string, unknown>;

const merchantKeys = ["merchant", "description", "details", "narration", "transaction", "payee"];
const amountKeys = ["amount", "debit", "withdrawal", "paid", "value"];
const dateKeys = ["date", "transaction date", "spent at", "posted date"];
const currencyKeys = ["currency", "ccy"];

function pickValue(record: RawRecord, keys: string[]) {
  const entries = Object.entries(record);
  for (const key of keys) {
    const found = entries.find(([name]) => name.trim().toLowerCase() === key);
    if (found?.[1] !== undefined && found[1] !== null && String(found[1]).trim()) {
      return String(found[1]).trim();
    }
  }
  return "";
}

function parseAmount(value: string) {
  const normalized = value.replace(/[,₹$€£A-Z\s]/gi, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function categoryForMerchant(merchant: string, rules: CategoryRule[]) {
  const rule = rules.find((item) => merchant.toLowerCase().includes(item.pattern.toLowerCase()));
  return rule?.categoryName ?? "Uncategorized";
}

function rowFromRecord(record: RawRecord, batchId: string, rules: CategoryRule[]): ImportRow | null {
  const merchant = pickValue(record, merchantKeys);
  const amount = parseAmount(pickValue(record, amountKeys));
  const spentAt = pickValue(record, dateKeys) || new Date().toISOString().slice(0, 10);
  const currency = (pickValue(record, currencyKeys) || "INR").toUpperCase();

  if (!merchant || amount <= 0) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    batchId,
    status: "review",
    merchant,
    spentAt,
    original: { amount, currency },
    suggestedCategoryName: categoryForMerchant(merchant, rules),
    confidence: 0.82,
    rawText: JSON.stringify(record)
  };
}

function parseRowsFromText(text: string, batchId: string, rules: CategoryRule[]): ImportRow[] {
  const rows: ImportRow[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const amountPattern = /(-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|-?\d+(?:\.\d{1,2}))/;

  for (const line of lines) {
    const amountMatch = line.match(amountPattern);
    if (!amountMatch) {
      continue;
    }

    const amount = parseAmount(amountMatch[1]);
    if (amount <= 0) {
      continue;
    }

    const dateMatch = line.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})\b/);
    const merchant = line.replace(amountMatch[0], "").replace(dateMatch?.[0] ?? "", "").replace(/\s+/g, " ").trim();

    if (merchant.length < 2) {
      continue;
    }

    rows.push({
      id: crypto.randomUUID(),
      batchId,
      status: "review",
      merchant,
      spentAt: dateMatch?.[0] ?? new Date().toISOString().slice(0, 10),
      original: { amount, currency: "INR" },
      suggestedCategoryName: categoryForMerchant(merchant, rules),
      confidence: 0.66,
      rawText: line
    });
  }

  return rows;
}

export async function parseStatementFile(file: File, batchId: string, rules: CategoryRule[]) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === "csv") {
    const parsed = Papa.parse<RawRecord>(buffer.toString("utf8"), { header: true, skipEmptyLines: true });
    return parsed.data.map((record) => rowFromRecord(record, batchId, rules)).filter((row): row is ImportRow => Boolean(row));
  }

  if (extension === "xlsx" || extension === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const records = XLSX.utils.sheet_to_json<RawRecord>(sheet);
    return records.map((record) => rowFromRecord(record, batchId, rules)).filter((row): row is ImportRow => Boolean(row));
  }

  if (extension === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return parseRowsFromText(result.text, batchId, rules);
  }

  return parseRowsFromText(buffer.toString("utf8"), batchId, rules);
}

