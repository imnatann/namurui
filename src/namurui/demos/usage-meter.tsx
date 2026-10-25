import { useState } from "react";
import {
  UsageMeter,
  type UsageMeterCategory,
  type UsageMeterDay,
  type UsageMeterLimit,
  type UsageMeterPeriod,
  type UsageState,
} from "../usage-meter";

const periods: UsageMeterPeriod[] = [
  { id: "month", label: "This month" },
  { id: "last", label: "Last month" },
  { id: "week", label: "7 days" },
];

const now = new Date();

/* A day label for a date that many days from today – negative is in the past */
const dayLabel = (offset: number) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const monthSeries = [117, 164, 340, 282, 479, 378, 410, 181, 184, 367, 356, 489, 344, 413, 213, 245, 429, 351, 393, 546, 511, 228];
const lastSeries = [260, 296, 309, 350, 326, 416, 370, 284, 262, 344, 326, 400, 312, 354, 276, 300, 386, 330, 361, 419, 395, 288, 313, 375, 279, 325, 391, 265, 319, 369];
const weekSeries = [262, 318, 271, 352, 308, 395, 344];

/* This month: 22 days in, 8 still to come – the shape the real card ships with */
const monthDays: UsageMeterDay[] = [
  ...monthSeries.map((value, index) => ({ label: dayLabel(index - (monthSeries.length - 1)), value })),
  ...Array.from({ length: 8 }, (_, index) => ({ label: dayLabel(index + 1), value: null })),
];

/* Last month is done, so every day carries a number */
const lastDays: UsageMeterDay[] = lastSeries.map((value, index) => ({
  label: new Date(now.getFullYear(), now.getMonth() - 1, index + 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  }),
  value,
}));

const weekDays: UsageMeterDay[] = weekSeries.map((value, index) => ({
  label: dayLabel(index - (weekSeries.length - 1)),
  value,
}));

const limits: UsageMeterLimit[] = [
  { id: "seats", label: "Seats", used: 8, total: 10 },
  { id: "storage", label: "Storage", used: 3.2, total: 5, unit: "GB", decimals: 1 },
  { id: "projects", label: "Projects", used: 12, total: null },
];

type PeriodData = {
  categories: UsageMeterCategory[];
  limits: UsageMeterLimit[];
  daily: UsageMeterDay[];
};

const data: Record<string, PeriodData> = {
  month: {
    categories: [
      { id: "chat", label: "Chat", value: 3980 },
      { id: "search", label: "Search", value: 1640 },
      { id: "image", label: "Image", value: 1120 },
      { id: "api", label: "API", value: 680 },
    ],
    limits,
    daily: monthDays,
  },
  last: {
    categories: [
      { id: "chat", label: "Chat", value: 5210 },
      { id: "search", label: "Search", value: 2140 },
      { id: "image", label: "Image", value: 1690 },
      { id: "api", label: "API", value: 960 },
    ],
    limits: [
      { id: "seats", label: "Seats", used: 10, total: 10 },
      { id: "storage", label: "Storage", used: 2.9, total: 5, unit: "GB", decimals: 1 },
      { id: "projects", label: "Projects", used: 11, total: null },
    ],
    daily: lastDays,
  },
  week: {
    categories: [
      { id: "chat", label: "Chat", value: 1180 },
      { id: "search", label: "Search", value: 520 },
      { id: "image", label: "Image", value: 310 },
      { id: "api", label: "API", value: 240 },
    ],
    limits,
    daily: weekDays,
  },
};

/* The card's plan renews nine days out, whenever the demo is opened */
const resetsAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 9);

export default function Demo() {
  const [period, setPeriod] = useState("month");
  const [said, setSaid] = useState<string | null>(null);
  const shown = data[period] ?? data.month;

  const onAction = (state: UsageState) => {
    setSaid(
      state === "ok"
        ? "Upgrade – the plan picker would open here"
        : state === "warn"
          ? "Add credits – the top-up sheet would open here"
          : "Add credits – the account is out of credits",
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        width: "100%",
        maxWidth: 460,
        margin: "0 auto",
        padding: "24px 0 32px",
      }}
    >
      <UsageMeter
        title="Acme AI"
        plan="Pro plan"
        resetAt={resetsAt}
        total={10000}
        categories={shown.categories}
        limits={shown.limits}
        daily={shown.daily}
        periods={periods}
        period={period}
        onPeriodChange={setPeriod}
        onAction={onAction}
      />
      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted)" }}>
        Hover a category to read it in the bar, or tab to the bar and the sparkline and step with the
        arrow keys. Switch the period to watch the card move from room left to over the cap — Last
        month is the one that has run out.
        {said ? ` ${said}.` : ""}
      </p>
    </div>
  );
}
