import { useMemo, useState } from "react";
import { KpiBoard, type KpiStat, type KpiOverview, type KpiFocus } from "../kpi-board";

const RANGES = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
];

const SEGMENTS = [
  { id: "all", label: "All items" },
  { id: "pro", label: "Pro license" },
  { id: "team", label: "Team plan" },
];

/** How much of the store each segment is, so the overview answers the picker */
const SEGMENT_SHARE: Record<string, number> = { all: 1, pro: 0.62, team: 0.38 };

/** One range's totals: [this period, the period before] */
type Figures = {
  days: number;
  revenue: [number, number];
  emails: [number, number];
  refunds: [number, number];
  overview: [number, number];
  focus: [number, number];
};

const FIGURES: Record<string, Figures> = {
  "7d": {
    days: 7,
    revenue: [1480, 1253],
    emails: [11940, 10420],
    refunds: [26, 41],
    overview: [1210, 1024],
    focus: [214, 196],
  },
  "30d": {
    days: 30,
    revenue: [6061, 5031],
    emails: [50786, 46200],
    refunds: [107, 144],
    overview: [5192, 3583],
    focus: [883, 786],
  },
  "90d": {
    days: 90,
    revenue: [18272, 15166],
    emails: [163630, 138600],
    refunds: [280, 432],
    overview: [15939, 10741],
    focus: [2693, 2397],
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The board is read on 12 Oct 2026, so the ranges end there */
const TODAY = { year: 2026, month: 9, day: 12 };

function dayLabels(days: number) {
  return Array.from({ length: days }, (_, i) => {
    if (i === days - 1) return "Today";
    const date = new Date(TODAY.year, TODAY.month, TODAY.day - (days - 1 - i));
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  });
}

/** Deterministic traffic: a small seeded generator, so a range always draws the same line */
function shape(seed: number, count: number, drift: number, jitter: number) {
  let state = seed;
  let value = 1;
  return Array.from({ length: count }, () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    value = Math.max(0.55, value * (1 + (state / 2147483648 - 0.5) * jitter + drift));
    return value;
  });
}

/** Points that add up to the figure exactly, so the line and the number never disagree */
function toTotal(points: number[], total: number) {
  const sum = points.reduce((carried, point) => carried + point, 0) || 1;
  const scaled = points.map((point) => Math.round((point * total) / sum));
  scaled[scaled.length - 1] += total - scaled.reduce((carried, point) => carried + point, 0);
  return scaled;
}

function build(rangeId: string, segment: string) {
  const figures = FIGURES[rangeId];
  const days = figures.days;
  const share = SEGMENT_SHARE[segment] ?? 1;

  const revenue = toTotal(shape(11, days, 0.004, 0.18), figures.revenue[0]);
  const emails = toTotal(shape(23, days, 0.003, 0.22), figures.emails[0]);
  const refunds = toTotal(shape(41, days, -0.002, 0.3), figures.refunds[0]);
  const licenses = toTotal(shape(67, days, 0.012, 0.12), figures.focus[0]);

  const overview = Math.round(figures.overview[0] * share);
  const overviewBefore = Math.round(figures.overview[1] * share);

  const stats: KpiStat[] = [
    {
      id: "revenue",
      label: "Total revenue",
      value: figures.revenue[0],
      format: "money",
      change: { amount: figures.revenue[0] - figures.revenue[1], format: "money", good: true },
      series: revenue,
    },
    {
      id: "emails",
      label: "Emails sent",
      value: figures.emails[0],
      change: { amount: figures.emails[0] - figures.emails[1], format: "number", good: true },
      series: emails,
    },
    {
      id: "refunds",
      label: "Refunds",
      value: figures.refunds[0],
      change: { amount: figures.refunds[1] - figures.refunds[0], direction: "down", good: true },
      series: refunds,
    },
  ];

  const overviewCard: KpiOverview = {
    label: "Sales overview",
    value: overview,
    format: "money",
    change: {
      amount: Math.round((overview / overviewBefore - 1) * 1000) / 10,
      format: "percent",
      signed: true,
      good: true,
    },
    series: {
      current: toTotal(shape(5, days, 0.008, 0.1), overview),
      previous: toTotal(shape(9, days, 0.002, 0.08), overviewBefore),
    },
    segments: SEGMENTS,
  };

  const focus: KpiFocus = {
    title: "Pro license",
    caption: "One-time",
    label: "Licenses sold",
    value: figures.focus[0],
    unit: "licenses",
    series: licenses,
    previousValue: figures.focus[1],
    change: {
      amount: Math.round((figures.focus[0] / figures.focus[1] - 1) * 100),
      format: "percent",
      good: true,
    },
    setup: { label: "Set up" },
    action: { label: "See full analytics" },
  };

  return { stats, overview: overviewCard, focus, labels: dayLabels(days) };
}

export default function Demo() {
  const [range, setRange] = useState("30d");
  const [segment, setSegment] = useState("all");

  const data = useMemo(() => build(range, segment), [range, segment]);

  return (
    <KpiBoard
      title="Dashboard"
      range={{ options: RANGES, value: range, onChange: setRange, label: "Date range" }}
      stats={data.stats}
      overview={{ ...data.overview, segment, onSegmentChange: setSegment }}
      focus={{
        ...data.focus,
        /* The card is the Pro license, so setting it up filters the overview to that product. */
        setup: {
          label: "Set up",
          onClick: () => setSegment(segment === "pro" ? "all" : "pro"),
        },
        action: {
          label: "See full analytics",
          onClick: () => setRange(range === "90d" ? "30d" : "90d"),
        },
      }}
      labels={data.labels}
    />
  );
}
