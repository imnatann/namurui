import { useState } from "react";
import { PhoneMock, type PhoneThreadMessage } from "../phone-mock";

/* A real order follow-up on a service WhatsApp line: the customer opens with a fault on a unit
 * installed last month, the assistant answers with a slot, and the receipt sits under the last
 * outgoing bubble. Typing in the field appends to the same thread. */

const SEED: PhoneThreadMessage[] = [
  {
    id: "m1",
    side: "in",
    text: "Selamat pagi, AC kamar anak saya netes air terus dari tadi malam. Masih garansi kan?",
    at: "09:12",
  },
  {
    id: "m2",
    side: "out",
    text: "Pagi, Bu Rina. Unit yang dipasang 14 September masih garansi. Bocor indoor biasanya dari saluran pembuangan yang mampet, bukan kerusakan unit.",
    at: "09:13",
  },
  {
    id: "m3",
    side: "in",
    text: "Oh gitu. Bisa dicek hari ini? Saya di rumah sampai jam 4.",
    at: "09:15",
  },
  {
    id: "m4",
    side: "out",
    text: "Teknisi Andri bisa datang jam 13.00 sampai 15.00, biaya kunjungan Rp0 karena masih garansi. Saya jadwalkan ya?",
    at: "09:16",
  },
];

const clock = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

export default function Demo() {
  const [messages, setMessages] = useState<PhoneThreadMessage[]>(SEED);

  const send = (text: string) => {
    setMessages((current) => [
      ...current,
      { id: `m${current.length + 1}`, side: "out", text, at: clock() },
    ]);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        justifyItems: "center",
        width: "100%",
        padding: "24px 0 32px",
      }}
    >
      <PhoneMock
        statusTime="9:41"
        appBar={{
          title: "Rina Lestari",
          subtitle: "Garansi pemasangan · online",
          avatar: "RL",
          tag: "AI",
        }}
        messages={messages}
        composer={{ placeholder: "Balas pelanggan", label: "Balas Rina", onSend: send }}
      >
        <p
          style={{
            justifySelf: "center",
            padding: "3px 9px",
            borderRadius: 999,
            background: "var(--muted-bg, #7a4a1c0a)",
            color: "var(--text-muted, #6f625a)",
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Hari ini
        </p>
      </PhoneMock>

      <button
        type="button"
        onClick={() => setMessages(SEED)}
        style={{
          height: 30,
          padding: "0 12px",
          border: 0,
          borderRadius: 8,
          background: "transparent",
          boxShadow: "inset 0 0 0 1px var(--border, #e8e0d7)",
          color: "var(--text-muted, #6f625a)",
          font: "inherit",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Mulai ulang percakapan
      </button>
    </div>
  );
}
