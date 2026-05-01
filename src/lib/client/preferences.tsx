"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dictionary, type DictionaryKey, type Language } from "./dictionary";

type Theme = "light" | "dark";

type PreferencesContextValue = {
  accountId: string;
  setAccountId: (accountId: string) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  isOnline: boolean;
  t: (key: DictionaryKey) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
const demoAccountIds = new Set(["primary-inr", "family", "travel-wallet"]);
const legacyCachePrefixes = ["expense-tracker"];

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [accountId, setAccountId] = useState(useMocks ? "primary-inr" : "");
  const [theme, setTheme] = useState<Theme>("light");
  const [language, setLanguage] = useState<Language>("en");
  const [isOnline, setIsOnline] = useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("rupee-flow-preferences");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Pick<PreferencesContextValue, "accountId" | "theme" | "language">>;
      if (parsed.accountId && (useMocks || !demoAccountIds.has(parsed.accountId))) setAccountId(parsed.accountId);
      if (parsed.theme === "light" || parsed.theme === "dark") setTheme(parsed.theme);
      if (parsed.language === "en" || parsed.language === "es") setLanguage(parsed.language);
    }
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!preferencesLoaded) return;
    window.localStorage.setItem("rupee-flow-preferences", JSON.stringify({ accountId, theme, language }));
  }, [accountId, theme, language, preferencesLoaded]);

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

  const value = useMemo<PreferencesContextValue>(
    () => ({
      accountId,
      setAccountId,
      theme,
      setTheme,
      language,
      setLanguage,
      isOnline,
      t: (key) => dictionary[language][key]
    }),
    [accountId, theme, language, isOnline]
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
