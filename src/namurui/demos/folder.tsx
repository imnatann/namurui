import { useState } from "react";
import {
  FolderScreen,
  type FolderFile,
  type FolderFileColor,
  type FolderFileExt,
  type FolderNews,
} from "../folder";

const START: FolderFile[] = [
  { id: "campaign-brief", name: "Campaign-Brief", ext: "DOC", color: "blue", time: "2 hours ago" },
  { id: "launch-plan", name: "Launch-Plan", ext: "PDF", color: "rose", time: "Yesterday" },
  { id: "media-budget", name: "Media-Budget", ext: "XLS", color: "emerald", time: "Yesterday" },
  { id: "ad-copy", name: "Ad-Copy", ext: "DOC", color: "blue", time: "3 days ago" },
  { id: "results-q2", name: "Results-Q2", ext: "XLS", color: "emerald", time: "Last week" },
];

const NEWS: FolderNews = {
  kicker: "New in Acme",
  title: "Shared folders",
  more: "Full changelog",
  count: 2,
};

const TONES: FolderFileColor[] = ["blue", "rose", "emerald"];

/** Turns an uploaded file into a card: type from the extension, tone cycled across the batch */
function fromUploaded(file: File, index: number): FolderFile {
  const suffix = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
  let ext: FolderFileExt = "DOC";
  if (suffix === "pdf") ext = "PDF";
  else if (suffix === "xls" || suffix === "xlsx" || suffix === "csv") ext = "XLS";

  return {
    id: `${file.name}-${file.size}-${index}`,
    name: file.name.slice(0, file.name.lastIndexOf(".")) || file.name,
    ext,
    color: TONES[index % TONES.length],
    time: "Just now",
  };
}

export default function Demo() {
  const [files, setFiles] = useState<FolderFile[]>(START);
  const [news, setNews] = useState<FolderNews | null>(NEWS);
  const [last, setLast] = useState("Open a file, share the folder, or drop in a new brief");

  return (
    <div className="d-folder">
      <style href="ui-demo-folder" precedence="default">
        {css}
      </style>

      <div className="d-folder__frame">
        <FolderScreen
          files={files}
          news={news}
          onNavigate={(label) => setLast(`Sidebar · ${label}`)}
          onBack={() => setLast("Back to Files")}
          onOpenFile={(file) => setLast(`Opening ${file.name}.${file.ext.toLowerCase()}`)}
          onShare={() => setLast("Share link copied — anyone in Acme can open this folder")}
          onMore={() => setLast("Folder actions")}
          onUpload={(picked) => {
            setFiles((current) => [...current, ...picked.map(fromUploaded)]);
            setLast(`Uploading ${picked.length} file${picked.length === 1 ? "" : "s"} to Q3 Campaign`);
          }}
          onDismissNews={() => {
            setNews(null);
            setLast("Changelog card dismissed");
          }}
          onOpenGuide={() => setLast("Getting started · 13% complete")}
          onCollapsedChange={(value) => setLast(value ? "Sidebar collapsed" : "Sidebar opened")}
          onAccount={() => setLast("Account · Alex Morgan")}
          onWorkspace={() => setLast("Workspace switcher")}
          onSearch={() => setLast("Search across Acme")}
        />
      </div>

      <p className="d-folder__status" role="status" aria-live="polite">
        {last}
      </p>
    </div>
  );
}

const css = /* css */ `
.d-folder {
  display: grid;
  gap: 10px;
  justify-items: center;
  width: 100%;
}
.d-folder__frame {
  width: 100%;
  max-width: 1160px;
  height: min(760px, 78vh);
  min-height: 560px;
  overflow: hidden;
  border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
  border-radius: 18px;
  background: var(--bg, #f8f8f8);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 12px 40px rgba(0, 0, 0, 0.06);
}
.d-folder__status {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted, #737373);
  text-align: center;
}
`;
