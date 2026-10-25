import { useState } from "react";
import { FaqAccordion, type FaqEntry } from "../faq-accordion";

/* The nine questions the pricing page has to answer before someone will connect a real number
 * to an assistant. Two of them carry a list, so the measured height has something to prove. */
const ENTRIES: FaqEntry[] = [
  {
    question: "How is this different from a WhatsApp auto-reply?",
    answer: (
      <p>
        An auto-reply matches a keyword and sends one canned line. This reads the whole
        conversation, checks the catalogue and the order history, then writes an answer for that
        customer. If it cannot ground the answer, it stops and asks a person instead of guessing.
      </p>
    ),
  },
  {
    question: "Which channels can it answer on?",
    answer: (
      <>
        <p>WhatsApp, Instagram direct messages, Telegram and the chat widget on your own site.</p>
        <ul>
          <li>One inbox for all four, so an admin never switches app to find a thread.</li>
          <li>A customer who moves from Instagram to WhatsApp keeps their history.</li>
          <li>Web chat can be embedded with a single script tag.</li>
        </ul>
      </>
    ),
  },
  {
    question: "Can more than one admin use the same number?",
    answer: (
      <p>
        Yes. Up to twelve seats share one number, and each conversation shows who is holding it.
        When someone takes over, the assistant goes quiet on that thread until they hand it back,
        so two people never answer the same customer at once.
      </p>
    ),
  },
  {
    question: "How does the AI know what to answer?",
    answer: (
      <p>
        You connect the sources you already keep: product sheets, price lists, stock levels,
        shipping rules and past conversations. Every answer cites the source it used, and a
        question with no source behind it is routed to a person rather than answered.
      </p>
    ),
  },
  {
    question: "When does it hand a conversation to a person?",
    answer: (
      <>
        <p>Three triggers, all of which you can tighten:</p>
        <ul>
          <li>The customer asks for a human, in any wording.</li>
          <li>The answer would need a source you have not connected.</li>
          <li>The customer is upset, or the thread has gone three turns without progress.</li>
        </ul>
        <p>The handoff carries the summary and the full transcript, so nobody starts over.</p>
      </>
    ),
  },
  {
    question: "How much does it cost?",
    answer: (
      <p>
        Four plans, billed monthly or yearly. The yearly rate takes two months off, and the
        conversation count resets on the first of the month rather than on your signup date.
        Nothing is charged per seat below the top plan.
      </p>
    ),
  },
  {
    question: "Is our customer data safe?",
    answer: (
      <p>
        Conversations are encrypted in transit and at rest, hosted in the region you choose, and
        never used to train a model. You can export or delete everything from the settings page,
        and the data processing agreement is available before you sign up.
      </p>
    ),
  },
  {
    question: "Can we try it before paying?",
    answer: (
      <p>
        A fourteen day trial on a real number, with the full assistant and no card. If the trial
        ends without a plan, the number is released and the transcripts are kept for thirty days
        in case you come back.
      </p>
    ),
  },
  {
    question: "How long does it take to go live?",
    answer: (
      <p>
        An afternoon for a catalogue and a phone number. Most teams are answering real customers
        the same day, and the assistant stays in draft mode, writing answers nobody sees, until
        you switch it on.
      </p>
    ),
  },
];

const control = {
  height: 30,
  padding: "0 12px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  /* The same mix the list uses for its hairlines: plain --border is 1.27:1 on the card and
   * the unselected button all but vanished in the dark preview. */
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--text, #1a1410) 12%, var(--border, #e8e0d7))",
  color: "var(--text-muted, #6f625a)",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

export default function Demo() {
  const [single, setSingle] = useState(true);

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        width: "100%",
        maxWidth: 768,
        margin: "0 auto",
        padding: "24px 0 32px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            minWidth: 0,
            fontSize: 12,
            lineHeight: 1.4,
            color: "var(--text-muted, #6f625a)",
          }}
        >
          {single ? "One answer at a time" : "Any number of answers open"}
        </span>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button
            type="button"
            style={{
              ...control,
              background: single ? "var(--accent, #c2410c)" : "transparent",
              /* 6.64:1 on --accent (#ff6b35) in dark, where --accent-fg flips to #1a0f08. */
              color: single ? "var(--accent-fg, #fffdfb)" : control.color,
            }}
            aria-pressed={single}
            onClick={() => setSingle(true)}
          >
            Single
          </button>
          <button
            type="button"
            style={{
              ...control,
              background: single ? "transparent" : "var(--accent, #c2410c)",
              /* 6.64:1 on --accent (#ff6b35) in dark, where --accent-fg flips to #1a0f08. */
              color: single ? control.color : "var(--accent-fg, #fffdfb)",
            }}
            aria-pressed={!single}
            onClick={() => setSingle(false)}
          >
            Multi
          </button>
        </div>
      </div>
      <FaqAccordion items={ENTRIES} single={single} defaultOpen={0} />
    </div>
  );
}
