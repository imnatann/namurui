import { useState } from "react";
import { ReasoningBlock } from "../reasoning-block";

/* Four blocks from one assistant turn of the OMP client: the plain trace, the narration the
 * provider filed as thinking, a trace the provider shortened, and one it sealed outright.
 * Each keeps its own open state, so opening one leaves the others where they were. */
const PLAIN = `The bridge drops the socket on restart, so the client has to tell a gap apart from a
clean exit. The reconnect countdown already lives in the connection banner.

Check what get_state returns after a restart: if the session id is unchanged the history is
intact and only the live frames are missing. That is the difference the banner has to state.`;

const NARRATION = `I'll read the bridge module before touching the client. The restart path is the one that
loses frames, so the client needs to know when it came back rather than when it left.`;

const AFTER_NARRATION = `The banner already owns the countdown, so the block only has to report the gap. No new
state is needed on the client: the bridge sends its ready frame with the session id attached.`;

const SUMMARY = `Three candidate causes for the missing frames: the socket closes before the final
flush, the client clears its buffer on error, or the server sends the settle frame to the old
connection. The second is the only one the client can fix alone, so start there.`;

/* The one line under the stack: what the last copy handed to the handler. */
const HINT =
  "Press a header to open its body, or Copy to send the reasoning through onCopy. The redacted block has no copy control.";

export default function Demo() {
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        width: "100%",
        maxWidth: 560,
        margin: "0 auto",
        padding: "24px 0 32px",
      }}
    >
      <ReasoningBlock
        text={PLAIN}
        durationMs={3200}
        tokens={418}
        onCopy={(text) => setCopied(`plain · ${text.length} characters`)}
      />

      <ReasoningBlock
        text={AFTER_NARRATION}
        narration={NARRATION}
        durationMs={780}
        tokens={96}
        onCopy={(text) => setCopied(`narration · ${text.length} characters`)}
      />

      <ReasoningBlock
        text={SUMMARY}
        summary
        durationMs={12400}
        tokens={1_940}
        defaultOpen
        onCopy={(text) => setCopied(`summary · ${text.length} characters`)}
      />

      <ReasoningBlock
        text=""
        redacted
        durationMs={2100}
        defaultOpen
        onCopy={(text) => setCopied(`redacted · ${text.length} characters`)}
      />

      <p
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: "18px",
          color: "var(--text-muted, #6f625a)",
        }}
      >
        {copied === null ? HINT : `Copied from the ${copied}.`}
      </p>
    </div>
  );
}
