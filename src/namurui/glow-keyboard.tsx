"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

/*
 * Glow Keyboard – an AI chat input typing itself over a glass keyboard, in a single
 * self-contained file. A two-tone gradient floor drifts under the scene while a warm glow
 * breathes behind the composer; the caret blinks in the empty field until the first prompt
 * starts landing letter by letter at a human pace, each key dipping under the stroke and
 * pushing a pulse of colour up the floor from the point it was hit. When a prompt is done the
 * return key goes down, the field clears and the next question begins. Reaching into the scene
 * hands the field over to the reader, and the animation stops for good. Everything that moves
 * runs on one rAF loop, so nothing ticks after the panel leaves the screen.
 * The styles are injected below, so no extra files are needed.
 */

export type GlowKeyboardProps = {
  /** Prompts the scene types by itself, one after another; each is sent with Enter */
  prompts?: string[];
  /** Placeholder and accessible name of the composer, e.g. "Ask AI anything..." */
  placeholder?: string;
  /** Called with the text each time a prompt is sent, by the scene or by the reader */
  onSubmit?: (text: string) => void;
  /** Let the scene type on its own; false leaves the field empty, waiting for a reader */
  autoType?: boolean;
  /** Accessible name of the whole illustration */
  label?: string;
  className?: string;
};

const DEFAULT_PROMPTS = [
  "Plan a two day hike from Innsbruck to the hut",
  "Summarise the thread and list the open questions",
  "Find a quiet cafe near the canal",
];

