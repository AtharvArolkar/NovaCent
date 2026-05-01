export const appConfig = {
  name: "NovaCent",
  logoMark: "NC",
  tagline: "Modern expense intelligence for personal accounts and shared parties.",
  baseCurrency: "INR",
  defaultLocale: "en",
  supportedLocales: ["en", "es", "fr", "hi", "mr"],
  defaultBudgetAlertThreshold: 80,
  currencyProvider: "frankfurter"
} as const;

export type SupportedLocale = (typeof appConfig.supportedLocales)[number];
