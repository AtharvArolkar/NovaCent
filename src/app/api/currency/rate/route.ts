import { getCurrencyRate } from "@/lib/server/currency";
import { handleApiError, ok } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "INR";
    const to = url.searchParams.get("to") ?? "INR";
    const amount = Number(url.searchParams.get("amount") ?? "1");
    const snapshot = await getCurrencyRate(from, to);
    return ok({
      rate: snapshot,
      convertedAmount: Math.round(amount * snapshot.rate * 100) / 100
    });
  } catch (error) {
    return handleApiError(error);
  }
}

