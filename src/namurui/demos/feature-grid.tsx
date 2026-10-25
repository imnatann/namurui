import { useState } from "react";
import { FeatureGrid, type FeatureCard } from "../feature-grid";

/*
 * Four cards from a WhatsApp support landing page, each with a scene drawn in plain markup:
 * a conversation list, a catalogue row with the answer it fed, a two-bubble thread that hands
 * off, and a pill over the three people who answer. The scenes are demo furniture, not
 * components: they live here so the grid stays a slot.
 */

const control = (active: boolean) => ({
  height: 30,
  padding: "0 12px",
  border: 0,
  borderRadius: 9,
  background: active ? "var(--hover-bg, #7a4a1c14)" : "transparent",
  boxShadow: active
    ? "inset 0 0 0 1px var(--border, #33291f)"
    : "inset 0 0 0 1px var(--border-soft, #1a14101a)",
  color: active ? "var(--text, #f4ece4)" : "var(--text-muted, #a2958a)",
  font: "inherit",
  fontSize: 12,
  letterSpacing: "-0.01em",
  cursor: "pointer",
});

export default function Demo() {
  const [columns, setColumns] = useState<2 | 3>(2);

  const cards: FeatureCard[] = [
    {
      id: "inbox",
      title: "Satu inbox untuk semua channel",
      copy: "WhatsApp, Instagram dan Telegram masuk ke satu daftar yang sama.",
      visual: <ConversationList />,
    },
    {
      id: "catalogue",
      title: "Jawaban dari data tokomu",
      copy: "AI mengutip stok dan harga dari katalog yang kamu unggah sendiri.",
      visual: <CatalogueRow />,
    },
    {
      id: "takeover",
      title: "Ambil alih kapan saja",
      copy: "Admin masuk ke percakapan yang sama tanpa kehilangan konteks.",
      visual: <HandoffThread />,
    },
    {
      id: "shared",
      title: "AI dan admin di thread yang sama",
      copy: "Satu pelanggan, satu riwayat, dua penjawab yang bergantian.",
      visual: <AnsweringTeam />,
    },
  ];

  return (
    <div style={{ display: "grid", gap: 16, width: "100%", maxWidth: 1120, margin: "0 auto", padding: "8px 0 24px" }}>
      <style href="ui-feature-grid-demo" precedence="default">
        {css}
      </style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted, #a2958a)" }}>
          Kolom
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={control(columns === 2)} aria-pressed={columns === 2} onClick={() => setColumns(2)}>
            Dua kolom
          </button>
          <button type="button" style={control(columns === 3)} aria-pressed={columns === 3} onClick={() => setColumns(3)}>
            Tiga kolom
          </button>
        </div>
      </div>

      <FeatureGrid items={cards} columns={columns} />
    </div>
  );
}

/* The three channels in one list. */
function ConversationList() {
  return (
    <div className="ui-fgr-demo__panel">
      <div className="ui-fgr-demo__row">
        <span className="ui-fgr-demo__face">AP</span>
        <span className="ui-fgr-demo__lines">
          <span className="ui-fgr-demo__name">Andi Pratama</span>
          <span className="ui-fgr-demo__preview">WhatsApp · Stok Fortuner masih ada?</span>
        </span>
        <span className="ui-fgr-demo__chip" data-tone="ok">
          AI membalas
        </span>
      </div>

      <div className="ui-fgr-demo__row">
        <span className="ui-fgr-demo__face">RL</span>
        <span className="ui-fgr-demo__lines">
          <span className="ui-fgr-demo__name">Rina Lestari</span>
          <span className="ui-fgr-demo__preview">Instagram · Bisa kirim ke Surabaya?</span>
        </span>
        <span className="ui-fgr-demo__chip" data-tone="new">
          Baru
          <span className="ui-fgr-demo__unread" aria-hidden="true" />
        </span>
      </div>

      <div className="ui-fgr-demo__row">
        <span className="ui-fgr-demo__face">BS</span>
        <span className="ui-fgr-demo__lines">
          <span className="ui-fgr-demo__name">Budi Santoso</span>
          <span className="ui-fgr-demo__preview">Telegram · Saya tunggu konfirmasinya</span>
        </span>
        <span className="ui-fgr-demo__chip">Menunggu</span>
      </div>
    </div>
  );
}

