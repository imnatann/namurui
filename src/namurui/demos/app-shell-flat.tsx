import { useState } from "react";
import { AppShellFlat } from "../app-shell-flat";

export default function Demo() {
  const [active, setActive] = useState("New chat");

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1100,
        height: 680,
        margin: "0 auto",
        overflow: "hidden",
        border: "1px solid var(--border)",
        borderRadius: 16,
        background: "var(--card)",
      }}
    >
      <AppShellFlat active={active} onNavigate={setActive} />
    </div>
  );
}
