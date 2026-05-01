"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { accounts } from "./demo-data";
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

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [accountId, setAccountId] = useState(accounts[0].id);
  const [theme, setTheme] = useState<Theme>("light");
  const [language, setLanguage] = useState<Language>("en");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem("rupee-flow-preferences");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Pick<PreferencesContextValue, "accountId" | "theme" | "language">>;
      if (parsed.accountId) setAccountId(parsed.accountId);
      if (parsed.theme === "light" || parsed.theme === "dark") setTheme(parsed.theme);
      if (parsed.language === "en" || parsed.language === "es") setLanguage(parsed.language);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("rupee-flow-preferences", JSON.stringify({ accountId, theme, language }));
  }, [accountId, theme, language]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
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