/* One catalogue entry, and the sentence it put in the answer. */
function CatalogueRow() {
  return (
    <div className="ui-fgr-demo__panel">
      <div className="ui-fgr-demo__stock">
        <span className="ui-fgr-demo__thumb">
          <span className="ui-fgr-demo__thumb-code">SUV</span>
        </span>
        <span className="ui-fgr-demo__lines">
          <span className="ui-fgr-demo__name">Fortuner 2.8 putih</span>
          <span className="ui-fgr-demo__preview">1 unit · gudang BSD</span>
        </span>
      </div>
      <div className="ui-fgr-demo__cite">
        <span className="ui-fgr-demo__pill">Dipakai di jawaban AI</span>
        <p className="ui-fgr-demo__quote">
          &ldquo;Tersisa satu unit putih di gudang BSD, siap kirim minggu ini.&rdquo;
        </p>
      </div>
      <p className="ui-fgr-demo__source">Katalog · 24 item · hari ini</p>
    </div>
  );
}

/* The same conversation card 1 lists, opened: two bubbles, then the note that says who took over. */
function HandoffThread() {
  return (
    <div className="ui-fgr-demo__chat">
      <div className="ui-fgr-demo__chat-head">
        <span className="ui-fgr-demo__face">AP</span>
        <span className="ui-fgr-demo__lines">
          <span className="ui-fgr-demo__name">Andi Pratama</span>
          <span className="ui-fgr-demo__preview">WhatsApp · dua unit</span>
        </span>
        <span className="ui-fgr-demo__chip">Admin online</span>
      </div>
      <div className="ui-fgr-demo__thread">
        <p className="ui-fgr-demo__bubble" data-side="in">
          Bisa nego untuk pembelian dua unit?
        </p>
        <p className="ui-fgr-demo__bubble" data-side="out">
          Bisa, potongan 4 juta untuk dua unit.
          <span className="ui-fgr-demo__tag">AI</span>
        </p>
      </div>
      <span className="ui-fgr-demo__note">
        <span className="ui-fgr-demo__dot" aria-hidden="true" />
        Dialihkan ke admin · konteks lengkap
      </span>
    </div>
  );
}

