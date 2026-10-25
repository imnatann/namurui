import { useState } from "react";
import { Button } from "../button";

export default function Demo() {
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(0);

  return (
    <div style={{ display: "grid", gap: 22, justifyItems: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        <Button
          variant="primary"
          loading={saving}
          onClick={() => {
            setSaving(true);
            window.setTimeout(() => {
              setSaving(false);
              setCount((n) => n + 1);
            }, 1800);
          }}
        >
          {saving ? "Saving changes" : count ? `Saved ${count}×` : "Save changes"}
        </Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button
          variant="destructive"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          Delete
        </Button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", alignItems: "center" }}>
        <Button
          variant="secondary"
          size="sm"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          }
        >
          Add item
        </Button>
        <Button
          variant="primary"
          iconRight={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          Continue
        </Button>
        <Button variant="ghost" size="lg">
          Large
        </Button>
        <Button variant="secondary" disabled>
          Disabled
        </Button>
      </div>
    </div>
  );
}
