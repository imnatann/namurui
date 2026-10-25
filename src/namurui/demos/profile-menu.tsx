import { useState } from "react";
import {
  AppsIcon,
  DocsIcon,
  LanguageIcon,
  LogoutIcon,
  ProfileMenu,
  SettingsIcon,
} from "../profile-menu";

const nextSteps = ["Add a profile photo", "Connect your calendar", "Invite a teammate"];

export default function Demo() {
  const [done, setDone] = useState(2);
  const [last, setLast] = useState("No action picked yet.");

  const next = done < 5 ? nextSteps[Math.min(done - 2, nextSteps.length - 1)] : undefined;

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 320 }}>
      <ProfileMenu
        name="Lena Hartmann"
        email="lena.hartmann@fastmail.com"
        avatar={
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, #6d8bff, #a06bff)",
              borderRadius: "50%",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            LH
          </span>
        }
        items={[
          { id: "settings", label: "Settings", icon: <SettingsIcon />, onSelect: () => setLast("Opened settings") },
          { id: "language", label: "Language", icon: <LanguageIcon />, badge: "DE", onSelect: () => setLast("Language set to German") },
          { id: "docs", label: "Docs & guides", icon: <DocsIcon />, onSelect: () => setLast("Opened the docs") },
          { id: "apps", label: "Connected apps", icon: <AppsIcon />, badge: "New", onSelect: () => setLast("Opened connected apps") },
          { id: "logout", label: "Log out", icon: <LogoutIcon />, onSelect: () => setLast("Signed out") },
        ]}
        setup={{
          done,
          total: 5,
          next,
          onContinue: () => {
            setDone((n) => Math.min(5, n + 1));
            setLast(next ? `Completed: ${next}` : "Profile complete");
          },
        }}
      />

      <p role="status" style={{ margin: 0, fontSize: 12.5, color: "#8f8f8f" }}>
        {last}
      </p>
    </div>
  );
}
