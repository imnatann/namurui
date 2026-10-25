import { ChannelInbox, type PreviewConversation } from "../channel-inbox";

/* Three conversations from three channels, as the inbox preview shows them: one answered by the
 * AI, one new and unread, one waiting on the customer. */
const CONVERSATIONS: PreviewConversation[] = [
  {
    id: "andi-pratama",
    name: "Andi Pratama",
    initials: "AP",
    channel: "whatsapp",
    preview: "Siap, alamat lengkapnya saya kirim sekarang.",
    status: "AI membalas",
    statusTone: "info",
  },
  {
    id: "rina-lestari",
    name: "Rina Lestari",
    initials: "RL",
    channel: "instagram",
    preview: "Warna hitam ukuran M masih ada, Kak?",
    status: "Baru",
    statusTone: "accent",
    unread: true,
  },
  {
    id: "budi-santoso",
    name: "Budi Santoso",
    initials: "BS",
    channel: "telegram",
    preview: "Saya tunggu konfirmasi jadwal kirimnya, ya.",
    status: "Menunggu pelanggan",
    statusTone: "neutral",
  },
];

export default function Demo() {
  return (
    <div
      style={{
        display: "grid",
        justifyItems: "center",
        width: "100%",
        padding: "24px 0 32px",
      }}
    >
      <ChannelInbox items={CONVERSATIONS} />
    </div>
  );
}
