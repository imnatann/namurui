import { useState } from "react";
import { ExperimentCard, type ExperimentVariant } from "../experiment-card";

/*
 * Three button-copy variants on day 9 of a fourteen-day test. The numbers are the ones the real
 * card was captured with: conversion (4.2 / 4.7 / 4.0), revenue per visitor, and bounce, where
 * lower is better. Committing a winner flips the status chip and the note on the right.
 */
const VARIANTS: ExperimentVariant[] = [
  {
    id: "a",
    key: "A",
    name: "Start free trial",
    control: true,
    values: { conversion: 4.2, revenue: 18.4, bounce: 41.2 },
  },
  {
    id: "b",
    key: "B",
    name: "Try it free",
    values: { conversion: 4.7, revenue: 19.1, bounce: 38.1 },
  },
  {
    id: "c",
    key: "C",
    name: "Get started – $0",
    values: { conversion: 4.0, revenue: 21.6, bounce: 43.8 },
  },
];

export default function Demo() {
  const [shipped, setShipped] = useState<ExperimentVariant | null>(null);

  return (
    <ExperimentCard
      name="Signup button copy"
      variants={VARIANTS}
      metrics={[
        { id: "conversion", label: "Conversion" },
        { id: "revenue", label: "Revenue", format: (value) => `$${value.toFixed(2)}` },
        { id: "bounce", label: "Bounce", lowerIsBetter: true },
      ]}
      status={shipped ? { label: "Shipped", tone: "green" } : { label: "Running", tone: "green" }}
      note={shipped ? `${shipped.key} live for all traffic` : "Day 9 of 14"}
      defaultOpen
      onPickWinner={(variant) => setShipped(variant)}
    />
  );
}
