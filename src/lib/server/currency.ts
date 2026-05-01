import { collections, getDb } from "@/lib/server/mongodb";
import type { CurrencySnapshot, Money } from "@/lib/domain";
import { appConfig } from "@/lib/app-config";

interface FrankfurterResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function getCurrencyRate(from: string, to: string = appConfig.baseCurrency): Promise<CurrencySnapshot> {
  const source = from.toUpperCase();
  const target = to.toUpperCase();
  const fetchedAt = new Date().toISOString();

  if (source === target) {
    return { from: source, to: target, rate: 1, provider: "identity", fetchedAt };
  }

  const db = await getDb();
  const cached = await db.collection(collections.currencyRates).findOne({
    from: source,
    to: target,
    provider: appConfig.currencyProvider
  });

  try {
    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${source}&symbols=${target}`, {
      next: { revalidate: 60 * 60 * 6 }
    });

    if (!response.ok) {
      throw new Error(`Currency provider failed with ${response.status}`);
    }

    const payload = (await response.json()) as FrankfurterResponse;
    const rate = payload.rates[target];

    if (!rate) {
      throw new Error(`No exchange rate available for ${source}/${target}`);
    }

    const snapshot = {
      from: source,
      to: target,
      rate,
      provider: appConfig.currencyProvider,
      fetchedAt
    };

    await db.collection(collections.currencyRates).updateOne(
      { from: source, to: target, provider: appConfig.currencyProvider },
      { $set: snapshot },
      { upsert: true }
    );

    return snapshot;
  } catch (error) {
    if (cached) {
      return {
        from: cached.from,
        to: cached.to,
        rate: cached.rate,
        provider: `${cached.provider}:cached`,
        fetchedAt: cached.fetchedAt
      };
    }

    throw error;
  }
}

export async function convertToBase(original: Money, baseCurrency: string = appConfig.baseCurrency) {
  const rate = await getCurrencyRate(original.currency, baseCurrency);
  return {
    base: {
      amount: Math.round(original.amount * rate.rate * 100) / 100,
      currency: baseCurrency
    },
    exchangeRate: rate.rate === 1 ? undefined : rate
  };
}
