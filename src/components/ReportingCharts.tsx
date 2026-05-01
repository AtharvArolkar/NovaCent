"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BudgetVariancePoint,
  CashFlowPoint,
  LabeledAmount,
  MerchantTrendPoint,
  PartySummaryPoint,
} from "@/lib/reporting";
import { usePreferences } from "@/lib/client/preferences";

const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--accent-alt)"];
const tooltipStyle = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "var(--shadow)",
  color: "var(--text)"
};
const tooltipTextStyle = {
  color: "var(--text)"
};

function formatCurrency(amount: number, currency = "INR") {
  const currencyCode = currency.toUpperCase();
  try {
    return `${new Intl.NumberFormat("en-IN", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(amount)} ${currencyCode}`;
  } catch {
    return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)} ${currencyCode}`;
  }
}

function valueLabel(value: number | string | Array<number | string>, currency = "INR") {
  if (Array.isArray(value)) return value.join(" - ");
  return typeof value === "number" ? formatCurrency(value, currency) : value;
}

function ChartFrame({
  title,
  ariaLabel,
  children,
}: {
  title: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const { tx } = usePreferences();
  return (
    <div className="chart-frame" role="img" aria-label={tx(ariaLabel)}>
      <div className="chart-title">{tx(title)}</div>
      {children}
    </div>
  );
}

export function ChartSkeleton({ label = "Loading report visual" }: { label?: string }) {
  const { tx } = usePreferences();
  return (
    <div className="chart-skeleton" role="status" aria-label={tx(label)}>
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export function AccessibleDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: { key: string; header: string; numeric?: boolean; format?: (value: unknown) => string }[];
  rows: unknown[];
}) {
  const { tx } = usePreferences();
  return (
    <details className="chart-table">
      <summary>{tx("Data table")}</summary>
      <div className="table-wrap">
        <table>
          <caption>{tx(caption)}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th className={column.numeric ? "numeric" : undefined} key={column.key} scope="col">
                  {tx(column.header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${caption}-${index}`}>
                {columns.map((column) => (
                  <td className={column.numeric ? "numeric" : undefined} key={column.key}>
                    {column.format
                      ? column.format((row as Record<string, unknown>)[column.key])
                      : String((row as Record<string, unknown>)[column.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function CategoryBreakdownChart({ data }: { data: LabeledAmount[] }) {
  const { defaultCurrency, tx } = usePreferences();
  const formatValue = (value: number | string | Array<number | string>) => valueLabel(value, defaultCurrency);
  return (
    <>
      <ChartFrame
        title="Category mix"
        ariaLabel={`Category spend chart with ${data.map((row) => `${tx(row.label)} ${formatCurrency(row.value, defaultCurrency)}`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={58} outerRadius={96} paddingAngle={3}>
              {data.map((row, index) => (
                <Cell fill={palette[index % palette.length]} key={row.label} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={formatValue} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AccessibleDataTable
        caption="Category spend totals"
        columns={[
          { key: "label", header: "Category" },
          { key: "value", header: "Spend", numeric: true, format: (value) => formatCurrency(Number(value), defaultCurrency) },
        ]}
        rows={data}
      />
    </>
  );
}

export function CashFlowTrendChart({ data }: { data: CashFlowPoint[] }) {
  const { defaultCurrency, tx } = usePreferences();
  const formatValue = (value: number | string | Array<number | string>) => valueLabel(value, defaultCurrency);
  const rows = data.map((row) => ({ ...row, saved: row.income - row.spend }));
  return (
    <>
      <ChartFrame title="Monthly cash flow" ariaLabel="Monthly income, spend, and saved amount trend chart">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={42} />
            <Tooltip contentStyle={tooltipStyle} formatter={formatValue} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
            <Legend />
            <Area dataKey="income" fill="var(--chart-2-soft)" name={tx("Income")} stroke="var(--chart-2)" type="monotone" />
            <Bar dataKey="spend" fill="var(--chart-1)" name={tx("Spend")} radius={[6, 6, 0, 0]} />
            <Line dataKey="saved" dot={{ r: 4 }} name={tx("Saved")} stroke="var(--chart-5)" strokeWidth={3} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AccessibleDataTable
        caption="Monthly income, spend, and saved report"
        columns={[
          { key: "label", header: "Month" },
          { key: "income", header: "Income", numeric: true, format: (value) => formatCurrency(Number(value), defaultCurrency) },
          { key: "spend", header: "Spend", numeric: true, format: (value) => formatCurrency(Number(value), defaultCurrency) },
          { key: "saved", header: "Saved", numeric: true, format: (value) => formatCurrency(Number(value), defaultCurrency) },
        ]}
        rows={rows}
      />
    </>
  );
}

export function BudgetVarianceChart({ data }: { data: BudgetVariancePoint[] }) {
  const { defaultCurrency, tx } = usePreferences();
  const formatValue = (value: number | string | Array<number | string>) => valueLabel(value, defaultCurrency);
  return (
    <>
      <ChartFrame title="Budget variance" ariaLabel="Budget variance chart comparing actual spend with budget limit">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 6, right: 18, bottom: 0, left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} type="number" />
            <YAxis dataKey="label" type="category" width={96} />
            <Tooltip contentStyle={tooltipStyle} formatter={formatValue} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
            <Legend />
            <Bar dataKey="budget" fill="var(--muted)" name={tx("Budget")} radius={[0, 6, 6, 0]} />
            <Bar dataKey="actual" fill="var(--chart-2)" name={tx("Actual")} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AccessibleDataTable
        caption="Budget variance by category"
        columns={[
          { key: "label", header: "Category" },
          { key: "budget", header: "Budget", numeric: true, format: (value) => formatCurrency(Number(value), defaultCurrency) },
          { key: "actual", header: "Actual", numeric: true, format: (value) => formatCurrency(Number(value), defaultCurrency) },
          { key: "remaining", header: "Remaining", numeric: true, format: (value) => formatCurrency(Number(value), defaultCurrency) },
          { key: "usage", header: "Used", numeric: true, format: (value) => `${value}%` },
        ]}
        rows={data}
      />
    </>
  );
}

export function MerchantTrendsChart({ data }: { data: MerchantTrendPoint[] }) {
  const { defaultCurrency, tx } = usePreferences();
  const formatValue = (value: number | string | Array<number | string>) => valueLabel(value, defaultCurrency);
  return (
    <ChartFrame title="Merchant trend lanes" ariaLabel="Merchant and category spending trends by month">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={42} />
          <Tooltip contentStyle={tooltipStyle} formatter={formatValue} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
          <Legend />
          <Line dataKey="food" name={tx("Food merchants")} stroke="var(--chart-2)" strokeWidth={3} type="monotone" />
          <Line dataKey="travel" name={tx("Travel merchants")} stroke="var(--chart-1)" strokeWidth={3} type="monotone" />
          <Line dataKey="shopping" name={tx("Shopping merchants")} stroke="var(--chart-5)" strokeWidth={3} type="monotone" />
          <Line dataKey="subscriptions" name={tx("Subscriptions")} stroke="var(--chart-4)" strokeWidth={3} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function SummaryBarsChart({
  data,
  title,
  label,
}: {
  data: LabeledAmount[];
  title: string;
  label: string;
}) {
  const { defaultCurrency, tx } = usePreferences();
  const formatValue = (value: number | string | Array<number | string>) => valueLabel(value, defaultCurrency);
  return (
    <>
      <ChartFrame title={title} ariaLabel={label}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={42} />
            <Tooltip contentStyle={tooltipStyle} formatter={formatValue} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
            <Bar dataKey="value" fill="var(--chart-3)" radius={[6, 6, 0, 0]}>
              {data.map((row, index) => (
                <Cell fill={palette[index % palette.length]} key={row.label} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AccessibleDataTable
        caption={`${tx(title)} ${tx("data")}`}
        columns={[
          { key: "label", header: "Label" },
          { key: "value", header: "Amount", numeric: true, format: (value) => formatCurrency(Number(value), defaultCurrency) },
        ]}
        rows={data}
      />
    </>
  );
}

export function PartySummaryChart({ data }: { data: PartySummaryPoint[] }) {
  const { defaultCurrency, tx } = usePreferences();
  const formatValue = (value: number | string | Array<number | string>) => valueLabel(value, defaultCurrency);
  return (
    <>
      <ChartFrame title="Party balances" ariaLabel="Party outstanding and settled balance comparison">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={42} />
            <Tooltip contentStyle={tooltipStyle} formatter={formatValue} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
            <Legend />
            <Area dataKey="outstanding" fill="var(--chart-5-soft)" name={tx("Outstanding")} stroke="var(--chart-5)" type="monotone" />
            <Area dataKey="settled" fill="var(--chart-2-soft)" name={tx("Settled")} stroke="var(--chart-2)" type="monotone" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AccessibleDataTable
        caption="Party outstanding and settled balances"
        columns={[
          { key: "label", header: "Party" },
          { key: "outstanding", header: "Outstanding", numeric: true, format: (value) => formatCurrency(Number(value), defaultCurrency) },
          { key: "settled", header: "Settled", numeric: true, format: (value) => formatCurrency(Number(value), defaultCurrency) },
        ]}
        rows={data}
      />
    </>
  );
}
