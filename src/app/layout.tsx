import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { appConfig } from "@/lib/app-config";
import "./globals.css";

export const metadata: Metadata = {
  title: appConfig.name,
  description: appConfig.tagline,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
