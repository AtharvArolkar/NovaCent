import { createOfflineStore, isExpired } from "./storage";
import type { CachedCurrencyRate } from "./types";

const rateStore = createOfflineStore<CachedCurrencyRate>("currencyRates");

export const buildRateCacheId = (
  baseCurrency: string,
  quoteCurrency: string,
  effectiveDate = "latest",
) =>
  `${baseCurrency.toUpperCase()}:${quoteCurrency.toUpperCase()}:${effectiveDate}`;

export const saveCachedCurrencyRate = async (
  rate: Omit<CachedCurrencyRate, "id"> & { id?: string },
) => {
  const cachedRate: CachedCurrencyRate = {
    ...rate,
    id:
      rate.id ??
      buildRateCacheId(
        rate.baseCurrency,
        rate.quoteCurrency,
        rate.effectiveDate ?? "latest",
      ),
    baseCurrency: rate.baseCurrency.toUpperCase(),
    quoteCurrency: rate.quoteCurrency.toUpperCase(),
  };

  await rateStore.set(cachedRate);
  return cachedRate;
};

export const getCachedCurrencyRate = async (
  baseCurrency: string,
  quoteCurrency: string,
  effectiveDate = "latest",
) =>
  rateStore.get(
    buildRateCacheId(baseCurrency, quoteCurrency, effectiveDate),
  );

export const getBestCachedCurrencyRate = async (
  baseCurrency: string,
  quoteCurrency: string,
) => {
  const base = baseCurrency.toUpperCase();
  const quote = quoteCurrency.toUpperCase();
  const rates = await rateStore.getAll();

  return rates
    .filter(
      (rate) =>
        rate.baseCurrency === base &&
        rate.quoteCurrency === quote &&
        !isExpired(rate.expiresAt),
    )
    .sort((left, right) => right.fetchedAt.localeCompare(left.fetchedAt))[0];
};

export const listCachedCurrencyRates = () => rateStore.getAll();