/* The people behind one thread: the cluster, who answered when, and a caption. */
function AnsweringTeam() {
  return (
    <div className="ui-fgr-demo__team">
      <div className="ui-fgr-demo__cluster">
        <span className="ui-fgr-demo__face" data-size="lg">
          AI
        </span>
        <span className="ui-fgr-demo__face" data-size="lg">
          RL
        </span>
        <span className="ui-fgr-demo__face" data-size="lg">
          AP
        </span>
        <span className="ui-fgr-demo__over">Bergantian</span>
      </div>
      <p className="ui-fgr-demo__caption">AI membuka, Rina mengambil alih, Andi menutup.</p>
      <div className="ui-fgr-demo__shift">
        <span className="ui-fgr-demo__step">
          <span className="ui-fgr-demo__face">AI</span>
          <span className="ui-fgr-demo__time">09:12</span>
        </span>
        <span className="ui-fgr-demo__step">
          <span className="ui-fgr-demo__face">RL</span>
          <span className="ui-fgr-demo__time">09:14</span>
        </span>
        <span className="ui-fgr-demo__step">
          <span className="ui-fgr-demo__face">AP</span>
          <span className="ui-fgr-demo__time">09:16</span>
        </span>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-fgr-demo__panel {
  display: grid;
  width: 100%;
  max-width: 23rem;
  padding: 4px;
  border-radius: 0.75rem;
  background: var(--panel, #fffdfb);
  box-shadow: inset 0 0 0 1px var(--border-soft, #1a14101a), 0 6px 18px -14px #1a141033;
  color: var(--text, #1a1410);
  font-size: 12px;
  line-height: 16px;
  letter-spacing: -0.01em;
}
.ui-fgr-demo__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 0.5rem;
}
.ui-fgr-demo__row + .ui-fgr-demo__row {
  box-shadow: inset 0 1px 0 var(--border-soft, #1a141012);
}
.ui-fgr-demo__face {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--muted-bg, #7a4a1c0a);
  box-shadow: inset 0 0 0 1px var(--border-soft, #1a141012);
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.ui-fgr-demo__face[data-size="lg"] {
  width: 40px;
  height: 40px;
  font-size: 12px;
}
.ui-fgr-demo__lines {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 1px;
}
.ui-fgr-demo__name {
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-fgr-demo__preview {
  overflow: hidden;
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  line-height: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ui-fgr-demo__chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--muted-bg, #7a4a1c0a);
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  font-weight: 600;
  line-height: 15px;
  white-space: nowrap;
}
.ui-fgr-demo__chip[data-tone="ok"] {
  background: color-mix(in srgb, var(--success, #1a7a4a) 16%, transparent);
  color: var(--success, #1a7a4a);
}
/* The dark success (#4f9d6e) measures 4.29 on the chip's wash; 78% of it toward the ink
 * measures 5.47 there, and the light theme keeps the raw token at 4.68. */
:where(.dark, [data-theme="dark"]) .ui-fgr-demo__chip[data-tone="ok"] {
  color: color-mix(in srgb, var(--success, #4f9d6e) 78%, var(--text, #f4ece4));
}
.ui-fgr-demo__chip[data-tone="new"] {
  background: var(--muted-bg, #7a4a1c0a);
  color: var(--text, #1a1410);
}
.ui-fgr-demo__unread {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

/* Catalogue --------------------------------------------------------------- */
.ui-fgr-demo__stock {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
}
.ui-fgr-demo__thumb {
  display: grid;
  flex: none;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 0.5rem;
  background: var(--muted-bg, #7a4a1c0a);
  box-shadow: inset 0 0 0 1px var(--border-soft, #1a141012);
}
.ui-fgr-demo__thumb-code {
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.ui-fgr-demo__cite {
  display: grid;
  gap: 5px;
  padding: 8px 8px 9px;
  box-shadow: inset 0 1px 0 var(--border-soft, #1a141012);
}
.ui-fgr-demo__pill {
  justify-self: start;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--muted-bg, #7a4a1c0a);
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  font-weight: 600;
  line-height: 15px;
}
.ui-fgr-demo__source {
  margin: 0;
  padding: 7px 8px 4px;
  box-shadow: inset 0 1px 0 var(--border-soft, #1a141012);
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  line-height: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ui-fgr-demo__quote {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  line-height: 15px;
}

/* Thread ------------------------------------------------------------------ */
/* The conversation card 1 lists, opened: header, bubbles, then the takeover note. */
.ui-fgr-demo__chat {
  display: grid;
  justify-items: start;
  gap: 7px;
  width: 100%;
  max-width: 23rem;
  padding: 7px;
  border-radius: 0.75rem;
  background: var(--panel, #fffdfb);
  box-shadow: inset 0 0 0 1px var(--border-soft, #1a14101a), 0 6px 18px -14px #1a141033;
  color: var(--text, #1a1410);
  font-size: 12px;
  line-height: 16px;
  letter-spacing: -0.01em;
}
.ui-fgr-demo__chat-head {
  display: flex;
  align-items: center;
  justify-self: stretch;
  gap: 8px;
  min-width: 0;
  padding: 1px 2px 7px;
  box-shadow: inset 0 -1px 0 var(--border-soft, #1a141012);
}
.ui-fgr-demo__thread {
  display: grid;
  gap: 6px;
  justify-self: stretch;
}
.ui-fgr-demo__bubble {
  max-width: 88%;
  margin: 0;
  padding: 6px 10px;
  border-radius: 0.875rem;
  font-size: 11px;
  line-height: 15px;
}
.ui-fgr-demo__bubble[data-side="in"] {
  justify-self: start;
  border-bottom-left-radius: 0.25rem;
  background: var(--muted-bg, #7a4a1c0a);
  box-shadow: inset 0 0 0 1px var(--border-soft, #1a14101a);
  color: var(--text, #1a1410);
}
.ui-fgr-demo__bubble[data-side="out"] {
  justify-self: end;
  border-bottom-right-radius: 0.25rem;
  background: var(--accent, #c2410c);
  color: var(--accent-fg, #fffdfb);
}
.ui-fgr-demo__tag {
  /* The tag's own 18% white wash lifts the accent to #cd6338, where the inherited
   * --accent-fg (#fffdfb in the light theme) measures 3.81. #1a0f08 measures 4.87
   * on that wash, and 7.89 on the dark theme's #ff8659. */
  --ui-fgr-demo-tag-ink: #1a0f08;
  display: inline-block;
  margin-left: 6px;
  padding: 0 4px;
  border-radius: 4px;
  background: #ffffff2e;
  color: var(--ui-fgr-demo-tag-ink, #1a0f08);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  vertical-align: 1px;
}
.ui-fgr-demo__note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  margin-top: 1px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--muted-bg, #7a4a1c0a);
  box-shadow: inset 0 0 0 1px var(--border-soft, #1a141012);
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  line-height: 15px;
}
.ui-fgr-demo__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--success, #1a7a4a);
}

/* Team -------------------------------------------------------------------- */
.ui-fgr-demo__team {
  display: grid;
  justify-items: center;
  gap: 10px;
  width: 100%;
  max-width: 23rem;
  padding: 16px 12px 14px;
  border-radius: 0.75rem;
  background: var(--panel, #fffdfb);
  box-shadow: inset 0 0 0 1px var(--border-soft, #1a14101a), 0 6px 18px -14px #1a141033;
  color: var(--text, #1a1410);
  font-size: 12px;
  line-height: 16px;
  letter-spacing: -0.01em;
}
.ui-fgr-demo__cluster {
  display: flex;
  align-items: center;
}
.ui-fgr-demo__cluster .ui-fgr-demo__face + .ui-fgr-demo__face {
  margin-left: -12px;
}
.ui-fgr-demo__cluster .ui-fgr-demo__face {
  box-shadow: 0 0 0 2px var(--panel, #fffdfb), inset 0 0 0 1px var(--border-soft, #1a141012);
  background: var(--preview, #fdfaf7);
}
.ui-fgr-demo__over {
  margin-left: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--muted-bg, #7a4a1c0a);
  box-shadow: inset 0 0 0 1px var(--border, #e8e0d7);
  color: var(--text, #1a1410);
  font-size: 11px;
  font-weight: 600;
  line-height: 15px;
  white-space: nowrap;
}
.ui-fgr-demo__shift {
  display: flex;
  align-items: center;
  justify-content: space-between;
  justify-self: stretch;
  gap: 8px;
  padding-top: 11px;
  box-shadow: inset 0 1px 0 var(--border-soft, #1a141012);
}
.ui-fgr-demo__step {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.ui-fgr-demo__time {
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  line-height: 15px;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
}
.ui-fgr-demo__caption {
  margin: 0;
  color: var(--text-muted, #6f625a);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}

/* Under 26rem the card's visual slot is about 180px wide: the shift strip stacks into three
 * columns, the "Bergantian" pill drops below the cluster, and each row's status chip moves to
 * its own right-aligned line so the name keeps its full width. */
@media (max-width: 26rem) {
  .ui-fgr-demo__row {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    row-gap: 3px;
  }
  .ui-fgr-demo__row .ui-fgr-demo__chip {
    grid-column: 2;
    justify-self: start;
  }
  .ui-fgr-demo__chat-head .ui-fgr-demo__chip {
    display: none;
  }
  .ui-fgr-demo__cluster {
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 6px;
  }
  .ui-fgr-demo__over {
    margin-left: 0;
  }
  .ui-fgr-demo__shift {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
  }
  .ui-fgr-demo__step {
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .ui-fgr-demo__stock {
    gap: 8px;
  }
  /* The handoff note wraps to two lines at this width: a capsule around two lines
   * reads as a lozenge, so it takes the panel's radius instead. */
  .ui-fgr-demo__note {
    border-radius: 0.5rem;
  }
}
`;
