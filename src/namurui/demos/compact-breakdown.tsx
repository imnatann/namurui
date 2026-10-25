import { useState } from "react";
import { CompactBreakdown, type BreakdownPeriod } from "../compact-breakdown";

/* Segments sit in the order the bar stacks them, so a channel keeps one hue across periods and
 * only the ranked rows below change places. The 7d and 30d figures are the ones the reference
 * shows; 90d continues the same channels over a longer window. */
const PERIODS: BreakdownPeriod[] = [
  {
    id: "7d",
    label: "7d",
    delta: 12.4,
    segments: [
      { id: "direct", label: "Direct", value: 4820 },
      { id: "organic", label: "Organic search", value: 3910 },
      { id: "referral", label: "Referrals", value: 2240 },
      { id: "social", label: "Social", value: 1680 },
      { id: "email", label: "Email", value: 940 },
    ],
  },
  {
    id: "30d",
    label: "30d",
    delta: 8.1,
    segments: [
      { id: "direct", label: "Direct", value: 16900 },
      { id: "organic", label: "Organic search", value: 18400 },
      { id: "referral", label: "Referrals", value: 7300 },
      { id: "social", label: "Social", value: 9800 },
      { id: "email", label: "Email", value: 5200 },
    ],
  },
  {
    id: "90d",
    label: "90d",
    delta: -2.6,
    segments: [
      { id: "direct", label: "Direct", value: 61900 },
      { id: "organic", label: "Organic search", value: 78400 },
      { id: "referral", label: "Referrals", value: 27100 },
      { id: "social", label: "Social", value: 19600 },
      { id: "email", label: "Email", value: 12800 },
    ],
  },
];

export default function Demo() {
  const [period, setPeriod] = useState("30d");

  return (
    <div style={{ display: "grid", justifyItems: "center", width: "100%" }}>
      <CompactBreakdown
        periods={PERIODS}
        period={period}
        onPeriodChange={setPeriod}
        title="Revenue by channel"
        caption="Total revenue"
      />
    </div>
  );
}
