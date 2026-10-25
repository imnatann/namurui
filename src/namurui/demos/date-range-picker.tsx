import { useState } from "react";
import { DateRangePicker, type CompareMode, type DateRange } from "../date-range-picker";

/** The day the reference was captured. Pinned so the preview always shows the same window –
 *  drop the `today` prop and the picker follows the real clock. */
const REFERENCE_DAY = new Date(2026, 9, 24);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const day = (date: Date) => `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

const MODE_LABEL: Record<CompareMode, string> = {
  off: "no comparison",
  previous: "previous period",
  year: "previous year",
};

type Applied = { range: DateRange; compare: DateRange | null; mode: CompareMode };

export default function Demo() {
  const [applied, setApplied] = useState<Applied | null>(null);

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 660 }}>
      <DateRangePicker
        today={REFERENCE_DAY}
        defaultOpen
        onChange={(range, compare, mode) => setApplied({ range, compare, mode })}
      />

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: "18px", minHeight: 18 }}>
        {applied
          ? `Report window ${day(applied.range.start)} – ${day(applied.range.end)} · ${MODE_LABEL[applied.mode]}${
              applied.compare ? ` (${day(applied.compare.start)} – ${day(applied.compare.end)})` : ""
            }`
          : "No window applied yet – the report is still on the default last 30 days."}
      </p>
    </div>
  );
}
