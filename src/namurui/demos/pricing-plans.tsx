import { useState } from "react";
import { PricingPlans, type PlanPeriod, type Plan } from "../pricing-plans";

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 30,
    yearly: 24,
    limits: [
      { label: "Monthly visitors", value: "10k", icon: "visitors" },
      { label: "Seats", value: "2", icon: "seats" },
      { label: "Workspaces", value: "1", icon: "workspaces" },
    ],
    details: {
      cadence: "Hourly",
      sync: "Native sync",
      appsLabel: "Choose 2 of 7",
      features: [
        { label: "Unlimited dashboards", included: true },
        { label: "Custom domains" },
        { label: "API access" },
        { label: "Scheduled reports", included: true },
        { label: "SSO" },
        { label: "Dedicated onboarding" },
        { label: "Email support", included: true },
      ],
    },
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 99,
    yearly: 79,
    badge: "Popular",
    featured: true,
    limits: [
      { label: "Monthly visitors", value: "100k", icon: "visitors" },
      { label: "Seats", value: "10", icon: "seats" },
      { label: "Workspaces", value: "3", icon: "workspaces" },
    ],
    details: {
      cadence: "Every 15 min",
      sync: "Native sync",
      appsLabel: "Choose 4 of 7",
      features: [
        { label: "Unlimited dashboards", included: true },
        { label: "Custom domains", included: true },
        { label: "API access", included: true },
        { label: "Scheduled reports", included: true },
        { label: "SSO" },
        { label: "Dedicated onboarding" },
        { label: "Chat + Email support", included: true },
      ],
    },
  },
  {
    id: "scale",
    name: "Scale",
    monthly: 249,
    yearly: 199,
    limits: [
      { label: "Monthly visitors", value: "1M", icon: "visitors" },
      { label: "Seats", value: "Unlimited", icon: "seats" },
      { label: "Workspaces", value: "10", icon: "workspaces" },
    ],
    details: {
      cadence: "Real-time",
      sync: "Native sync",
      appsLabel: "Choose 7 of 7",
      features: [
        { label: "Unlimited dashboards", included: true },
        { label: "Custom domains", included: true },
        { label: "API access", included: true },
        { label: "Scheduled reports", included: true },
        { label: "SSO" },
        { label: "Dedicated onboarding", included: true },
        { label: "Priority support + Slack channel", included: true },
      ],
    },
  },
];

export default function Demo() {
  const [billing, setBilling] = useState<PlanPeriod>("yearly");
  const [selected, setSelected] = useState<{ plan: string; billing: PlanPeriod } | null>(null);

  return (
    <>
      <PricingPlans
        plans={PLANS}
        billing={billing}
        onBillingChange={setBilling}
        onSelect={(plan, period) => setSelected({ plan: plan.name, billing: period })}
      />

      {selected ? (
        <p
          role="status"
          style={{
            margin: "0 16px 16px",
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--panel)",
            boxShadow: "inset 0 0 0 1px var(--border)",
            font: "400 12.5px/1.5 Inter, system-ui, sans-serif",
            color: "var(--text-muted)",
          }}
        >
          {selected.plan} · {selected.billing === "yearly" ? "billed yearly" : "billed monthly"} — starting checkout
        </p>
      ) : null}
    </>
  );
}
