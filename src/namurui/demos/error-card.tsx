import { useEffect, useRef, useState } from "react";
import { ErrorCard } from "../error-card";

/* Three failures a turn can end on. The status is always the field the bridge sent; no
 * message below carries a number, so nothing here can be guessed from prose. */
type Scenario = {
  key: string; label: string; message: string; provider: string; model: string;
  httpStatus: number; retryable: boolean; attempt?: number; maxAttempts?: number;
};

const SCENARIOS: Scenario[] = [
  {
    key: "rate",
    label: "Rate limit",
    message: "Rate limit reached for requests on this key. The turn stopped before it answered.",
    provider: "Anthropic",
    model: "",
    httpStatus: 429,
    retryable: true,
  },
  {
    key: "auth",
    label: "Auth",
    message: "Invalid API key provided. The key was revoked after it was last used.",
    provider: "[OI]",
    model: "gpt-5.1",
    httpStatus: 401,
    retryable: false,
  },
  {
    key: "retry",
    label: "Scheduled retry",
    message: "The upstream provider closed the connection before sending a body.",
    provider: "OpenRouter",
    model: "deepseek/deepseek-v4",
    httpStatus: 502,
    retryable: true,
    attempt: 2,
    maxAttempts: 3,
  },
];

const chip = (active: boolean) => ({
  height: 28,
  padding: "0 11px",
  border: 0,
  borderRadius: 8,
  background: active ? "var(--text, #1a1410)" : "transparent",
  boxShadow: active ? "none" : "inset 0 0 0 1px var(--border, #e8e0d7)",
  color: active ? "var(--panel, #fffdfb)" : "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
});

export default function Demo() {
  const [index, setIndex] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [historical, setHistorical] = useState(false);
  const timer = useRef<number | null>(null);
  const scenario = SCENARIOS[index];

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const choose = (next: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setRetrying(false);
    setDismissed(false);
    setIndex(next);
  };

  /* A retry that lands on the same wall: the button holds for a beat, then the card folds
   * itself to the receipt so the transcript keeps the record. Undo brings it back. */
  const retry = () => {
    setRetrying(true);
    timer.current = window.setTimeout(() => {
      setRetrying(false);
      setDismissed(true);
      timer.current = null;
    }, 1100);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {SCENARIOS.map((item, i) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={i === index}
            style={chip(i === index)}
            onClick={() => choose(i)}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={historical}
          style={chip(historical)}
          onClick={() => setHistorical((current) => !current)}
        >
          From an earlier turn
        </button>
      </div>

      <ErrorCard
        key={scenario.key}
        message={scenario.message}
        provider={scenario.provider}
        model={scenario.model}
        httpStatus={scenario.httpStatus}
        retryable={scenario.retryable}
        attempt={scenario.attempt}
        maxAttempts={scenario.maxAttempts}
        retrying={retrying}
        dismissed={dismissed}
        isLatest={!historical}
        onRetry={retry}
        onDismiss={setDismissed}
      />

      <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--text-muted, #6f625a)" }}>
        {historical
          ? 'A failure replayed from history is not announced: only the newest one takes role="alert".'
          : "Retry runs for a beat, fails the same way, and folds the card to a receipt you can undo."}
      </p>
    </div>
  );
}
