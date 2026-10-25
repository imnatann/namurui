import { useState } from "react";
import { FilterMenu, type FilterGroup, type FilterValue } from "../filter-menu";

const groups: FilterGroup[] = [
  {
    id: "stage",
    label: "Stage",
    options: [
      { id: "new", label: "New lead" },
      { id: "qualified", label: "Qualified" },
      { id: "proposal", label: "Proposal sent" },
      { id: "won", label: "Won" },
    ],
  },
  {
    id: "owner",
    label: "Owner",
    options: [
      { id: "lena", label: "Lena Hart" },
      { id: "jonas", label: "Jonas Weber" },
      { id: "priya", label: "Priya Shah" },
    ],
  },
  {
    id: "size",
    label: "Deal size",
    chipPrefix: "Deal: ",
    options: [
      { id: "s", label: "Under $10k" },
      { id: "m", label: "$10k – $50k" },
      { id: "l", label: "Over $50k" },
    ],
  },
  {
    id: "region",
    label: "Region",
    options: [
      { id: "dach", label: "DACH" },
      { id: "nordics", label: "Nordics" },
      { id: "uk", label: "UK & Ireland" },
    ],
  },
];

const start: FilterValue = { stage: ["proposal"], size: ["m"] };

export default function Demo() {
  const [filters, setFilters] = useState<FilterValue>(start);
  const picked = Object.values(filters).flat().length;
  const shown = picked === 0 ? 128 : Math.max(4, Math.round(128 / (1 + picked * 0.9)));

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 420 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#171717" }}>Pipeline · Q4</span>
        <span style={{ fontSize: 12.5, color: "#8f8f8f" }}>$4.2M open</span>
      </div>

      <FilterMenu
        groups={groups}
        value={filters}
        onChange={setFilters}
        defaultOpen={["stage", "owner"]}
        title="Deal filters"
      />

      <p role="status" style={{ margin: 0, fontSize: 12.5, color: "#8f8f8f" }}>
        {picked === 0
          ? `No filters — showing all 128 deals`
          : `${picked} filter${picked === 1 ? "" : "s"} on — about ${shown} of 128 deals`}
      </p>
    </div>
  );
}
