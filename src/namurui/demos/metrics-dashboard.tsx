import { useMemo, useState } from "react";
import {
  MetricsDashboard,
  type MdChange,
  type MdMetric,
  type MdRangeOption,
  type MdRow,
  type MdUnits,
} from "../metrics-dashboard";

const RANGES: MdRangeOption[] = [
  { id: "7d", label: "Week", caption: "Last 7 days" },
  { id: "30d", label: "Month", caption: "Last 30 days" },
  { id: "90d", label: "Quarter", caption: "Last 13 weeks" },
];

/** The day the store is read on, so every period ends on the same date */
const TODAY = { year: 2025, month: 9, day: 24 };

/** The last 30 days of revenue, exactly as the shop booked it */
const MONTH_REVENUE = [
  9940, 12448, 12592, 8659, 8219, 8004, 9616, 10487, 10651, 12489, 8743, 8188, 8891, 8895, 11372,
  11835, 13039, 8125, 8043, 7704, 10290, 10124, 10952, 10948, 7774, 8893, 7732, 8867, 11939, 14315,
];

/** The quarter, bucketed by week */
const QUARTER_REVENUE = [
  61200, 63400, 59800, 66100, 70300, 68900, 72400, 74800, 71200, 76900, 80100, 78500, 82600,
];

const MOVES: Record<string, { revenue: number; orders: number; aov: number; refunds: number }> = {
  "7d": { revenue: 6.4, orders: 5.1, aov: 1.2, refunds: -0.2 },
  "30d": { revenue: 11.7, orders: 10.8, aov: 0.8, refunds: 0 },
  "90d": { revenue: 8.9, orders: 7.4, aov: 1.4, refunds: 0.3 },
};

const UNITS: Record<string, MdUnits> = {
  revenue: { kind: "money" },
  orders: { kind: "count" },
  aov: { kind: "money", decimals: 2 },
  refunds: { kind: "percent", decimals: 1 },
};

const PRODUCTS = ["Linen overshirt", "Everyday tote", "Merino crew", "Canvas sneaker", "Wool beanie"];
const PRODUCT_VALUES: Record<string, number[]> = {
  revenue: [65950, 47964, 38971, 26980, 17986],
  orders: [1000, 727, 591, 409, 273],
  aov: [78.4, 71.25, 66.1, 58.9, 51.3],
  refunds: [1.9, 2.2, 2.5, 1.7, 2.8],
};

const CHANNELS = ["Online store", "Instagram", "Marketplace", "Wholesale", "Pop-up"];
const CHANNEL_VALUES: Record<string, number[]> = {
  revenue: [137896, 62953, 41968, 32975, 14989],
  orders: [2091, 955, 636, 500, 227],
  aov: [65.94, 65.92, 65.99, 65.95, 66.03],
  refunds: [2.0, 2.4, 2.2, 1.8, 2.6],
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A seven-day rhythm, so the dashed overlay is not a trace of today */
const WOBBLE = [0.92, 0.98, 0.9, 1.04, 0.95, 1, 0.93];

const round1 = (value: number) => Math.round(value * 10) / 10;

/** One caption per point, counted back from the day the store is read */
function labelsBack(count: number, stepDays: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(TODAY.year, TODAY.month, TODAY.day - (count - 1 - index) * stepDays);
    return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  });
}

/** The period before: reshaped inside the same totals, or nudged when it is a rate */
function previousFor(values: number[], move: number, rate: boolean) {
  const wobbled = values.map((value, index) => value * WOBBLE[index % WOBBLE.length]);
  if (rate) return wobbled.map((value) => round1(value / (1 + move / 100)));

  const after = values.reduce((carried, value) => carried + value, 0);
  const before = after / (1 + move / 100);
  const scale = before / wobbled.reduce((carried, value) => carried + value, 0);
  const scaled = wobbled.map((value) => Math.round(value * scale));
  scaled[scaled.length - 1] +=
    Math.round(before) - scaled.reduce((carried, value) => carried + value, 0);
  return scaled;
}

