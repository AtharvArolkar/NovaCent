"use client";

import type { ReactNode } from "react";
import { usePreferences } from "@/lib/client/preferences";

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  const { tx } = usePreferences();
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{tx("Workspace")}</p>
        <h1>{tx(title)}</h1>
        <p>{tx(description)}</p>
      </div>
      {action ? <div className="page-actions">{action}</div> : null}
    </header>
  );
}

export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  const { tx } = usePreferences();
  return (
    <article className="metric-card">
      <span>{tx(label)}</span>
      <strong>{value}</strong>
      <p>{tx(detail)}</p>
    </article>
  );
}

export function Panel({ title, children, aside, id }: { title: string; children: ReactNode; aside?: ReactNode; id?: string }) {
  const { tx } = usePreferences();
  const translatedTitle = tx(title);
  return (
    <section className="panel" id={id} aria-labelledby={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>
      <div className="panel-heading">
        <h2 id={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>{translatedTitle}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ProgressBar({ label, value }: { label: string; value: number }) {
  const { tx } = usePreferences();
  const bounded = Math.max(0, Math.min(100, value));
  const translatedLabel = tx(label);
  return (
    <div className="progress-row">
      <span>{translatedLabel}</span>
      <div className="progress-track" aria-label={`${translatedLabel} ${bounded}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded}>
        <span style={{ width: `${bounded}%` }} />
      </div>
      <b>{bounded}%</b>
    </div>
  );
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "warn" | "bad" | "neutral" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  const { tx } = usePreferences();
  return (
    <div className="empty-state">
      <h2>{tx(title)}</h2>
      <p>{tx(description)}</p>
    </div>
  );
}
