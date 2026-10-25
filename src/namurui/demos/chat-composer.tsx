import { useRef, useState } from "react";
import { ChatComposer, defaultModels, type ChatModel } from "../chat-composer";

type Sent = { id: number; text: string; model: string };

/** What the mic hears while the trace runs */
const TRANSCRIPT = "Draft a note to Priya about the renewal moving to the 12th.";

export default function Demo() {
  const [value, setValue] = useState("");
  const [modelId, setModelId] = useState(defaultModels[0].id);
  const [sent, setSent] = useState<Sent[]>([]);
  const nextId = useRef(0);

  const send = (message: string, model: ChatModel) => {
    nextId.current += 1;
    setSent((all) => [{ id: nextId.current, text: message, model: model.name }, ...all].slice(0, 3));
    setValue("");
  };

  return (
    <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 560, justifyItems: "stretch" }}>
      {/* Approval and app connection walk their own sequences; the draft and model are held here */}
      <ChatComposer
        value={value}
        onChange={setValue}
        onSend={send}
        models={defaultModels}
        modelId={modelId}
        onModelChange={(model) => setModelId(model.id)}
        heard={TRANSCRIPT}
      />

      {sent.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
          {sent.map((item) => (
            <li
              key={item.id}
              style={{
                padding: "9px 12px",
                borderRadius: 10,
                boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.08)",
                font: "400 13px/20px Inter, system-ui, sans-serif",
              }}
            >
              <span style={{ display: "block", fontSize: 11, opacity: 0.55 }}>
                Sent with {item.model}
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
