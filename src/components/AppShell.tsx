"use client";

import { Bell, LogOut, Menu, Settings, X } from "lucide-react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { appConfig } from "@/lib/app-config";
import { getAccounts, getNotifications, markNotificationsRead, syncPendingOutbox, type Notification } from "@/lib/client/expense-service";
import type { Account } from "@/lib/client/demo-data";
import { languages, type Language } from "@/lib/client/dictionary";
import { PreferencesProvider, usePreferences } from "@/lib/client/preferences";

const navItems = [
  { href: "/", key: "dashboard" },
  { href: "/expenses", key: "expenses" },
  { href: "/budgets", key: "budgets" },
  { href: "/parties", key: "parties" },
  { href: "/import-review", key: "importReview" },
  { href: "/reports", key: "reports" }
] as const;

const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { accountId, setAccountId, theme, setTheme, language, setLanguage, isOnline, t, tx } = usePreferences();
  const [accountOptions, setAccountOptions] = useState<Account[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);
  const userDisplayName = session?.user?.name?.trim() || session?.user?.email?.split("@")[0]?.trim() || t("user");
  const rawFirstName = userDisplayName.split(/\s+/)[0] || t("user");
  const firstName = rawFirstName ? `${rawFirstName.charAt(0).toUpperCase()}${rawFirstName.slice(1).toLowerCase()}` : t("user");

  useEffect(() => {
    let mounted = true;
    getAccounts().then((items) => {
      if (!mounted) return;
      setAccountOptions(items);
      if (items.length && !items.some((account) => account.id === accountId)) {
        setAccountId(items[0].id);
      }
    }).catch(() => {
      if (mounted) setAccountOptions([]);
    });
    return () => {
      mounted = false;
    };
  }, [accountId, setAccountId]);

  useEffect(() => {
    let mounted = true;
    getNotifications(accountId).then((items) => {
      if (mounted) setNotifications(items);
    }).catch(() => {
      if (mounted) setNotifications([]);
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

  const notificationCenter = (panelId: string, className = "notification-center") => (
    <div className={className}>
      <button
        className="icon-button"
        type="button"
        aria-expanded={notificationOpen}
        aria-controls={panelId}
        aria-label={`${tx("Notifications")}${unreadCount ? `, ${unreadCount} ${tx("unread")}` : ""}`}
        title={tx("Notifications")}
        onClick={() => setNotificationOpen((open) => !open)}
      >
        <Bell aria-hidden="true" size={18} />
        {unreadCount ? <span>{unreadCount}</span> : null}
      </button>
      {notificationOpen ? (
        <section className="notification-panel" id={panelId} aria-label={tx("Notifications")}>
          <div className="notification-heading">
            <h2>{tx("Notifications")}</h2>
            <button className="text-button" type="button" onClick={markRead}>
              {tx("Mark read")}
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
            <p className="muted-note">{tx("No notifications yet.")}</p>
          )}
        </section>
      ) : null}
    </div>
  );

  if (authRoutes.some((route) => pathname.startsWith(route))) {
    return <main className="auth-main">{children}</main>;
  }

  return (
    <div className="app-shell">
      <aside className={mobileNavOpen ? "sidebar menu-open" : "sidebar"}>
        <div className="sidebar-header">
          <Link className="brand" href="/" aria-label={`${t("appName")} ${tx("home")}`} onClick={() => setMobileNavOpen(false)}>
            <span aria-hidden="true">{appConfig.logoMark}</span>
            <strong>{t("appName")}</strong>
          </Link>
          <div className="mobile-header-actions">
            {notificationCenter("mobile-notification-panel", "notification-center mobile-notification-center")}
            <button
              className="mobile-menu-button"
              type="button"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-navigation-panel"
            aria-label={mobileNavOpen ? tx("Close navigation") : tx("Open navigation")}
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              {mobileNavOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
            </button>
          </div>
        </div>
        <div className="mobile-menu-backdrop" aria-hidden="true" onClick={() => setMobileNavOpen(false)} />
        <div className="sidebar-drawer" id="mobile-navigation-panel">
          <div className="drawer-heading">
            <strong>{t("menu")}</strong>
            <button className="mobile-drawer-close" type="button" aria-label={tx("Close navigation")} onClick={() => setMobileNavOpen(false)}>
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <nav aria-label={t("navigation")}>
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  className={active ? "nav-link active" : "nav-link"}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <div className="mobile-drawer-controls">
              <div className="control-group">
                <label htmlFor="account-switcher-mobile">{t("account")}</label>
                <select id="account-switcher-mobile" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={!accountOptions.length}>
                  {accountOptions.length ? (
                    accountOptions.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))
                  ) : (
                  <option value={accountId}>{tx("Loading account")}</option>
                  )}
                </select>
              </div>
              <div className="drawer-control-row">
                <div className="control-group">
                  <label htmlFor="language-switcher-mobile">{t("language")}</label>
                  <select id="language-switcher-mobile" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
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
              </div>
            </div>
            <div className="sidebar-identity-row">
              <div className="sidebar-user" title={session?.user?.email ?? userDisplayName}>
                <span>{t("hi")}</span>
                <strong>{firstName}</strong>
              </div>
              <span className={isOnline ? "connection sidebar-connection online" : "connection sidebar-connection offline"}>{isOnline ? t("online") : t("offline")}</span>
            </div>
            <div className="sidebar-footer-actions">
              <button className="secondary-button logout-button sidebar-logout" type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>
                <LogOut aria-hidden="true" size={16} />
                <span>{t("logout")}</span>
              </button>
              <Link
                className={pathname === "/settings" ? "icon-button sidebar-settings-link active" : "icon-button sidebar-settings-link"}
                href="/settings"
                aria-label={t("settings")}
                aria-current={pathname === "/settings" ? "page" : undefined}
                title={t("settings")}
                onClick={() => setMobileNavOpen(false)}
              >
                <Settings aria-hidden="true" size={18} />
              </Link>
            </div>
          </div>
        </div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <div className="control-group">
            <label htmlFor="account-switcher-desktop">{t("account")}</label>
            <select id="account-switcher-desktop" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={!accountOptions.length}>
              {accountOptions.length ? (
                accountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))
              ) : (
                <option value={accountId}>{tx("Loading account")}</option>
              )}
            </select>
          </div>
          <div className="topbar-actions">
            <div className="control-group compact">
              <label htmlFor="language-switcher-desktop">{t("language")}</label>
              <select id="language-switcher-desktop" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
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
            {notificationCenter("desktop-notification-panel", "notification-center desktop-notification-center")}
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
    <SessionProvider>
      <PreferencesProvider>
        <ShellContent>{children}</ShellContent>
      </PreferencesProvider>
    </SessionProvider>
  );
}
