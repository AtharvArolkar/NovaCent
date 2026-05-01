import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">Workspace</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="page-actions">{action}</div> : null}
    </header>
  );
}

export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="panel" aria-labelledby={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>
      <div className="panel-heading">
        <h2 id={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ProgressBar({ label, value }: { label: string; value: number }) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-row">
      <span>{label}</span>
      <div className="progress-track" aria-label={`${label} ${bounded}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded}>
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
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
