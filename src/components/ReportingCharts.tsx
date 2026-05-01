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

const palette = ["#0f766e", "#2563eb", "#be123c", "#b45309", "#7c3aed", "#15803d"];
const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function valueLabel(value: number | string | Array<number | string>) {
  if (Array.isArray(value)) return value.join(" - ");
  return typeof value === "number" ? money.format(value) : value;
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
  return (
    <div className="chart-frame" role="img" aria-label={ariaLabel}>
      <div className="chart-title">{title}</div>
      {children}
    </div>
  );
}

export function ChartSkeleton({ label = "Loading report visual" }: { label?: string }) {
  return (
    <div className="chart-skeleton" role="status" aria-label={label}>
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
  return (
    <details className="chart-table">
      <summary>Data table</summary>
      <div className="table-wrap">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th className={column.numeric ? "numeric" : undefined} key={column.key} scope="col">
                  {column.header}
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
  return (
    <>
      <ChartFrame
        title="Category mix"
        ariaLabel={`Category spend chart with ${data.map((row) => `${row.label} ${money.format(row.value)}`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={58} outerRadius={96} paddingAngle={3}>
              {data.map((row, index) => (
                <Cell fill={palette[index % palette.length]} key={row.label} />
              ))}
            </Pie>
            <Tooltip formatter={valueLabel} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AccessibleDataTable
        caption="Category spend totals"
        columns={[
          { key: "label", header: "Category" },
          { key: "value", header: "Spend", numeric: true, format: (value) => money.format(Number(value)) },
        ]}
        rows={data}
      />
    </>
  );
}

export function CashFlowTrendChart({ data }: { data: CashFlowPoint[] }) {
  const rows = data.map((row) => ({ ...row, saved: row.income - row.spend }));
  return (
    <>
      <ChartFrame title="Monthly cash flow" ariaLabel="Monthly income, spend, and saved amount trend chart">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={42} />
            <Tooltip formatter={valueLabel} />
            <Legend />
            <Area dataKey="income" fill="#0f766e22" stroke="#0f766e" type="monotone" />
            <Bar dataKey="spend" fill="#2563eb" radius={[6, 6, 0, 0]} />
            <Line dataKey="saved" dot={{ r: 4 }} stroke="#be123c" strokeWidth={3} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AccessibleDataTable
        caption="Monthly income, spend, and saved report"
        columns={[
          { key: "label", header: "Month" },
          { key: "income", header: "Income", numeric: true, format: (value) => money.format(Number(value)) },
          { key: "spend", header: "Spend", numeric: true, format: (value) => money.format(Number(value)) },
          { key: "saved", header: "Saved", numeric: true, format: (value) => money.format(Number(value)) },
        ]}
        rows={rows}
      />
    </>
  );
}

export function BudgetVarianceChart({ data }: { data: BudgetVariancePoint[] }) {
  return (
    <>
      <ChartFrame title="Budget variance" ariaLabel="Budget variance chart comparing actual spend with budget limit">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 6, right: 18, bottom: 0, left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} type="number" />
            <YAxis dataKey="label" type="category" width={96} />
            <Tooltip formatter={valueLabel} />
            <Legend />
            <Bar dataKey="budget" fill="#9ca3af" name="Budget" radius={[0, 6, 6, 0]} />
            <Bar dataKey="actual" fill="#0f766e" name="Actual" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AccessibleDataTable
        caption="Budget variance by category"
        columns={[
          { key: "label", header: "Category" },
          { key: "budget", header: "Budget", numeric: true, format: (value) => money.format(Number(value)) },
          { key: "actual", header: "Actual", numeric: true, format: (value) => money.format(Number(value)) },
          { key: "remaining", header: "Remaining", numeric: true, format: (value) => money.format(Number(value)) },
          { key: "usage", header: "Used", numeric: true, format: (value) => `${value}%` },
        ]}
        rows={data}
      />
    </>
  );
}

export function MerchantTrendsChart({ data }: { data: MerchantTrendPoint[] }) {
  return (
    <ChartFrame title="Merchant trend lanes" ariaLabel="Merchant and category spending trends by month">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={42} />
          <Tooltip formatter={valueLabel} />
          <Legend />
          <Line dataKey="food" name="Food merchants" stroke="#0f766e" strokeWidth={3} type="monotone" />
          <Line dataKey="travel" name="Travel merchants" stroke="#2563eb" strokeWidth={3} type="monotone" />
          <Line dataKey="shopping" name="Shopping merchants" stroke="#be123c" strokeWidth={3} type="monotone" />
          <Line dataKey="subscriptions" name="Subscriptions" stroke="#b45309" strokeWidth={3} type="monotone" />
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
  return (
    <>
      <ChartFrame title={title} ariaLabel={label}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={42} />
            <Tooltip formatter={valueLabel} />
            <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]}>
              {data.map((row, index) => (
                <Cell fill={palette[index % palette.length]} key={row.label} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AccessibleDataTable
        caption={`${title} data`}
        columns={[
          { key: "label", header: "Label" },
          { key: "value", header: "Amount", numeric: true, format: (value) => money.format(Number(value)) },
        ]}
        rows={data}
      />
    </>
  );
}

export function PartySummaryChart({ data }: { data: PartySummaryPoint[] }) {
  return (
    <>
      <ChartFrame title="Party balances" ariaLabel="Party outstanding and settled balance comparison">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} width={42} />
            <Tooltip formatter={valueLabel} />
            <Legend />
            <Area dataKey="outstanding" fill="#be123c22" stroke="#be123c" type="monotone" />
            <Area dataKey="settled" fill="#0f766e22" stroke="#0f766e" type="monotone" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AccessibleDataTable
        caption="Party outstanding and settled balances"
        columns={[
          { key: "label", header: "Party" },
          { key: "outstanding", header: "Outstanding", numeric: true, format: (value) => money.format(Number(value)) },
          { key: "settled", header: "Settled", numeric: true, format: (value) => money.format(Number(value)) },
        ]}
        rows={data}
      />
    </>
  );
}