function rowsFor(names: string[], values: number[], metric: string, scale: number): MdRow[] {
  return names.map((name, index) => ({
    name,
    value:
      metric === "revenue" || metric === "orders"
        ? Math.round(values[index] * scale)
        : values[index],
  }));
}

function buildFrom(revenue: number[], rangeId: string, labels: string[]): MdMetric[] {
  const move = MOVES[rangeId];
  const total = revenue.reduce((carried, value) => carried + value, 0);

  /* Orders at the store's average basket, so the daily figures add up to the headline */
  const orders = revenue.map((value) => Math.round(value / 65.93));
  const orderTotal = orders.reduce((carried, value) => carried + value, 0);
  const aov = revenue.map((value, index) => Math.round((value / orders[index]) * 100) / 100);

  /* The refund share follows trading – busier days carry a few more returns */
  const peak = Math.max(...revenue, 1);
  const refunds = revenue.map((value) => round1(1.94 + (value / peak - 0.5) * 0.8));
  const refundRate = round1(
    refunds.reduce((carried, value) => carried + value, 0) / refunds.length,
  );

  const scale = total / 299774;

  const table = [
    { id: "revenue", label: "Revenue", value: total, series: revenue, move: move.revenue, rate: false },
    { id: "orders", label: "Orders", value: orderTotal, series: orders, move: move.orders, rate: false },
    {
      id: "aov",
      label: "Avg. order",
      value: Math.round((total / orderTotal) * 100) / 100,
      series: aov,
      move: move.aov,
      rate: true,
    },
    {
      id: "refunds",
      label: "Refund rate",
      value: refundRate,
      series: refunds,
      move: move.refunds,
      rate: true,
    },
  ];

  return table.map((entry) => {
    const change: MdChange =
      entry.id === "refunds"
        ? {
            amount: Math.abs(entry.move),
            unit: "pts",
            trend: entry.move > 0 ? "up" : "down",
            good: entry.move < 0,
          }
        : {
            amount: Math.abs(entry.move),
            trend: entry.move < 0 ? "down" : "up",
            good: entry.move >= 0,
          };

    return {
      id: entry.id,
      label: entry.label,
      value: entry.value,
      change,
      units: UNITS[entry.id],
      series: entry.series,
      previous: previousFor(entry.series, entry.move, entry.rate),
      labels,
      products: rowsFor(PRODUCTS, PRODUCT_VALUES[entry.id], entry.id, scale),
      channels: rowsFor(CHANNELS, CHANNEL_VALUES[entry.id], entry.id, scale),
    };
  });
}

function build(rangeId: string): MdMetric[] {
  if (rangeId === "90d") return buildFrom(QUARTER_REVENUE, rangeId, labelsBack(13, 7));

  const revenue = rangeId === "7d" ? MONTH_REVENUE.slice(-7) : MONTH_REVENUE;
  return buildFrom(revenue, rangeId, labelsBack(revenue.length, 1));
}

/** Export hands back a real file: one row per point, in the metric's own unit */
function exportCsv(period: string, metric: string, metrics: MdMetric[]) {
  const active = metrics.find((entry) => entry.id === metric);
  if (!active) return;

  const rows: string[][] = [
    ["point", active.label],
    ...active.series.map((value, index) => [active.labels?.[index] ?? `${index + 1}`, String(value)]),
  ];
  const url = URL.createObjectURL(
    new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${metric}-${period}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Demo() {
  const [range, setRange] = useState("30d");
  const metrics = useMemo(() => build(range), [range]);

  return (
    <MetricsDashboard
      title="Sales"
      site="Northwind Store"
      metrics={metrics}
      range={{ options: RANGES, value: range, onChange: setRange, label: "Period" }}
      defaultMetric="revenue"
      onExport={(period, metric) => exportCsv(period, metric, metrics)}
    />
  );
}
