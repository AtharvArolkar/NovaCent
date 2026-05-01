"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { appConfig } from "@/lib/app-config";
import { getAccounts, getNotifications, markNotificationsRead, syncPendingOutbox, type Notification } from "@/lib/client/expense-service";
import { accounts as demoAccounts, type Account } from "@/lib/client/demo-data";
import { languages, type Language } from "@/lib/client/dictionary";
import { PreferencesProvider, usePreferences } from "@/lib/client/preferences";

const navItems = [
  { href: "/", key: "dashboard" },
  { href: "/expenses", key: "expenses" },
  { href: "/budgets", key: "budgets" },
  { href: "/trips", key: "trips" },
  { href: "/parties", key: "parties" },
  { href: "/import-review", key: "importReview" },
  { href: "/reports", key: "reports" },
  { href: "/settings", key: "settings" }
] as const;

const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { accountId, setAccountId, theme, setTheme, language, setLanguage, isOnline, t } = usePreferences();
  const [accountOptions, setAccountOptions] = useState<Account[]>(demoAccounts);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);

  useEffect(() => {
    let mounted = true;
    getAccounts().then((items) => {
      if (!mounted) return;
      setAccountOptions(items);
      if (items.length && !items.some((account) => account.id === accountId)) {
        setAccountId(items[0].id);
      }
    });
    return () => {
      mounted = false;
    };
  }, [accountId, setAccountId]);

  useEffect(() => {
    let mounted = true;
    getNotifications(accountId).then((items) => {
      if (mounted) setNotifications(items);
    });
    return () => {
      mounted = false;
    };
  }, [accountId]);

  useEffect(() => {
    if (!isOnline) return;
    void syncPendingOutbox(accountId).then(() => getNotifications(accountId).then(setNotifications).catch(() => undefined));
  }, [accountId, isOnline]);

  const markRead = () => {
    setNotifications((items) => items.map((notification) => ({ ...notification, read: true })));
    void markNotificationsRead(accountId);
  };

  if (authRoutes.some((route) => pathname.startsWith(route))) {
    return <main className="auth-main">{children}</main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label={`${t("appName")} home`}>
          <span aria-hidden="true">{appConfig.logoMark}</span>
          <strong>{t("appName")}</strong>
        </Link>
        <nav aria-label={t("navigation")}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} className={active ? "nav-link active" : "nav-link"} href={item.href} aria-current={active ? "page" : undefined}>
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <div className="control-group">
            <label htmlFor="account-switcher">{t("account")}</label>
            <select id="account-switcher" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="topbar-actions">
            <div className="control-group compact">
              <label htmlFor="language-switcher">{t("language")}</label>
              <select id="language-switcher" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                {Object.entries(languages).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <button className="toggle-button" type="button" aria-pressed={theme === "dark"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? t("light") : t("dark")}
            </button>
            <div className="notification-center">
              <button
                className="icon-button"
                type="button"
                aria-expanded={notificationOpen}
                aria-controls="notification-panel"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                title="Notifications"
                onClick={() => setNotificationOpen((open) => !open)}
              >
                <Bell aria-hidden="true" size={18} />
                {unreadCount ? <span>{unreadCount}</span> : null}
              </button>
              {notificationOpen ? (
                <section className="notification-panel" id="notification-panel" aria-label="Notifications">
                  <div className="notification-heading">
                    <h2>Notifications</h2>
                    <button className="text-button" type="button" onClick={markRead}>
                      Mark read
                    </button>
                  </div>
                  {notifications.length ? (
                    <ul>
                      {notifications.map((notification) => (
                        <li key={notification.id} className={notification.read ? "" : "unread"}>
                          <strong>{notification.title}</strong>
                          <p>{notification.body}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted-note">No notifications yet.</p>
                  )}
                </section>
              ) : null}
            </div>
            <span className={isOnline ? "connection online" : "connection offline"}>{isOnline ? t("online") : t("offline")}</span>
          </div>
        </header>
        {!isOnline ? <div className="offline-banner" role="status">{t("offlineMessage")}</div> : null}
        <main>{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <ShellContent>{children}</ShellContent>
    </PreferencesProvider>
  );
}
