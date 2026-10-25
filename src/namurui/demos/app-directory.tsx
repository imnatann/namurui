import { useState } from "react";
import { AppDirectory, directoryDefaultApps, type AppDirectoryApp } from "../app-directory";

export default function Demo() {
  const [apps, setApps] = useState<AppDirectoryApp[]>(directoryDefaultApps);

  /* A real connect is an OAuth round trip: hold the button busy, then record what came back. */
  const settle = async (app: AppDirectoryApp) => {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 650);
    });
    setApps((list) =>
      list.map((item) => (item.id === app.id ? { ...item, connected: !item.connected } : item)),
    );
  };

  return <AppDirectory apps={apps} onConnect={settle} onDisconnect={settle} />;
}
