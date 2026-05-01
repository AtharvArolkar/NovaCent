import { createOfflineStore, isExpired } from "./storage";
import type { CachedReport, OfflineRecordStatus } from "./types";

const reportStore = createOfflineStore<CachedReport>("reports");

export const buildReportCacheKey = (parts: {
  accountId: string;
  reportType: string;
  filters?: Record<string, unknown>;
}) => {
  const filters = Object.entries(parts.filters ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify({
    accountId: parts.accountId,
    reportType: parts.reportType,
    filters,
  });
};

export const saveCachedReport = async <TPayload>(
  report: Omit<CachedReport<TPayload>, "id" | "cacheKey" | "generatedAt"> & {
    filters?: Record<string, unknown>;
    cacheKey?: string;
    generatedAt?: string;
  },
) => {
  const cacheKey =
    report.cacheKey ??
    buildReportCacheKey({
      accountId: report.accountId,
      reportType: report.reportType,
      filters: report.filters,
    });
  const cachedReport: CachedReport<TPayload> = {
    ...report,
    id: `${report.accountId}:${report.reportType}:${cacheKey}`,
    cacheKey,
    generatedAt: report.generatedAt ?? new Date().toISOString(),
  };

  await reportStore.set(cachedReport);
  return cachedReport;
};

export const getCachedReport = async <TPayload>(
  accountId: string,
  reportType: string,
  filters?: Record<string, unknown>,
) => {
  const cacheKey = buildReportCacheKey({ accountId, reportType, filters });
  return reportStore.get(
    `${accountId}:${reportType}:${cacheKey}`,
  ) as Promise<CachedReport<TPayload> | undefined>;
};

export const listCachedReports = async (accountId: string) => {
  const reports = await reportStore.getAll();
  return reports
    .filter((report) => report.accountId === accountId)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
};

export const getCachedReportStatus = (
  report: CachedReport | undefined,
): OfflineRecordStatus => {
  if (!report) return "expired";
  return isExpired(report.expiresAt) ? "stale" : "fresh";
};

export const deleteCachedReport = (id: string) => reportStore.delete(id);