/** One cap on the board: its face, the key code the scene presses, and its box in keyboard units. */
type KeySpec = {
  /** `data-k` – the physical code; empty on the touch-id cap and the extra `<` key */
  code: string;
  /** What is printed on the cap */
  label: string;
  /** Extra modifier classes, verbatim */
  mods: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * The board exactly as the live one draws it: a German QWERTZ layout with a function row,
 * a tall return key and a half-height arrow pair. Every number is in keyboard units, the
 * same units the stylesheet multiplies `--ui-gk-u` by.
 */
const KEYS: KeySpec[] = [
  { code: "Escape", label: "esc", mods: "ui-gk-key--mod ui-gk-key--sm", left: 24, top: 24, width: 149, height: 56 },
  { code: "F1", label: "F1", mods: "ui-gk-key--fkey", left: 183, top: 24, width: 96, height: 56 },
  { code: "F2", label: "F2", mods: "ui-gk-key--fkey", left: 289, top: 24, width: 96, height: 56 },
  { code: "F3", label: "F3", mods: "ui-gk-key--fkey", left: 395, top: 24, width: 96, height: 56 },
  { code: "F4", label: "F4", mods: "ui-gk-key--fkey", left: 501, top: 24, width: 96, height: 56 },
  { code: "F5", label: "F5", mods: "ui-gk-key--fkey", left: 607, top: 24, width: 96, height: 56 },
  { code: "F6", label: "F6", mods: "ui-gk-key--fkey", left: 713, top: 24, width: 96, height: 56 },
  { code: "F7", label: "F7", mods: "ui-gk-key--fkey", left: 819, top: 24, width: 96, height: 56 },
  { code: "F8", label: "F8", mods: "ui-gk-key--fkey", left: 925, top: 24, width: 96, height: 56 },
  { code: "F9", label: "F9", mods: "ui-gk-key--fkey", left: 1031, top: 24, width: 96, height: 56 },
  { code: "F10", label: "F10", mods: "ui-gk-key--fkey", left: 1137, top: 24, width: 96, height: 56 },
  { code: "F11", label: "F11", mods: "ui-gk-key--fkey", left: 1243, top: 24, width: 96, height: 56 },
  { code: "F12", label: "F12", mods: "ui-gk-key--fkey", left: 1349, top: 24, width: 96, height: 56 },
  { code: "", label: "", mods: "ui-gk-key--touchid", left: 1455, top: 24, width: 96, height: 56 },
  { code: "^", label: "^", mods: "", left: 24, top: 90, width: 96, height: 96 },
  { code: "1", label: "1", mods: "", left: 130, top: 90, width: 96, height: 96 },
  { code: "2", label: "2", mods: "", left: 236, top: 90, width: 96, height: 96 },
  { code: "3", label: "3", mods: "", left: 342, top: 90, width: 96, height: 96 },
  { code: "4", label: "4", mods: "", left: 448, top: 90, width: 96, height: 96 },
  { code: "5", label: "5", mods: "", left: 554, top: 90, width: 96, height: 96 },
  { code: "6", label: "6", mods: "", left: 660, top: 90, width: 96, height: 96 },
  { code: "7", label: "7", mods: "", left: 766, top: 90, width: 96, height: 96 },
  { code: "8", label: "8", mods: "", left: 872, top: 90, width: 96, height: 96 },
  { code: "9", label: "9", mods: "", left: 978, top: 90, width: 96, height: 96 },
  { code: "0", label: "0", mods: "", left: 1084, top: 90, width: 96, height: 96 },
  { code: "ß", label: "ß", mods: "", left: 1190, top: 90, width: 96, height: 96 },
  { code: "´", label: "´", mods: "", left: 1296, top: 90, width: 96, height: 96 },
  { code: "Backspace", label: "⌫", mods: "ui-gk-key--mod", left: 1402, top: 90, width: 149, height: 96 },
  { code: "Tab", label: "⇥", mods: "ui-gk-key--mod", left: 24, top: 196, width: 149, height: 96 },
  { code: "q", label: "q", mods: "", left: 183, top: 196, width: 96, height: 96 },
  { code: "w", label: "w", mods: "", left: 289, top: 196, width: 96, height: 96 },
  { code: "e", label: "e", mods: "", left: 395, top: 196, width: 96, height: 96 },
  { code: "r", label: "r", mods: "", left: 501, top: 196, width: 96, height: 96 },
  { code: "t", label: "t", mods: "", left: 607, top: 196, width: 96, height: 96 },
  { code: "z", label: "z", mods: "", left: 713, top: 196, width: 96, height: 96 },
  { code: "u", label: "u", mods: "", left: 819, top: 196, width: 96, height: 96 },
  { code: "i", label: "i", mods: "", left: 925, top: 196, width: 96, height: 96 },
  { code: "o", label: "o", mods: "", left: 1031, top: 196, width: 96, height: 96 },
  { code: "p", label: "p", mods: "", left: 1137, top: 196, width: 96, height: 96 },
  { code: "ü", label: "ü", mods: "", left: 1243, top: 196, width: 96, height: 96 },
  { code: "+", label: "+", mods: "", left: 1349, top: 196, width: 96, height: 96 },
  { code: "Enter", label: "↩", mods: "ui-gk-key--mod ui-gk-key--enter", left: 1455, top: 196, width: 96, height: 202 },
  { code: "CapsLock", label: "⇪", mods: "ui-gk-key--mod", left: 24, top: 302, width: 149, height: 96 },
  { code: "a", label: "a", mods: "", left: 183, top: 302, width: 96, height: 96 },
  { code: "s", label: "s", mods: "", left: 289, top: 302, width: 96, height: 96 },
  { code: "d", label: "d", mods: "", left: 395, top: 302, width: 96, height: 96 },
  { code: "f", label: "f", mods: "", left: 501, top: 302, width: 96, height: 96 },
  { code: "g", label: "g", mods: "", left: 607, top: 302, width: 96, height: 96 },
  { code: "h", label: "h", mods: "", left: 713, top: 302, width: 96, height: 96 },
  { code: "j", label: "j", mods: "", left: 819, top: 302, width: 96, height: 96 },
  { code: "k", label: "k", mods: "", left: 925, top: 302, width: 96, height: 96 },
  { code: "l", label: "l", mods: "", left: 1031, top: 302, width: 96, height: 96 },
  { code: "ö", label: "ö", mods: "", left: 1137, top: 302, width: 96, height: 96 },
  { code: "ä", label: "ä", mods: "", left: 1243, top: 302, width: 96, height: 96 },
  { code: "#", label: "#", mods: "", left: 1349, top: 302, width: 96, height: 96 },
  { code: "ShiftLeft", label: "⇧", mods: "ui-gk-key--mod", left: 24, top: 408, width: 122.5, height: 96 },
  { code: "", label: "<", mods: "", left: 156.5, top: 408, width: 96, height: 96 },
  { code: "y", label: "y", mods: "", left: 262.5, top: 408, width: 96, height: 96 },
  { code: "x", label: "x", mods: "", left: 368.5, top: 408, width: 96, height: 96 },
  { code: "c", label: "c", mods: "", left: 474.5, top: 408, width: 96, height: 96 },
  { code: "v", label: "v", mods: "", left: 580.5, top: 408, width: 96, height: 96 },
  { code: "b", label: "b", mods: "", left: 686.5, top: 408, width: 96, height: 96 },
  { code: "n", label: "n", mods: "", left: 792.5, top: 408, width: 96, height: 96 },
  { code: "m", label: "m", mods: "", left: 898.5, top: 408, width: 96, height: 96 },
  { code: ",", label: ",", mods: "", left: 1004.5, top: 408, width: 96, height: 96 },
  { code: ".", label: ".", mods: "", left: 1110.5, top: 408, width: 96, height: 96 },
  { code: "-", label: "-", mods: "", left: 1216.5, top: 408, width: 96, height: 96 },
  { code: "ShiftRight", label: "⇧", mods: "ui-gk-key--mod", left: 1322.5, top: 408, width: 228.5, height: 96 },
  { code: "Fn", label: "fn", mods: "ui-gk-key--mod ui-gk-key--sm", left: 24, top: 514, width: 96, height: 96 },
  { code: "ControlLeft", label: "⌃", mods: "ui-gk-key--mod", left: 130, top: 514, width: 96, height: 96 },
  { code: "AltLeft", label: "⌥", mods: "ui-gk-key--mod", left: 236, top: 514, width: 96, height: 96 },
  { code: "MetaLeft", label: "⌘", mods: "ui-gk-key--mod", left: 342, top: 514, width: 122.5, height: 96 },
  { code: "Space", label: "", mods: "ui-gk-key--space", left: 474.5, top: 514, width: 520, height: 96 },
  { code: "MetaRight", label: "⌘", mods: "ui-gk-key--mod", left: 1004.5, top: 514, width: 122.5, height: 96 },
  { code: "AltRight", label: "⌥", mods: "ui-gk-key--mod", left: 1137, top: 514, width: 96, height: 96 },
  { code: "ArrowLeft", label: "←", mods: "ui-gk-key--mod ui-gk-key--arrow", left: 1243, top: 514, width: 96, height: 96 },
  { code: "ArrowUp", label: "↑", mods: "ui-gk-key--mod ui-gk-key--arrow ui-gk-key--half", left: 1349, top: 514, width: 96, height: 45.5 },
  { code: "ArrowDown", label: "↓", mods: "ui-gk-key--mod ui-gk-key--arrow ui-gk-key--half", left: 1349, top: 564.5, width: 96, height: 45.5 },
  { code: "ArrowRight", label: "→", mods: "ui-gk-key--mod ui-gk-key--arrow", left: 1455, top: 514, width: 96, height: 96 },
];

/** The board's own offset inside the 2200 × 1200 frame, so a key can be traced up to the floor. */
const BOARD_LEFT = 312.5;

/** Where the board's bottom edge sits: the line a wave starts rising from. */
const BOARD_BOTTOM = 440 + 634;

/** Middle of the frame: where a character with no cap of its own sends its pulse. */
const FRAME_CENTER = 1100;

/**
 * Both floor layers' boxes in frame units, mirrored from the stylesheet. A wave is an origin
 * plus a scale, and a percentage origin survives every resize, so the two numbers below turn a
 * key's column into a point inside each layer.
 */
const FLOORS = {
  color: { left: -290, top: 753, width: 2864.5, height: 931.5 },
  light: { left: -65, top: 922, width: 2414, height: 785 },
};

function waveOrigin(floor: { left: number; top: number; width: number; height: number }, column: number): string {
  const x = ((column - floor.left) / floor.width) * 100;
  const y = ((BOARD_BOTTOM - floor.top) / floor.height) * 100;
  return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
}

const ENTER = KEYS.findIndex((key) => key.code === "Enter");
const SPACE = KEYS.findIndex((key) => key.code === "Space");
const SHIFT = KEYS.findIndex((key) => key.code === "ShiftLeft");

/** Horizontal centre of a cap, in frame units – the column a key's wave rises from. */
function centreOf(index: number): number {
  return BOARD_LEFT + KEYS[index].left + KEYS[index].width / 2;
}

/** Every cap that prints a single character, so a typed letter can find the key it hits. */
const CAP_OF: Record<string, number | undefined> = {};
KEYS.forEach((key, index) => {
  const face = key.code.length === 1 ? key.code : key.label;
  if (face.length === 1) CAP_OF[face] = index;
});

type Hit = { keys: number[]; x: number };

/** Which caps go down for one character, and where the wave starts. */
function hitFor(character: string): Hit {
  if (character === "\n") return { keys: [ENTER], x: centreOf(ENTER) };
  if (character === " ") return { keys: [SPACE], x: centreOf(SPACE) };

  const lower = character.toLowerCase();
  const cap = CAP_OF[lower];
  if (cap === undefined) return { keys: [], x: FRAME_CENTER };

  return character === lower ? { keys: [cap], x: centreOf(cap) } : { keys: [SHIFT, cap], x: centreOf(cap) };
}

/** Delay before the next character, with the uneven rhythm of someone actually typing. */
function beatFor(character: string, still: boolean): number {
  if (still) return 0.09;
  if (character === " ") return 0.075 + Math.random() * 0.055;
  if (character === "," || character === ".") return 0.12 + Math.random() * 0.1;
  return 0.042 + Math.random() * 0.08;
}

const NO_KEYS: number[] = [];

type Phase = "wait" | "type" | "hold" | "send";

type Machine = {
  /** Seconds of on-screen time since mount */
  t: number;
  phase: Phase;
  /** Index of the prompt being typed */
  prompt: number;
  /** Characters of it that have landed */
  char: number;
  /** Those characters, as the field shows them */
  typed: string;
  /** When the next move is due */
  due: number;
  /** Caps held down, by index in `KEYS` */
  press: number[];
  /** When they went down */
  pressAt: number;
  /** Where the last wave started, in frame units */
  waveX: number;
  /** When it started */
  waveAt: number;
  /** The reader took the field over */
  handed: boolean;
  /** A wave is still displacing the floor, so a frame has to clear it */
  waving: boolean;
};

export function GlowKeyboard({
  prompts = DEFAULT_PROMPTS,
  placeholder = "Ask AI anything...",
  onSubmit,
  autoType = true,
  label = "AI chat input above a glass keyboard and a moving colour gradient",
  className,
}: GlowKeyboardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `gk${uid}-${name}`;

  const rootEl = useRef<HTMLDivElement>(null);
  const fieldEl = useRef<HTMLInputElement>(null);
  const colorFloor = useRef<HTMLDivElement>(null);
  const lightFloor = useRef<HTMLDivElement>(null);

  const machine = useRef<Machine>({
    t: 0,
    phase: "wait",
    prompt: 0,
    char: 0,
    typed: "",
    due: 0.75,
    press: NO_KEYS,
    pressAt: -9,
    waveX: FRAME_CENTER,
    waveAt: -9,
    handed: false,
    waving: false,
  });

  const [entered, setEntered] = useState(false);
  const [paused, setPaused] = useState(false);
  const [text, setText] = useState("");
  const [down, setDown] = useState<number[]>(NO_KEYS);

  const promptsRef = useRef(prompts);
  promptsRef.current = prompts;
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const autoRef = useRef(autoType);
  autoRef.current = autoType;

  /* The composer and the board rise in one beat after the first paint, as on the live page. */
  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  /* One loop drives the typing, the caps and the wave; it only runs while the scene is on screen. */
  useEffect(() => {
    const root = rootEl.current;
    if (!root) return;

    const m = machine.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = 0;
    let awake = true;

    const settleFloor = () => {
      if (!m.waving) return;
      m.waving = false;
      for (const floor of [colorFloor.current, lightFloor.current]) {
        if (!floor) continue;
        floor.style.transform = "";
        floor.style.transformOrigin = "";
      }
    };

    /* The floor swells from the point the key was hit, then sinks back over a second. */
    const paint = () => {
      if (still) return;
      const since = m.t - m.waveAt;
      const q = since <= 0 ? 1 : since / 0.95;
      const amp = q >= 1 ? 0 : (1 - q) * (1 - q) * Math.min(1, since / 0.07);

      if (amp <= 0.002) {
        settleFloor();
        return;
      }

      m.waving = true;
      const color = colorFloor.current;
      if (color) {
        color.style.transformOrigin = waveOrigin(FLOORS.color, m.waveX);
        color.style.transform = `translate3d(0, calc(${(-14 * amp).toFixed(2)} * var(--ui-gk-u)), 0) scale(${(1 + 0.05 * amp).toFixed(4)}, ${(1 + 0.085 * amp).toFixed(4)})`;
      }
      const light = lightFloor.current;
      if (light) {
        light.style.transformOrigin = waveOrigin(FLOORS.light, m.waveX);
        light.style.transform = `translate3d(0, calc(${(-26 * amp).toFixed(2)} * var(--ui-gk-u)), 0) scale(${(1 + 0.09 * amp).toFixed(4)}, ${(1 + 0.16 * amp).toFixed(4)})`;
      }
    };

    const strike = (character: string) => {
      const hit = hitFor(character);
      m.press = hit.keys;
      m.pressAt = m.t;
      setDown(hit.keys);
      if (still) return;
      m.waveX = hit.x;
      m.waveAt = m.t;
    };

    const step = (dt: number) => {
      m.t += dt;

      if (m.press.length > 0 && m.t - m.pressAt > 0.13) {
        m.press = NO_KEYS;
        setDown(NO_KEYS);
      }

      if (m.handed || !autoRef.current || m.t < m.due) return;

      const list = promptsRef.current.filter((prompt) => prompt.trim().length > 0);
      if (list.length === 0) return;
      const prompt = list[m.prompt % list.length];

      if (m.phase === "wait") {
        m.typed = "";
        setText("");
        m.char = 0;
        m.phase = "type";
        m.due = m.t + 0.45;
        return;
      }

      if (m.phase === "type") {
        if (m.char >= prompt.length) {
          m.phase = "hold";
          m.due = m.t + 0.8;
          return;
        }
        const character = prompt[m.char];
        m.char += 1;
        m.typed += character;
        setText(m.typed);
        strike(character);
        m.due = m.t + beatFor(character, still);
        return;
      }

      if (m.phase === "hold") {
        m.phase = "send";
        m.due = m.t + 0.02;
        return;
      }

      strike("\n");
      setText("");
      m.typed = "";
      m.prompt += 1;
      m.phase = "wait";
      m.due = m.t + 1.6;
      submitRef.current?.(prompt);
    };

    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (awake && !document.hidden) {
        step(dt);
        paint();
      } else {
        settleFloor();
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        awake = entry.isIntersecting;
        setPaused(!awake);
        if (awake) start();
        else stop();
      },
      { threshold: 0.04 },
    );
    io.observe(root);

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (awake) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* Reaching into the scene stops the demo for good; the caret then follows the reader. */
  const handOver = () => {
    const m = machine.current;
    if (m.handed) return;
    m.handed = true;
    m.press = NO_KEYS;
    setDown(NO_KEYS);
  };

  const onScenePointerDown = () => {
    handOver();
    // The pointer's own default lands first; the caret moves in on the next frame.
    requestAnimationFrame(() => fieldEl.current?.focus({ preventScroll: true }));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const sent = text.trim();
    if (!sent) return;
    submitRef.current?.(sent);
    setText("");
  };

  return (
    <div
      ref={rootEl}
      className={["ui-gk", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={label}
      data-in={entered ? "" : undefined}
      data-paused={paused ? "" : undefined}
      onPointerDown={onScenePointerDown}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-glow-keyboard" precedence="default">
        {css}
      </style>

      <div className="ui-gk-frame">
        <div ref={colorFloor} className="ui-gk-floor ui-gk-floor--color" aria-hidden="true">
          <div className="ui-gk-bleed">
            <svg viewBox="0 0 3447.1 1514.1" preserveAspectRatio="none">
              <defs>
                <linearGradient
                  id={id("floor")}
                  x1="1723.8"
                  y1="423.3"
                  x2="1723.8"
                  y2="894.3"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#FF7700" />
                  <stop offset="0.302885" stopColor="#FF0055" />
                  <stop offset="0.673077" stopColor="#0073FF" />
                </linearGradient>
              </defs>
              <path
                d="M926.8 547.0C926.8 547.0 302.1 356.3 291.3 350.3V1222.8H3155.8V384.1L2493.8 601.9H2189.3V601.9L1898.8 382.2H1510.8V382.2L1230.8 547.0H926.8V547.0Z"
                fill={`url(#${id("floor")})`}
              />
            </svg>
          </div>
        </div>

        <div ref={lightFloor} className="ui-gk-floor ui-gk-floor--light" aria-hidden="true">
          <div className="ui-gk-bleed">
            <svg viewBox="0 0 2904.96 1275.97" preserveAspectRatio="none">
              <path
                d="M781.039 461.0C781.039 461.0 254.588 300.3 245.486 295.2V1030.49H2659.48V323.7L2101.59 507.2H1844.98V507.2L1600.17 322.1H1273.19V322.1L1037.23 461.0H781.039V461.0Z"
                fill="#fff"
                fillOpacity="0.8"
              />
            </svg>
          </div>
        </div>

        <div className="ui-gk-composer">
          <div className="ui-gk-glow ui-gk-glow--soft" aria-hidden="true" />
          <div className="ui-gk-glow-mid" aria-hidden="true" />
          <div className="ui-gk-glow ui-gk-glow--hard" aria-hidden="true" />
          <div className="ui-gk-ring" aria-hidden="true" />

          <div className="ui-gk-input">
            <div className="ui-gk-glass" aria-hidden="true" />

            <svg className="ui-gk-orb" viewBox="0 0 95.5862 95.5862" aria-hidden="true">
              <defs>
                <radialGradient
                  id={id("orb")}
                  cx="0"
                  cy="0"
                  r="1"
                  gradientUnits="userSpaceOnUse"
                  gradientTransform="translate(47.7931 9.55862) rotate(90) scale(86.0276)"
                >
                  <stop offset="0.221154" stopColor="#FF7700" />
                  <stop offset="1" stopColor="#FF2A91" />
                </radialGradient>
                <filter
                  id={id("orb-glow")}
                  x="0"
                  y="0"
                  width="95.5862"
                  height="95.5862"
                  filterUnits="userSpaceOnUse"
                  colorInterpolationFilters="sRGB"
                >
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="alpha"
                  />
                  <feGaussianBlur stdDeviation="21.3703" />
                  <feComposite in2="alpha" operator="arithmetic" k2="-1" k3="1" />
                  <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
                  <feBlend mode="normal" in2="SourceGraphic" />
                </filter>
              </defs>
              <circle
                cx="47.7931"
                cy="47.7931"
                r="47.7931"
                fill={`url(#${id("orb")})`}
                filter={`url(#${id("orb-glow")})`}
              />
            </svg>

            <span className="ui-gk-field">
              <span className="ui-gk-caret" aria-hidden="true" />
              <input
                ref={fieldEl}
                className="ui-gk-prompt"
                type="text"
                value={text}
                placeholder={placeholder}
                aria-label={placeholder}
                autoComplete="off"
                spellCheck={false}
                onFocus={handOver}
                onChange={(event) => {
                  handOver();
                  setText(event.target.value);
                }}
                onKeyDown={onKeyDown}
              />
            </span>

            <div className="ui-gk-glass ui-gk-glass--inner" aria-hidden="true" />
          </div>
        </div>

        <div className="ui-gk-keyboard" aria-hidden="true">
          {KEYS.map((key, index) => (
            <span
              key={`${key.code || key.label}-${index}`}
              className={["ui-gk-key", key.mods].filter(Boolean).join(" ")}
              data-k={key.code || undefined}
              data-down={down.includes(index) ? "" : undefined}
              style={{
                left: `calc(${key.left} * var(--ui-gk-u))`,
                top: `calc(${key.top} * var(--ui-gk-u))`,
                width: `calc(${key.width} * var(--ui-gk-u))`,
                height: `calc(${key.height} * var(--ui-gk-u))`,
              }}
            >
              {key.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const css = /* css */ `
.ui-gk{--ui-gk-bg: #faf7f4;--ui-gk-floor-light: 1;--ui-gk-ring: 1;--ui-gk-input-border: #fffdfb;--ui-gk-input-bg: rgba(255, 253, 251, 0.9);--ui-gk-input-inner: #fffdfb;--ui-gk-caret: rgba(159, 146, 134, 0.4);--ui-gk-text: #5b4b3c;--ui-gk-placeholder: #9f9286;--ui-gk-board-border: rgba(255, 253, 251, 0.55);--ui-gk-board-bg: rgba(255, 253, 251, 0.16);--ui-gk-board-inner: rgba(255, 253, 251, 0.5);--ui-gk-board-shadow: rgba(11, 9, 8, 0.05);--ui-gk-key-bg: rgba(255, 253, 251, 0.72);--ui-gk-key-edge: inset 0 0 0 transparent;--ui-gk-key-drop: rgba(11, 9, 8, 0.05);--ui-gk-key-inner: rgba(255, 253, 251, 0.6);--ui-gk-key-text: rgba(30, 24, 20, 0.5);--ui-gk-touchid: rgba(30, 24, 20, 0.25);--ui-gk-key-down-bg: rgba(195, 184, 173, 0.97);--ui-gk-key-down-text: rgba(30, 24, 20, 0.9);--ui-gk-key-down-inner: rgba(11, 9, 8, 0.08);container-type: inline-size;width: 100%;font-family: inherit;-webkit-font-smoothing: antialiased;cursor: text}
.ui-gk-frame{--ui-gk-u: calc(100cqw / 2200);position: relative;aspect-ratio: 2200 / 1200;overflow: hidden;isolation: isolate;background: var(--ui-gk-bg)}
.ui-gk-frame > *{position: absolute;margin: 0}
.ui-gk-floor--color{left: calc(-290 * var(--ui-gk-u));top: calc(753 * var(--ui-gk-u));width: calc(2864.5 * var(--ui-gk-u));height: calc(931.5 * var(--ui-gk-u))}
.ui-gk-floor--light{left: calc(-65 * var(--ui-gk-u));top: calc(922 * var(--ui-gk-u));width: calc(2414 * var(--ui-gk-u));height: calc(785 * var(--ui-gk-u));mix-blend-mode: plus-lighter;opacity: var(--ui-gk-floor-light)}
.ui-gk-bleed{position: absolute;inset: -31.27% -10.17%;transform-origin: 50% 70%;will-change: transform}
.ui-gk-bleed svg{position: absolute;top: 0;left: 0;display: block;width: 25%;height: 25%;overflow: visible;transform: scale(4);transform-origin: 0 0;will-change: transform}
.ui-gk-floor--color svg{filter: blur(calc(calc(145.65 * var(--ui-gk-u)) / 4))}
.ui-gk-floor--light svg{filter: blur(calc(calc(122.74 * var(--ui-gk-u)) / 4))}
.ui-gk-floor--color .ui-gk-bleed{animation: ui-gk-drift-color var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-gk-floor--light .ui-gk-bleed{animation: ui-gk-drift-light var(--nm-dur-6, 1100ms) ease-in-out infinite}
@keyframes ui-gk-drift-color{0%, 100%{transform: translate(0, 0) scale(1, 1)}
33%{transform: translate(calc(-120 * var(--ui-gk-u)), calc(-20 * var(--ui-gk-u))) scale(1.05, 1.08)}
66%{transform: translate(calc(100 * var(--ui-gk-u)), calc(12 * var(--ui-gk-u))) scale(0.98, 0.96)}
}
@keyframes ui-gk-drift-light{0%, 100%{transform: translate(0, 0) scale(1, 1)}
33%{transform: translate(calc(-100 * var(--ui-gk-u)), calc(-10 * var(--ui-gk-u))) scale(1.03, 1)}
66%{transform: translate(calc(85 * var(--ui-gk-u)), calc(10 * var(--ui-gk-u))) scale(0.98, 0.94)}
}
.ui-gk-composer{inset: 0}
.ui-gk-composer > *{position: absolute}
.ui-gk-glow{left: calc(578.36 * var(--ui-gk-u));top: calc(230 * var(--ui-gk-u));width: calc(1037.79 * var(--ui-gk-u));height: calc(152.94 * var(--ui-gk-u));border-radius: calc(163.86 * var(--ui-gk-u))}
.ui-gk-glow::before, .ui-gk-glow::after{content: "";position: absolute;inset: 0;border-radius: inherit;filter: var(--ui-gk-glow-blur);will-change: opacity}
.ui-gk-glow::before{background-image: linear-gradient(to right, var(--ui-gk-glow-a), var(--ui-gk-glow-b))}
.ui-gk-glow::after{background-image: linear-gradient(to right, var(--ui-gk-glow-b), var(--ui-gk-glow-a));opacity: 0;animation: ui-gk-swap var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-gk-glow--soft{--ui-gk-glow-a: rgba(255, 107, 53, 0.3);--ui-gk-glow-b: rgba(179, 38, 30, 0.3);--ui-gk-glow-blur: blur(calc(54 * var(--ui-gk-u)))}
.ui-gk-glow--hard{--ui-gk-glow-a: #ff6b35;--ui-gk-glow-b: #b3261e;--ui-gk-glow-blur: blur(calc(9.5 * var(--ui-gk-u)))}
.ui-gk-glow-mid{left: calc(817.25 * var(--ui-gk-u));top: calc(230 * var(--ui-gk-u));width: calc(560 * var(--ui-gk-u));height: calc(152.94 * var(--ui-gk-u));border-radius: calc(76.47 * var(--ui-gk-u));background: radial-gradient(closest-side, rgba(226, 84, 74, 0.75), rgba(226, 84, 74, 0));filter: blur(calc(22 * var(--ui-gk-u)));will-change: transform, opacity;animation: ui-gk-breathe var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-gk-hit{top: calc(230 * var(--ui-gk-u));width: calc(340 * var(--ui-gk-u));height: calc(152.94 * var(--ui-gk-u));border-radius: calc(76.47 * var(--ui-gk-u));pointer-events: none}
@keyframes ui-gk-swap{50%{opacity: 1}
}
@keyframes ui-gk-breathe{0%, 100%{transform: translateY(0) scaleY(1);opacity: 0.7}
25%{transform: translateY(calc(-16 * var(--ui-gk-u))) scaleY(1.4);opacity: 1}
50%{transform: translateY(0) scaleY(1.1);opacity: 0.8}
75%{transform: translateY(calc(16 * var(--ui-gk-u))) scaleY(1.45);opacity: 1}
}
.ui-gk-ring{left: calc(576.86 * var(--ui-gk-u));top: calc(228.5 * var(--ui-gk-u));width: calc(1040.79 * var(--ui-gk-u));height: calc(155.94 * var(--ui-gk-u));border: calc(3 * var(--ui-gk-u)) solid transparent;border-radius: calc(77.97 * var(--ui-gk-u));background: linear-gradient(to right, rgba(255, 253, 251, 0) 0.14%, #fffdfb 25%, #fffdfb 75%, rgba(255, 253, 251, 0) 99.86%) border-box;-webkit-mask: linear-gradient(#0b0908 0 0) padding-box, linear-gradient(#0b0908 0 0) border-box;-webkit-mask-composite: xor;mask-composite: exclude;filter: blur(calc(5.74 * var(--ui-gk-u)));mix-blend-mode: plus-lighter;opacity: var(--ui-gk-ring)}
.ui-gk-input{left: calc(576.99 * var(--ui-gk-u));top: calc(230 * var(--ui-gk-u));width: calc(1046.09 * var(--ui-gk-u));height: calc(152.94 * var(--ui-gk-u));display: flex;align-items: center;gap: calc(20.59 * var(--ui-gk-u));padding: calc(27.31 * var(--ui-gk-u));border: calc(1.37 * var(--ui-gk-u)) solid var(--ui-gk-input-border);border-radius: calc(109.24 * var(--ui-gk-u))}
.ui-gk-glass{position: absolute;inset: 0;border-radius: inherit;pointer-events: none}
.ui-gk-input > .ui-gk-glass{background: var(--ui-gk-input-bg);-webkit-backdrop-filter: blur(calc(25.48 * var(--ui-gk-u)));backdrop-filter: blur(calc(25.48 * var(--ui-gk-u)))}
.ui-gk-input > .ui-gk-glass--inner{background: none;-webkit-backdrop-filter: none;backdrop-filter: none;box-shadow: inset 0 0 calc(35.91 * var(--ui-gk-u)) 0 var(--ui-gk-input-inner), inset 0 0 calc(35.91 * var(--ui-gk-u)) 0 var(--ui-gk-input-inner)}
.ui-gk-orb{position: relative;flex: none;width: calc(95.59 * var(--ui-gk-u));height: calc(95.59 * var(--ui-gk-u))}
.ui-gk-field{position: relative;flex: 1;display: flex;align-items: center;gap: calc(8.19 * var(--ui-gk-u));min-width: 0}
.ui-gk-caret{flex: none;width: calc(2.73 * var(--ui-gk-u));height: calc(60.08 * var(--ui-gk-u));background: var(--ui-gk-caret);animation: ui-gk-blink var(--nm-dur-6, 1100ms) step-end infinite}
.ui-gk-field:has(.ui-gk-prompt:not(:placeholder-shown)) .ui-gk-caret{visibility: hidden}
@keyframes ui-gk-blink{50%{opacity: 0}
}
.ui-gk-prompt{flex: 1;min-width: 0;margin: 0;padding: 0;border: 0;outline: 0;background: transparent;font: inherit;font-size: calc(46.43 * var(--ui-gk-u));line-height: normal;color: var(--ui-gk-text);caret-color: var(--ui-gk-placeholder)}
.ui-gk-prompt::placeholder{color: var(--ui-gk-placeholder);opacity: 1}
.ui-gk-prompt:placeholder-shown{caret-color: transparent}
.ui-gk .ui-gk-prompt:focus-visible{outline: none}
.ui-gk-keyboard{left: calc(312.5 * var(--ui-gk-u));top: calc(440 * var(--ui-gk-u));width: calc(1575 * var(--ui-gk-u));height: calc(634 * var(--ui-gk-u));border: calc(1.5 * var(--ui-gk-u)) solid var(--ui-gk-board-border);border-radius: calc(52 * var(--ui-gk-u));background: var(--ui-gk-board-bg);-webkit-backdrop-filter: blur(calc(24 * var(--ui-gk-u)));backdrop-filter: blur(calc(24 * var(--ui-gk-u)));box-shadow: inset 0 0 calc(30 * var(--ui-gk-u)) var(--ui-gk-board-inner), 0 calc(22 * var(--ui-gk-u)) calc(48 * var(--ui-gk-u)) var(--ui-gk-board-shadow)}
.ui-gk-key{position: absolute;display: flex;align-items: center;justify-content: center;border-radius: calc(20 * var(--ui-gk-u));background-color: var(--ui-gk-key-bg);box-shadow: var(--ui-gk-key-edge), 0 calc(1.5 * var(--ui-gk-u)) 0 var(--ui-gk-key-drop), inset 0 0 calc(12 * var(--ui-gk-u)) var(--ui-gk-key-inner);font-size: calc(44 * var(--ui-gk-u));line-height: 1;color: var(--ui-gk-key-text);user-select: none;transition: transform var(--nm-dur-3, 240ms) ease-out, background-color var(--nm-dur-3, 240ms) ease-out, color var(--nm-dur-3, 240ms) ease-out, box-shadow var(--nm-dur-3, 240ms) ease-out}
.ui-gk-key--mod{font-size: calc(36 * var(--ui-gk-u))}
.ui-gk-key--sm{font-size: calc(26 * var(--ui-gk-u))}
.ui-gk-key--fkey{font-size: calc(22 * var(--ui-gk-u));border-radius: calc(14 * var(--ui-gk-u))}
.ui-gk-key--arrow{font-size: calc(28 * var(--ui-gk-u))}
.ui-gk-key--half{font-size: calc(22 * var(--ui-gk-u));border-radius: calc(12 * var(--ui-gk-u))}
.ui-gk-key--touchid{border-radius: calc(14 * var(--ui-gk-u))}
.ui-gk-key--touchid::after{content: "";width: calc(30 * var(--ui-gk-u));height: calc(30 * var(--ui-gk-u));border: calc(2 * var(--ui-gk-u)) solid var(--ui-gk-touchid);border-radius: 50%}
.ui-gk-key[data-down]{transform: translateY(calc(3 * var(--ui-gk-u))) scale(0.9);background-color: var(--ui-gk-key-down-bg);color: var(--ui-gk-key-down-text);box-shadow: inset 0 0 0 transparent, 0 0 0 rgba(11, 9, 8, 0), inset 0 calc(2 * var(--ui-gk-u)) calc(6 * var(--ui-gk-u)) var(--ui-gk-key-down-inner);transition-duration: var(--nm-dur-1, 90ms)}
.ui-gk:not([data-in]) .ui-gk-composer, .ui-gk:not([data-in]) .ui-gk-keyboard{opacity: 0}
.ui-gk[data-in] .ui-gk-composer{animation: ui-gk-rise var(--nm-dur-6, 1100ms) cubic-bezier(0.2, 0.8, 0.2, 1) 0.15s backwards}
.ui-gk[data-in] .ui-gk-keyboard{animation: ui-gk-rise var(--nm-dur-6, 1100ms) cubic-bezier(0.2, 0.8, 0.2, 1) 0.45s backwards}
@keyframes ui-gk-rise{from{opacity: 0;transform: translateY(calc(60 * var(--ui-gk-u)))}
to{opacity: 1;transform: none}
}
:where(.dark, [data-theme="dark"]) .ui-gk{--ui-gk-bg: #181310;--ui-gk-floor-light: 0.3;--ui-gk-ring: 0.55;--ui-gk-input-border: rgba(255, 253, 251, 0.14);--ui-gk-input-bg: rgba(30, 24, 20, 0.88);--ui-gk-input-inner: rgba(255, 253, 251, 0.04);--ui-gk-caret: rgba(255, 253, 251, 0.3);--ui-gk-text: #dfd5cc;--ui-gk-placeholder: #6a5a4e;--ui-gk-board-border: rgba(255, 253, 251, 0.08);--ui-gk-board-bg: rgba(22, 17, 14, 0.5);--ui-gk-board-inner: rgba(255, 253, 251, 0.03);--ui-gk-board-shadow: rgba(11, 9, 8, 0.5);--ui-gk-key-bg: rgba(36, 30, 25, 0.86);--ui-gk-key-edge: inset 0 calc(1.5 * var(--ui-gk-u)) 0 rgba(255, 253, 251, 0.08);--ui-gk-key-drop: rgba(11, 9, 8, 0.6);--ui-gk-key-inner: rgba(11, 9, 8, 0.18);--ui-gk-key-text: rgba(238, 230, 222, 0.6);--ui-gk-touchid: rgba(238, 230, 222, 0.22);--ui-gk-key-down-bg: rgba(57, 47, 35, 0.97);--ui-gk-key-down-text: rgba(255, 253, 251, 0.95);--ui-gk-key-down-inner: rgba(11, 9, 8, 0.4)}
.ui-gk[data-paused] *{animation-play-state: paused}
@media (prefers-reduced-motion: reduce){.ui-gk-bleed, .ui-gk-glow::after, .ui-gk-glow-mid, .ui-gk-caret, .ui-gk[data-in] .ui-gk-composer, .ui-gk[data-in] .ui-gk-keyboard{animation: none}
.ui-gk-key{transition: none}
}

`;
