import { useState } from "react";
import {
  DataTable,
  LinkColumnIcon,
  TagColumnIcon,
  TextColumnIcon,
  TitleColumnIcon,
  type DataColumn,
  type DataRow,
  type TagTone,
} from "../data-table";

const columns: DataColumn[] = [
  { key: "tool", label: "Tool", type: "title", icon: <TitleColumnIcon />, width: "30%" },
  {
    key: "category",
    label: "Category",
    type: "tag",
    icon: <TagColumnIcon />,
    width: "26%",
    options: ["Design", "Issue tracking", "Hosting", "Website", "Video"],
  },
  { key: "website", label: "Website", type: "link", icon: <LinkColumnIcon /> },
  { key: "renews", label: "Renews", type: "text", icon: <TextColumnIcon />, width: "18%" },
];

const tagTones: Record<string, TagTone> = {
  Design: "violet",
  "Issue tracking": "blue",
  Hosting: "gray",
  Website: "pink",
  Video: "green",
};

const initial: DataRow[] = [
  {
    id: "figma",
    tool: "Figma",
    category: "Design",
    website: "figma.com",
    renews: "Mar 12, 2026",
    logo: (
      <svg viewBox="0 0 38 57" aria-hidden="true">
        <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1ABCFE" />
        <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0ACF83" />
        <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262" />
        <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E" />
        <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF" />
      </svg>
    ),
  },
  {
    id: "linear",
    tool: "Linear",
    category: "Issue tracking",
    website: "linear.app",
    renews: "Jan 4, 2026",
    logo: (
      <svg viewBox="0 0 24 24" fill="#5E6AD2" aria-hidden="true">
        <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
      </svg>
    ),
  },
  {
    id: "vercel",
    tool: "Vercel",
    category: "Hosting",
    website: "vercel.com",
    renews: "Aug 21, 2026",
    logo: (
      <svg viewBox="0 0 24 24" fill="#171717" className="data-table-demo__mono" aria-hidden="true">
        <path d="M24 22.525H0l12-21.05 12 21.05z" />
      </svg>
    ),
  },
  {
    id: "framer",
    tool: "Framer",
    category: "Website",
    website: "framer.com",
    renews: "May 2, 2026",
    logo: (
      <svg viewBox="0 0 24 24" fill="#171717" className="data-table-demo__mono" aria-hidden="true">
        <path d="M4 0h16v8h-8zM4 8h8l8 8H4zM4 16h8v8z" />
      </svg>
    ),
  },
  {
    id: "loom",
    tool: "Loom",
    category: "Video",
    website: "loom.com",
    renews: "Nov 18, 2026",
    logo: (
      <svg viewBox="0 0 24 24" fill="#625DF5" aria-hidden="true">
        <path d="M24 10.665h-7.018l6.078-3.509-1.335-2.312-6.078 3.509 3.508-6.077L16.843.94l-3.508 6.077V0h-2.67v7.018L7.156.94 4.844 2.275l3.509 6.077-6.078-3.508L.94 7.156l6.078 3.509H0v2.67h7.017L.94 16.844l1.335 2.313 6.077-3.508-3.509 6.077 2.312 1.335 3.509-6.078V24h2.67v-7.017l3.508 6.077 2.312-1.335-3.509-6.078 6.078 3.509 1.335-2.313-6.077-3.508h7.017v-2.67H24zm-12 4.966a3.645 3.645 0 1 1 0-7.29 3.645 3.645 0 0 1 0 7.29z" />
      </svg>
    ),
  },
];

export default function Demo() {
  const [rows, setRows] = useState<DataRow[]>(initial);
  const [, setSelected] = useState<string[]>([]);

  return (
    <div style={{ width: "100%", maxWidth: 720 }}>
      <DataTable
        title="Design Stack"
        columns={columns}
        rows={rows}
        tagTones={tagTones}
        onRowsChange={setRows}
        onSelectionChange={setSelected}
      />
    </div>
  );
}
