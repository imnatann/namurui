import { KpiChart, type KpiSeries } from "../kpi-chart";

/* Seven days of revenue by channel, as the reference card shows them. */
const labels = ["Mar 3", "Mar 4", "Mar 5", "Mar 6", "Mar 7", "Mar 8", "Mar 9"];

const series: KpiSeries[] = [
  { label: "Organic", color: "#2f6bff", values: [4200, 4700, 3900, 4600, 5400, 5100, 5900] },
  { label: "Paid ads", color: "#ec4899", values: [3600, 3300, 4400, 4800, 4000, 4500, 4200] },
  { label: "Referral", color: "#8b5cf6", values: [1800, 2300, 2000, 1500, 2400, 2200, 2700] },
  { label: "Email", color: "#14b8a6", values: [1200, 1100, 1700, 2100, 1600, 1300, 1500] },
  { label: "Direct", color: "#a3a3a3", values: [600, 900, 700, 800, 1000, 1400, 1100] },
];

const dates = labels.map((_, at) =>
  new Date(2025, 2, 3 + at).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }),
);

export default function Demo() {
  return (
    <KpiChart
      title="Revenue"
      value={96400}
      delta={7900}
      labels={labels}
      dates={dates}
      series={series}
      formatValue={(amount) =>
        `$${amount >= 1000 ? `${Number((amount / 1000).toFixed(1))}k` : Math.round(amount)}`
      }
      footer="Top 5 channels"
    />
  );
}
