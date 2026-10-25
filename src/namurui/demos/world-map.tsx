import { useState } from "react";
import { WorldMap, type Continent } from "../world-map";

export default function Demo() {
  const [continent, setContinent] = useState<Continent>("europe");

  return (
    <div style={{ width: "100%", maxWidth: 560 }}>
      <WorldMap continent={continent} onContinentChange={setContinent} />
    </div>
  );
}
