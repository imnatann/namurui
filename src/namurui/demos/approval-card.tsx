import { useEffect, useRef, useState } from "react";
import { ApprovalCard, type ApprovalStatus } from "../approval-card";

const AVATARS = ["M", "J", "S", "A"] as const;

/**
 * The reference demo: an agent asks to send the newsletter. Until the visitor touches it
 * the card plays itself — approve is pressed at 3s, the resolved row holds for 3.2s and the
 * request comes back. Hovering or interacting stops the loop for good. The autoplay calls the
 * demo's own approve handler, so the card's internals stay private.
 */
export default function Demo() {
  const [status, setStatus] = useState<ApprovalStatus>("pending");
  const [touched, setTouched] = useState(false);
  const [hovered, setHovered] = useState(false);

  const settle = useRef<number | null>(null);

  /** The demo's own approve path – the card holds its busy state until this resolves. */
  const approve = () =>
    new Promise<void>((resolve) => {
      settle.current = window.setTimeout(() => {
        setStatus("approved");
        resolve();
      }, 700);
    });

  useEffect(
    () => () => {
      if (settle.current !== null) window.clearTimeout(settle.current);
    },
    [],
  );

  useEffect(() => {
    if (touched) return;
    const timers: number[] = [];

    if (status === "pending") {
      if (hovered) return;
      timers.push(window.setTimeout(approve, 3000));
    } else {
      timers.push(window.setTimeout(() => setStatus("pending"), 3200));
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [status, touched, hovered]);

  return (
    <div className="ap-demo">
      <style href="ui-demo-approval-card" precedence="default">
        {css}
      </style>

      <div
        className="ap-demo__chat"
        onPointerDown={() => setTouched(true)}
        onKeyDown={() => setTouched(true)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <div className="ap-demo__agent">
          <span className="ap-demo__bot" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7-5.6-1.9L10.1 9 12 3.5Z" />
            </svg>
          </span>
          <p className="ap-demo__msg">I drafted the October newsletter. Ready to send?</p>
        </div>

        <ApprovalCard
          title="Send campaign email"
          description="October product update · Newsletter"
          risk="medium"
          actions="card"
          status={status}
          icon={
            <svg viewBox="0 0 24 24">
              <path d="M4 6.5h16v11H4z" />
              <path d="m4.5 7 7.5 6 7.5-6" />
            </svg>
          }
          onApprove={approve}
          onDeny={() => setStatus("denied")}
          details={[
            { label: "Subject", value: "What's new in October" },
            { label: "Send", value: "Today, 9:00 AM" },
          ]}
        >
          <div className="ap-demo__people">
            <span className="ap-demo__avatars" aria-hidden="true">
              {AVATARS.map((initial, index) => (
                <span key={initial} className="ap-demo__avatar" data-i={index}>
                  {initial}
                </span>
              ))}
            </span>
            <span className="ap-demo__to">
              <span className="ap-demo__names">Mia, Jonas, Sara, Alex</span>
              <span className="ap-demo__more">+38 more</span>
            </span>
          </div>
        </ApprovalCard>

        {touched && status !== "pending" ? (
          <button type="button" className="ap-demo__replay" onClick={() => setStatus("pending")}>
            Replay
          </button>
        ) : null}
      </div>
    </div>
  );
}

const css = `
.ap-demo{grid-template-columns:minmax(0,420px);place-content:center;width:100%;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:grid}
.ap-demo__chat{gap:14px;min-width:0;display:grid}
.ap-demo__agent{align-items:flex-start;gap:10px;min-width:0;display:flex}
.ap-demo__bot{color:#fff;background:#171717;border-radius:50%;flex:none;place-items:center;width:26px;height:26px;margin-top:3px;display:grid}
.ap-demo__bot svg{fill:currentColor;width:13px;height:13px}
.ap-demo__msg{color:#171717;background:#f0f0f0;border-radius:6px 18px 18px;margin:0;padding:8px 13px;font-size:14px;line-height:1.45}
.ap-demo__people{align-items:center;gap:10px;min-width:0;display:flex}
.ap-demo__avatars{flex:none;display:flex}
.ap-demo__avatar{color:#3d3d3d;letter-spacing:0;border-radius:50%;place-items:center;width:24px;height:24px;margin-left:-6px;font-size:10.5px;font-weight:600;display:grid;box-shadow:0 0 0 2px #fafafa}
.ap-demo__avatar:first-child{margin-left:0}
.ap-demo__avatar[data-i="0"]{background:#e9e4f7}
.ap-demo__avatar[data-i="1"]{background:#e2eef7}
.ap-demo__avatar[data-i="2"]{background:#f6e9dc}
.ap-demo__avatar[data-i="3"]{background:#e2f1e8}
.ap-demo__to{gap:6px;min-width:0;font-size:13px;display:flex}
.ap-demo__names{color:#171717;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
.ap-demo__more{color:#8a8a8a;flex:none}
.ap-demo__replay{color:#8a8a8a;font:inherit;cursor:pointer;background:0 0;border:0;border-radius:8px;justify-self:center;padding:4px 10px;font-size:12.5px}
.ap-demo__replay:hover{color:#171717}
.ap-demo__replay:focus-visible{outline-offset:2px;outline:2px solid #1717174d}
:where(.dark,[data-theme=dark]) .ap-demo__bot{color:#161618;background:#ededed}
:where(.dark,[data-theme=dark]) .ap-demo__msg{color:#ededed;background:#262628}
:where(.dark,[data-theme=dark]) .ap-demo__avatar{color:#ededed;box-shadow:0 0 0 2px #1f1f22}
:where(.dark,[data-theme=dark]) .ap-demo__avatar[data-i="0"]{background:#3a3550}
:where(.dark,[data-theme=dark]) .ap-demo__avatar[data-i="1"]{background:#2c3f4f}
:where(.dark,[data-theme=dark]) .ap-demo__avatar[data-i="2"]{background:#4a3a2c}
:where(.dark,[data-theme=dark]) .ap-demo__avatar[data-i="3"]{background:#2c4636}
:where(.dark,[data-theme=dark]) .ap-demo__names{color:#ededed}
:where(.dark,[data-theme=dark]) .ap-demo__more,:where(.dark,[data-theme=dark]) .ap-demo__replay{color:#7c7c7c}
:where(.dark,[data-theme=dark]) .ap-demo__replay:hover{color:#ededed}
`;
