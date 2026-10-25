import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/motion.css";
import "./styles/tokens.css";
import "./styles/gallery.css";
import "./styles/high-contrast.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
