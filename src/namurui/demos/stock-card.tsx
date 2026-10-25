import { useState } from "react";
import { StockCard } from "../stock-card";

/**
 * Two catalogue entries: the Fortuner the AI cited when a customer asked about stock, and an
 * entry with no citation so the card's closing rule is visible. The toggle drops the citation
 * from the first card and brings it back, which is the only state this card has.
 */
export default function Demo() {
  const [cited, setCited] = useState(true);

  return (
    <div className="stk-demo">
      <style href="ui-demo-stock-card" precedence="default">
        {css}
      </style>

      <div className="stk-demo__grid">
        <div className="stk-demo__case">
          <StockCard
            item={{
              code: "SUV",
              name: "Fortuner 2.8 putih",
              meta: "1 unit · gudang BSD",
            }}
            cite={
              cited
                ? {
                    label: "Dipakai di jawaban AI",
                    quote: "Ada, Kak. Putih 2.8 masih 1 unit di gudang BSD.",
                  }
                : undefined
            }
          />
          <button
            type="button"
            className="stk-demo__toggle"
            aria-pressed={cited}
            onClick={() => setCited((value) => !value)}
          >
            {cited ? "Sembunyikan sitasi" : "Tampilkan sitasi"}
          </button>
        </div>

        <div className="stk-demo__case">
          <StockCard
            item={{
              code: "MPV",
              name: "Avanza 1.5 G",
              meta: "3 unit · gudang Jakarta",
            }}
          />
          <p className="stk-demo__note">Tanpa sitasi, kartu berhenti setelah baris produk.</p>
        </div>
      </div>
    </div>
  );
}

const css = `
.stk-demo {
  display: flex;
  justify-content: center;
  width: 100%;
  padding: 8px 0;
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.stk-demo *, .stk-demo *::before, .stk-demo *::after { box-sizing: border-box; }

.stk-demo__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 21rem));
  justify-content: center;
  gap: 24px;
  width: 100%;
}

.stk-demo__case {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.stk-demo__toggle {
  height: 30px;
  padding: 0 11px;
  border: 1px solid #ded4ca;
  border-radius: 8px;
  background: #fffdfb;
  color: #68584b;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
.stk-demo__toggle:hover { background: #faf7f4; border-color: #d3c6b8; }
.stk-demo__toggle:focus-visible {
  outline: 2px solid #c2410c;
  outline-offset: 2px;
}

.stk-demo__note {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: #68584b;
}

:where(.dark, [data-theme="dark"]) .stk-demo__toggle {
  border-color: rgba(255, 253, 251, 0.14);
  background: #201a15;
  color: #a2958a;
}
:where(.dark, [data-theme="dark"]) .stk-demo__toggle:hover {
  background: #26201a;
  border-color: rgba(255, 253, 251, 0.24);
}
:where(.dark, [data-theme="dark"]) .stk-demo__toggle:focus-visible { outline-color: #ff6b35; }
:where(.dark, [data-theme="dark"]) .stk-demo__note { color: #a2958a; }

@media (prefers-reduced-motion: reduce) {
  .stk-demo__toggle { transition-duration: 1ms; }
}
`;
