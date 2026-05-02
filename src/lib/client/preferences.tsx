"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dictionary, languages, phraseDictionary, supplementalPhraseDictionary, type DictionaryKey, type Language } from "./dictionary";

type Theme = "light" | "dark";
export const currencyOptions = ["INR", "USD", "EUR", "AED"] as const;
export type CurrencyCode = (typeof currencyOptions)[number];

type PreferencesContextValue = {
  accountId: string;
  setAccountId: (accountId: string) => void;
  defaultCurrency: CurrencyCode;
  setDefaultCurrency: (currency: CurrencyCode) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  isOnline: boolean;
  canInstallPwa: boolean;
  isPwaInstalled: boolean;
  promptPwaInstall: () => Promise<void>;
  dismissPwaInstall: () => void;
  t: (key: DictionaryKey) => string;
  tx: (text: string) => string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
const demoAccountIds = new Set(["primary-inr", "family", "travel-wallet"]);
const legacyCachePrefixes = ["expense-tracker"];
const pwaInstallDismissedAtKey = "novacent-pwa-install-dismissed-at";
const pwaInstallDismissMs = 7 * 24 * 60 * 60 * 1000;
const isLanguage = (value: unknown): value is Language => typeof value === "string" && value in languages;
const isCurrencyCode = (value: unknown): value is CurrencyCode => typeof value === "string" && currencyOptions.includes(value as CurrencyCode);

function pwaInstallDismissedRecently() {
  const dismissedAt = Number(window.localStorage.getItem(pwaInstallDismissedAtKey) ?? 0);
  return dismissedAt > 0 && Date.now() - dismissedAt < pwaInstallDismissMs;
}

function isStandalonePwa() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [accountId, setAccountId] = useState(useMocks ? "primary-inr" : "");
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>("INR");
  const [theme, setTheme] = useState<Theme>("light");
  const [language, setLanguage] = useState<Language>("en");
  const [isOnline, setIsOnline] = useState(true);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [installPromptDismissed, setInstallPromptDismissed] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("nova-cent-preferences");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Pick<PreferencesContextValue, "accountId" | "defaultCurrency" | "theme" | "language">>;
      if (parsed.accountId && (useMocks || !demoAccountIds.has(parsed.accountId))) setAccountId(parsed.accountId);
      if (isCurrencyCode(parsed.defaultCurrency)) setDefaultCurrency(parsed.defaultCurrency);
      if (parsed.theme === "light" || parsed.theme === "dark") setTheme(parsed.theme);
      if (isLanguage(parsed.language)) setLanguage(parsed.language);
    }
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!preferencesLoaded) return;
    window.localStorage.setItem("nova-cent-preferences", JSON.stringify({ accountId, defaultCurrency, theme, language }));
  }, [accountId, defaultCurrency, theme, language, preferencesLoaded]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registerServiceWorker = async () => {
      if (!useMocks && "caches" in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => legacyCachePrefixes.some((prefix) => cacheName.startsWith(prefix)))
            .map((cacheName) => window.caches.delete(cacheName))
        );
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    };

    registerServiceWorker().catch(() => undefined);
  }, []);

  useEffect(() => {
    const update = () => setIsOnline(window.navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setIsPwaInstalled(isStandalonePwa());
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (pwaInstallDismissedRecently()) {
        setInstallPromptDismissed(true);
        return;
      }
      setInstallPromptDismissed(false);
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredInstallPrompt(null);
      window.localStorage.removeItem(pwaInstallDismissedAtKey);
    };

    updateInstalled();
    setInstallPromptDismissed(pwaInstallDismissedRecently());
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayModeQuery.addEventListener("change", updateInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayModeQuery.removeEventListener("change", updateInstalled);
    };
  }, []);

  const dismissPwaInstall = useCallback(() => {
    window.localStorage.setItem(pwaInstallDismissedAtKey, String(Date.now()));
    setInstallPromptDismissed(true);
    setDeferredInstallPrompt(null);
  }, []);

  const promptPwaInstall = useCallback(async () => {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => ({ outcome: "dismissed" as const, platform: "" }));
    setDeferredInstallPrompt(null);
    if (choice.outcome !== "accepted") {
      dismissPwaInstall();
    }
  }, [deferredInstallPrompt, dismissPwaInstall]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      accountId,
      setAccountId,
      defaultCurrency,
      setDefaultCurrency,
      theme,
      setTheme,
      language,
      setLanguage,
      isOnline,
      canInstallPwa: Boolean(deferredInstallPrompt) && !isPwaInstalled && !installPromptDismissed,
      isPwaInstalled,
      promptPwaInstall,
      dismissPwaInstall,
      t: (key) => dictionary[language][key],
      tx: (text) => phraseDictionary[language][text] ?? supplementalPhraseDictionary[language][text] ?? text
    }),
    [accountId, defaultCurrency, theme, language, isOnline, deferredInstallPrompt, isPwaInstalled, installPromptDismissed, promptPwaInstall, dismissPwaInstall]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
