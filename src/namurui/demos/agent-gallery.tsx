import { useState } from "react";

import { AgentGallery, defaultGalleryPanels } from "../agent-gallery";

/*
 * Seven agents in one strip, opened on Churn watch – the panel the live block shows. Picking a
 * slim panel or an arrow walks the strip and the caption follows the open agent.
 */
export default function Demo() {
  const [openId, setOpenId] = useState("churn-watch");
  const openIndex = Math.max(
    0,
    defaultGalleryPanels.findIndex((panel) => panel.id === openId),
  );

  return (
    <AgentGallery
      panels={defaultGalleryPanels}
      index={openIndex}
      onIndexChange={(next) => setOpenId(defaultGalleryPanels[next].id)}
    />
  );
}
