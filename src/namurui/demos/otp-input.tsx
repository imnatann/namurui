import { useEffect, useRef, useState } from "react";
import { OtpInput, type OtpStatus } from "../otp-input";

export default function Demo() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<OtpStatus>("idle");
  const [tries, setTries] = useState(3);
  const field = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  /** A real paste into the field – the component fills the boxes one after another */
  const paste = (value: string, frames = 90) => {
    const el = field.current?.querySelector("input");
    if (!el) return;
    el.focus();
    // Right after an error the field is locked for a moment while the wrong code fades out
    if (el.readOnly && frames > 0) {
      requestAnimationFrame(() => paste(value, frames - 1));
      return;
    }
    const data = new DataTransfer();
    data.setData("text/plain", value);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  };

  const verify = (value: string) => {
    setStatus("verifying");
    timers.current.push(
      window.setTimeout(() => {
        if (value === "123456") return setStatus("success");
        setTries((n) => Math.max(0, n - 1));
        setStatus("error");
      }, 1100),
    );
  };

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setCode("");
    setStatus("idle");
  };

  /** Clear whatever is on screen, then paste into a field that is accepting input again */
  const pasteFresh = (value: string) => {
    clear();
    requestAnimationFrame(() => paste(value));
  };

  return (
    <div style={card}>
      <div style={{ display: "grid", gap: 5 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#171717", letterSpacing: "-0.01em" }}>
          Check your email
        </h3>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#737373" }}>
          We sent a 6-digit code to lena@northwind.io. It expires in 10 minutes.
        </p>
      </div>

      <div ref={field}>
        <OtpInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (status === "error" && next) setStatus("idle");
          }}
          onComplete={verify}
          status={status}
          errorMessage={`That code didn't work. ${tries} ${tries === 1 ? "try" : "tries"} left.`}
          separator
          align="center"
          onResend={clear}
          resendIn={20}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        <button type="button" onClick={() => pasteFresh("123456")} style={chip}>
          Paste 123456
        </button>
        <button type="button" onClick={() => pasteFresh("482 913")} style={chip}>
          Paste a wrong code
        </button>
        <button type="button" onClick={() => { clear(); setTries(3); }} style={{ ...chip, background: "transparent", color: "#8f8f8f" }}>
          Start over
        </button>
      </div>

      <p role="status" style={{ margin: 0, fontSize: 12, textAlign: "center", color: "#a3a3a3" }}>
        {status === "success"
          ? "Signed in as lena@northwind.io"
          : status === "error"
            ? "The code was cleared — paste or type it again."
            : "Paste a whole code and every box fills in turn."}
      </p>
    </div>
  );
}

const card = {
  display: "grid",
  gap: 16,
  width: "100%",
  maxWidth: 420,
  padding: "22px 22px 20px",
  borderRadius: 16,
  background: "#ffffff",
  boxShadow: "inset 0 0 0 1px #ececec",
} as const;

const chip = {
  font: "inherit",
  fontSize: 12.5,
  padding: "7px 12px",
  borderRadius: 9,
  border: 0,
  background: "#f2f2f2",
  color: "#404040",
  cursor: "pointer",
} as const;
