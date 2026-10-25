"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

/*
 * Dropzone – drag documents in and watch them upload.
 * While files hover the area the three sheets fan open and the title switches to a release prompt; rows grow in
 * one after another, each bar fills in a single accent colour with the time left beside it. Rejected files stay in
 * place with their reason, failed uploads shake once and offer a retry, and the footer summarises the batch.
 * With no onUpload the transfer is simulated on a timer, so the component never touches the network by itself.
 * The styles are injected below, so no extra files are needed.
 */

export type UploadStatus = "uploading" | "done" | "error";

/** One row in the list, in the shape the caller sees through onChange */
export type UploadItem = {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  /** 0…1 */
  progress: number;
  error?: string;
  file?: File;
};

export type DropzoneProps = {
  /** Extensions to allow, e.g. [".pdf", ".png"]. Omit to accept anything */
  accept?: string[];
  /** Largest allowed file in bytes */
  maxSize?: number;
  /** Uploads a file and reports progress; omit to simulate the transfer on a timer */
  onUpload?: (file: File, onProgress: (fraction: number) => void) => Promise<void>;
  /** Called with the visible rows whenever they change */
  onChange?: (items: UploadItem[]) => void;
  /** Line under the title; defaults to the accept list and max size */
  hint?: string;
  /** Seed the demo batch on mount – four sample files, one failing and one rejected */
  autoplay?: boolean;
  className?: string;
};

const MB = 1024 * 1024;
const NBSP = "\u00a0";

type InternalItem = UploadItem & {
  failAt?: number;
  retryable?: boolean;
  startedAt: number;
  duration: number;
  removing?: boolean;
};

type Seed = { name: string; size: number; failAt?: number };

/** extension without the dot, lowercased */
function extensionOf(name: string): string {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

function formatSize(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)}${NBSP}MB`;
}

/** "1.1 of 4.2 MB" while a row is moving, "512 of 1.3 MB" for small files */
function formatTransfer(sent: number, total: number): string {
  if (total < MB) return `${Math.round(sent / 1024)} of ${formatSize(total)}`;
  return `${(sent / MB).toFixed(1)} of ${formatSize(total)}`;
}

function formatEta(seconds: number): string {
  if (seconds < 1) return "almost done";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  return `${Math.ceil(seconds / 60)} min left`;
}

/** File-type tints – the reference sets these on the SVG fill, so they are data, not theme colours */
const TONES: { exts: string[]; color: string }[] = [
  { exts: ["pdf"], color: "#e5484d" },
  { exts: ["xls", "xlsx", "csv", "numbers"], color: "#1a9a52" },
  { exts: ["doc", "docx", "txt", "md", "pages", "rtf"], color: "#0060e2" },
  { exts: ["png", "jpg", "jpeg", "gif", "webp", "svg", "heic", "avif"], color: "#5B5BD6" },
  { exts: ["mp4", "mov", "webm", "mp3", "wav"], color: "#e8a20c" },
  { exts: ["ppt", "pptx", "key"], color: "#e8590c" },
];

function toneFor(name: string): string {
  return TONES.find((tone) => tone.exts.includes(extensionOf(name)))?.color ?? "#8f8f8f";
}

let sequence = 0;

const ICONS = {
  upload: "M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15",
  close: "M7 7l10 10M17 7 7 17",
  retry: "M20 12a8 8 0 1 1-2.34-5.66L20 8.5M20 4v4.5h-4.5",
  checkCircle:
    "M1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Zm8.9-1.2a.5.5 0 0 0-.8-.6L7.44 9.23 6.35 8.15a.5.5 0 1 0-.7.7l1.5 1.5a.5.5 0 0 0 .76-.06l2.5-3.5Z",
  alertCircle:
    "M1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0ZM8 4.6a.6.6 0 0 0-.6.6v3.2a.6.6 0 0 0 1.2 0V5.2a.6.6 0 0 0-.6-.6Zm0 6.9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z",
};

/** The four files the reference demo drops in */
const AUTOPLAY_SAMPLES: Seed[] = [
  { name: "Q3-Board-Report.pdf", size: 4.2 * MB },
  { name: "Hero-Shot.png", size: 2.6 * MB },
  { name: "Budget-2027.xlsx", size: 1.3 * MB, failAt: 0.62 },
  { name: "Product-Demo.mp4", size: 48 * MB },
];

export function Dropzone({
  accept,
  maxSize = 25 * MB,
  onUpload,
  onChange,
  hint,
  autoplay = false,
  className,
}: DropzoneProps) {
  const [items, setItems] = useState<InternalItem[]>([]);
  const [dragCount, setDragCount] = useState(0);
  const [live, setLive] = useState("");
  const [clock, setClock] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  const latest = useRef(items);
  const timers = useRef<number[]>([]);
  const onChangeRef = useRef(onChange);
  const spoken = useRef(new Map<string, UploadStatus>());

  latest.current = items;
  onChangeRef.current = onChange;

  const baseId = useId();
  const extensions = accept?.map((extension) => extension.replace(/^\./, "").toLowerCase());

  const acceptLabel = extensions?.length
    ? extensions.length <= 3
      ? extensions.map((extension) => extension.toUpperCase()).join(", ")
      : `${extensions
          .slice(0, 3)
          .map((extension) => extension.toUpperCase())
          .join(", ")} and more`
    : "Any file";
  const hintText = hint ?? `${acceptLabel} · up to ${formatSize(maxSize)} each`;

  const update = (id: string, patch: Partial<InternalItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  function upload(item: InternalItem) {
    const file = item.file;
    if (!onUpload || !file) return;
    const send = onUpload;
    Promise.resolve()
      .then(() => send(file, (fraction) => update(item.id, { progress: Math.max(0, Math.min(1, fraction)) })))
      .then(() => {
        update(item.id, { status: "done", progress: 1 });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error && error.message ? error.message : "Upload failed";
        update(item.id, { status: "error", error: message, retryable: true });
      });
  }

  function addFile(seed: { name: string; size: number; file?: File; failAt?: number }) {
    const id = `f${Date.now().toString(36)}${(sequence++).toString(36)}`;
    const ext = extensionOf(seed.name);
    let error: string | undefined;

    if (extensions?.length && !extensions.includes(ext)) {
      error = ext ? `.${ext} files aren't supported` : "This file type isn't supported";
    } else if (seed.size > maxSize) {
      error = `Too large – max ${formatSize(maxSize)}`;
    }

    const item: InternalItem = {
      id,
      name: seed.name,
      size: seed.size,
      file: seed.file,
      status: error ? "error" : "uploading",
      progress: 0,
      error,
      failAt: seed.failAt,
      startedAt: performance.now(),
      // 2.6 s for a small file, 9 s for a big one
      duration: Math.min(9000, Math.max(2600, (seed.size / (1.2 * MB)) * 1000)),
    };

    setItems((prev) => [...prev, item]);
    setClock(performance.now());
    if (!error && onUpload && seed.file) upload(item);
  }

  function addFiles(files: FileList | File[]) {
    Array.from(files).forEach((file) => addFile({ name: file.name, size: file.size, file }));
  }

  /* Progress: real uploads report through onUpload, the rest are simulated here */
  const simulating = items.some(
    (item) => item.status === "uploading" && (!onUpload || !item.file),
  );

  useEffect(() => {
    if (!simulating) return;
    const interval = window.setInterval(() => {
      const time = performance.now();
      setItems((prev) =>
        prev.map((item) => {
          if (item.status !== "uploading" || (onUpload && item.file)) return item;
          const ratio = Math.min(1, (time - item.startedAt) / item.duration);
          const progress = Math.max(
            item.progress,
            ratio < 1 ? ratio * (0.92 + Math.random() * 0.08) : 1,
          );
          if (item.failAt !== undefined && progress >= item.failAt) {
            return {
              ...item,
              progress: item.failAt,
              status: "error",
              error: "Connection lost",
              retryable: true,
            };
          }
          if (progress >= 1) return { ...item, progress: 1, status: "done" };
          return { ...item, progress };
        }),
      );
      setClock(time);
    }, 90);
    return () => window.clearInterval(interval);
  }, [simulating, onUpload]);

  /* Re-render the time left twice a second while anything is moving */
  const moving = items.some((item) => item.status === "uploading");
  useEffect(() => {
    if (!moving) return;
    const interval = window.setInterval(() => setClock(performance.now()), 500);
    return () => window.clearInterval(interval);
  }, [moving]);

  /* Keep the body's height in sync so rows grow and collapse smoothly */
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const inner = innerRef.current;
    if (!body || !inner) return;
    const sync = () => {
      body.style.height = `${inner.offsetHeight}px`;
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  /* One announcement per transition, so the live region speaks the outcome and not the frames */
  useEffect(() => {
    const notes: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      seen.add(item.id);
      const before = spoken.current.get(item.id);
      if (before === item.status) continue;
      spoken.current.set(item.id, item.status);
      if (item.status === "done") notes.push(`${item.name} uploaded`);
      else if (item.status === "error" && item.error) notes.push(`${item.name}: ${item.error}`);
    }
    for (const id of spoken.current.keys()) if (!seen.has(id)) spoken.current.delete(id);
    if (notes.length) setLive(notes[notes.length - 1]);
  }, [items]);

  useEffect(() => {
    onChangeRef.current?.(
      items
        .filter((item) => !item.removing)
        .map(({ id, name, size, status, progress, error, file }) => ({
          id,
          name,
          size,
          status,
          progress,
          error,
          file,
        })),
    );
  }, [items]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  useEffect(() => {
    if (!autoplay) return;
    timers.current.push(
      window.setTimeout(() => setDragCount(AUTOPLAY_SAMPLES.length), 700),
      window.setTimeout(() => {
        setDragCount(0);
        AUTOPLAY_SAMPLES.forEach((sample, index) => {
          timers.current.push(window.setTimeout(() => addFile(sample), index * 140));
        });
      }, 1900),
    );
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    };
  }, [autoplay]);

  function retry(item: InternalItem) {
    update(item.id, {
      status: "uploading",
      progress: 0,
      error: undefined,
      retryable: false,
      failAt: undefined,
      startedAt: performance.now(),
    });
    setClock(performance.now());
    if (onUpload && item.file) upload({ ...item, progress: 0 });
  }

  function remove(id: string) {
    update(id, { removing: true });
    timers.current.push(window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 480));
  }

  function clearFinished() {
    latest.current
      .filter((item) => item.status !== "uploading")
      .forEach((item) => remove(item.id));
  }

  const carriesFiles = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes("Files");

  function handleDragEnter(event: DragEvent<HTMLButtonElement>) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragCount(Math.max(1, event.dataTransfer.items.length));
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragCount(0);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragCount(0);
    addFiles(event.dataTransfer.files);
  }

  const visible = items.filter((item) => !item.removing);
  const uploading = visible.filter((item) => item.status === "uploading");
  const done = visible.filter((item) => item.status === "done");
  const failed = visible.filter((item) => item.status === "error");

  let summary: ReactNode = null;
  if (visible.length) {
    if (uploading.length) {
      const total = uploading.reduce((sum, item) => sum + item.size, 0);
      const sent = uploading.reduce((sum, item) => sum + item.size * item.progress, 0);
      const label = `Uploading ${uploading.length} of ${visible.length}`;
      summary = (
        <span className="ui-dzc__summary">
          <span className="ui-dzc__shimmer" data-text={label}>
            {label}
          </span>
          <span className="ui-dzc__dot">·</span>
          {formatTransfer(sent, total)}
        </span>
      );
    } else {
      summary = (
        <span className="ui-dzc__summary ui-dzc__summary-done">
          {failed.length ? (
            <Glyph d={ICONS.alertCircle} solid className="ui-dzc__warn" />
          ) : (
            <Glyph d={ICONS.checkCircle} solid className="ui-dzc__ok" />
          )}
          {failed.length
            ? `${done.length} of ${visible.length} uploaded`
            : `${done.length} ${done.length === 1 ? "file" : "files"} uploaded`}
        </span>
      );
    }
  }

  const now = clock || 0;

  return (
    <div className={["ui-dzc", className].filter(Boolean).join(" ")}>
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-dropzone-clean" precedence="default">
        {css}
      </style>

      <div className="ui-dzc__card">
        <div ref={bodyRef} className="ui-dzc__body">
          <div ref={innerRef} className="ui-dzc__inner">
            <input
              ref={inputRef}
              id={baseId}
              type="file"
              multiple
              accept={accept?.join(",")}
              className="ui-dzc__input"
              tabIndex={-1}
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
            />

            <button
              type="button"
              className="ui-dzc__area"
              data-dragging={dragCount > 0 || undefined}
              aria-describedby={`${baseId}-hint`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <span className="ui-dzc__stack" aria-hidden="true">
                <span className="ui-dzc__sheet ui-dzc__sheet-l">
                  <TypeBadge name="file.pdf" />
                </span>
                <span className="ui-dzc__sheet ui-dzc__sheet-r">
                  <TypeBadge name="file.png" end />
                </span>
                <span className="ui-dzc__sheet ui-dzc__sheet-m">
                  <Glyph d={ICONS.upload} />
                </span>
              </span>

              <span className="ui-dzc__title" key={dragCount ? "drop" : "idle"}>
                {dragCount ? (
                  `Release to upload ${dragCount === 1 ? "1 file" : `${dragCount} files`}`
                ) : (
                  <>
                    <span className="ui-dzc__for-mouse">
                      Drop files here or <span className="ui-dzc__browse">browse</span>
                    </span>
                    <span className="ui-dzc__for-touch">
                      Tap to <span className="ui-dzc__browse">choose files</span>
                    </span>
                  </>
                )}
              </span>
              <span className="ui-dzc__hint" id={`${baseId}-hint`}>
                {hintText}
              </span>
            </button>

            <ul className="ui-dzc__list" aria-label="Uploads">
              {items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  now={now}
                  onRetry={() => retry(item)}
                  onRemove={() => remove(item.id)}
                />
              ))}
            </ul>
          </div>
        </div>

        <div className="ui-dzc__foot">
          {summary ?? <span className="ui-dzc__foot-idle">No files yet</span>}
          {(done.length > 0 || failed.length > 0) && !uploading.length ? (
            <button type="button" className="ui-dzc__clear" onClick={clearFinished}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <span className="ui-dzc__live" aria-live="polite">
        {live}
      </span>
    </div>
  );
}

/* ---------- rows ---------- */

function Row({
  item,
  now,
  onRetry,
  onRemove,
}: {
  item: InternalItem;
  now: number;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const eta =
    item.status === "uploading"
      ? ((1 - item.progress) * (now - item.startedAt)) / Math.max(0.05, item.progress) / 1000
      : 0;

  return (
    <li
      className="ui-dzc__row"
      data-status={item.status}
      data-removing={item.removing || undefined}
    >
      <div className="ui-dzc__row-inner">
        <FileIcon name={item.name} />
        <div className="ui-dzc__info">
          <div className="ui-dzc__line">
            <span className="ui-dzc__name" title={item.name}>
              {item.name}
            </span>
            {item.status === "done" ? (
              <span className="ui-dzc__done" aria-label="Uploaded">
                <Glyph d={ICONS.checkCircle} solid />
              </span>
            ) : null}
          </div>

          <div className="ui-dzc__meta" key={item.status}>
            {item.status === "uploading" ? (
              <>
                {formatTransfer(item.size * item.progress, item.size)}
                <span className="ui-dzc__dot">·</span>
                {item.progress < 0.04 ? "starting" : formatEta(eta)}
              </>
            ) : null}
            {item.status === "done" ? formatSize(item.size) : null}
            {item.status === "error" ? (
              <span className="ui-dzc__error">{item.error}</span>
            ) : null}
          </div>

          {item.status !== "error" || item.retryable ? (
            <div
              className="ui-dzc__bar"
              data-hidden={item.status === "done" || undefined}
              role="progressbar"
              aria-label={`${item.name} upload`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.progress * 100)}
            >
              <span style={{ transform: `scaleX(${item.progress})` }} />
            </div>
          ) : null}
        </div>

        <div className="ui-dzc__actions">
          {item.status === "error" && item.retryable ? (
            <button
              type="button"
              className="ui-dzc__icon-btn ui-dzc__retry"
              aria-label={`Retry ${item.name}`}
              onClick={onRetry}
            >
              <Glyph d={ICONS.retry} />
            </button>
          ) : null}
          <button
            type="button"
            className="ui-dzc__icon-btn"
            aria-label={`Remove ${item.name}`}
            onClick={onRemove}
          >
            <Glyph d={ICONS.close} />
          </button>
        </div>
      </div>
    </li>
  );
}

/* ---------- icons ---------- */

function Glyph({ d, solid, className }: { d: string; solid?: boolean; className?: string }) {
  return (
    <svg
      viewBox={solid ? "0 0 16 16" : "0 0 24 24"}
      className={["ui-dzc__glyph", className].filter(Boolean).join(" ")}
      data-solid={solid || undefined}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function FileIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 16 16" className="ui-dzc__file" aria-hidden="true">
      <path
        className="ui-dzc__file-sheet"
        d="M4 1.75h5l3.25 3.25v8A1.25 1.25 0 0 1 11 14.25H4A1.25 1.25 0 0 1 2.75 13V3A1.25 1.25 0 0 1 4 1.75Z"
      />
      <path className="ui-dzc__file-fold" d="M9 1.75V4a1 1 0 0 0 1 1h2.25" />
      <rect x="1" y="8.5" width="9" height="4.5" rx="1.25" fill={toneFor(name)} />
    </svg>
  );
}

function TypeBadge({ name, end }: { name: string; end?: boolean }) {
  const label = (extensionOf(name) || "file").slice(0, 4).toUpperCase();
  const width = Math.max(18, label.length * 5.2 + 8);
  const x = end ? 30 - width : 0;

  return (
    <svg viewBox="0 0 30 36" className="ui-dzc__badge" aria-hidden="true">
      <path
        d="M5 1h14l10 10v20a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4V5a4 4 0 0 1 4-4z"
        className="ui-dzc__badge-sheet"
      />
      <path d="M19 1v6a4 4 0 0 0 4 4h6" className="ui-dzc__badge-fold" />
      <rect x={x} y="19" width={width} height="11" rx="3" fill={toneFor(name)} fillOpacity="0.12" />
      <text x={x + 4} y="27.2" className="ui-dzc__badge-text" fill={toneFor(name)}>
        {label}
      </text>
    </svg>
  );
}

/* ---------- styles ---------- */

const css = /* css */ `
.ui-dzc{--ui-dzc-card: #fffdfb;--ui-dzc-ink: rgba(11, 9, 8, 0.88);--ui-dzc-strong: #0b0908;--ui-dzc-text: rgba(11, 9, 8, 0.61);--ui-dzc-muted: rgba(11, 9, 8, 0.45);--ui-dzc-faint: rgba(11, 9, 8, 0.27);--ui-dzc-icon: rgba(11, 9, 8, 0.447);--ui-dzc-line: rgba(11, 9, 8, 0.06);--ui-dzc-dash: rgba(11, 9, 8, 0.12);--ui-dzc-dash-hover: rgba(11, 9, 8, 0.2);--ui-dzc-sheet-line: rgba(11, 9, 8, 0.14);--ui-dzc-track: rgba(11, 9, 8, 0.06);--ui-dzc-wash: rgba(11, 9, 8, 0.03);--ui-dzc-wash-big: rgba(11, 9, 8, 0.015);--ui-dzc-flash: rgba(11, 9, 8, 0.06);--ui-dzc-accent: rgba(217, 84, 31, 0.765);--ui-dzc-accent-soft: rgba(217, 84, 31, 0.035);--ui-dzc-ok: #2f8d5c;--ui-dzc-warn: #d99530;--ui-dzc-danger: #e2544a;--ui-dzc-shine: rgba(255, 253, 251, 0.82);--ui-dzc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-dzc-focus: rgba(217, 84, 31, 0.35);--ui-dzc-ease: cubic-bezier(0.22, 1, 0.36, 1);position: relative;box-sizing: border-box;container-type: inline-size;display: grid;width: 100%;max-width: 520px;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-dzc-ink);-webkit-font-smoothing: antialiased}
.ui-dzc *, .ui-dzc *::before, .ui-dzc *::after{box-sizing: border-box}
:where(.ui-dzc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-dzc) svg{display: block;flex: none}
.ui-dzc button:focus-visible{outline: 2px solid var(--ui-dzc-focus);outline-offset: 1px}
.ui-dzc__glyph{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.65;stroke-linecap: round;stroke-linejoin: round}
.ui-dzc__glyph[data-solid]{fill: currentColor;stroke: none}
.ui-dzc__card{overflow: hidden;border-radius: 10px;background: var(--ui-dzc-card);box-shadow: var(--ui-dzc-shadow)}
.ui-dzc__body{overflow: hidden;transition: height var(--nm-dur-4, 380ms) var(--ui-dzc-ease)}
.ui-dzc__inner{display: flow-root;padding: 8px 8px 4px}
.ui-dzc__input{position: absolute;width: 1px;height: 1px;opacity: 0;pointer-events: none}
.ui-dzc__area{position: relative;display: grid;justify-items: center;width: 100%;margin-bottom: 4px;padding: 24px 16px 20px;border: 1px dashed var(--ui-dzc-dash);border-radius: 10px;background: var(--ui-dzc-card);text-align: center;transition: background-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), border-color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dzc__area:hover{border-color: var(--ui-dzc-dash-hover);background-color: var(--ui-dzc-wash-big)}
.ui-dzc__area[data-dragging]{border-color: var(--ui-dzc-accent);background-color: var(--ui-dzc-accent-soft)}
.ui-dzc__area:focus-visible{outline-offset: 2px}
.ui-dzc__stack{position: relative;width: 64px;height: 44px;margin-bottom: 12px}
.ui-dzc__sheet{position: absolute;left: 50%;bottom: 0;width: 30px;height: 36px;margin-left: -15px;border-radius: 6px;background: var(--ui-dzc-card);box-shadow: var(--ui-dzc-shadow);transition: transform var(--nm-dur-4, 380ms) var(--ui-dzc-ease)}
.ui-dzc__sheet-l, .ui-dzc__sheet-r{background: none;box-shadow: none;filter: drop-shadow(0 1px 1.5px rgba(11, 9, 8, 0.05))}
.ui-dzc__sheet .ui-dzc__badge{width: 100%;height: 100%}
.ui-dzc__sheet-l{transform: translate(-12px, 2px) rotate(-10deg)}
.ui-dzc__sheet-r{transform: translate(12px, 2px) rotate(10deg)}
.ui-dzc__sheet-m{display: grid;place-items: center;transform: translateY(-2px)}
.ui-dzc__sheet-m .ui-dzc__glyph{color: var(--ui-dzc-icon);transition: color 160ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dzc__area:hover .ui-dzc__sheet-m{transform: translateY(-4px)}
.ui-dzc__area:hover .ui-dzc__sheet-m .ui-dzc__glyph{color: var(--ui-dzc-ink)}
.ui-dzc__area[data-dragging] .ui-dzc__sheet-l{transform: translate(-28px, 0) rotate(-16deg)}
.ui-dzc__area[data-dragging] .ui-dzc__sheet-r{transform: translate(28px, 0) rotate(16deg)}
.ui-dzc__area[data-dragging] .ui-dzc__sheet-m{transform: translateY(-8px) scale(1.05)}
.ui-dzc__area[data-dragging] .ui-dzc__sheet-m .ui-dzc__glyph{color: var(--ui-dzc-accent);animation: ui-dzc-bob var(--nm-dur-6, 1100ms) ease-in-out infinite}
.ui-dzc__badge-sheet{fill: var(--ui-dzc-card);stroke: var(--ui-dzc-sheet-line);stroke-width: 0.9}
.ui-dzc__badge-fold{fill: none;stroke: var(--ui-dzc-sheet-line);stroke-width: 0.9;stroke-linejoin: round}
.ui-dzc__badge-text{font-family: inherit;font-size: 6.5px;font-weight: 500;letter-spacing: 0.04em}
.ui-dzc__title{font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-dzc-ink);animation: ui-dzc-in var(--nm-dur-3, 240ms) var(--ui-dzc-ease) both}
.ui-dzc__browse{color: var(--ui-dzc-accent)}
.ui-dzc__hint{font-size: 12px;line-height: 16px;color: var(--ui-dzc-muted)}
.ui-dzc__list{display: grid;margin: 0;padding: 0;list-style: none}
.ui-dzc__row{display: grid;grid-template-rows: 1fr;animation: ui-dzc-grow var(--nm-dur-4, 380ms) var(--ui-dzc-ease) both;transition: grid-template-rows var(--nm-dur-3, 240ms) var(--ui-dzc-ease), opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dzc__row[data-removing]{grid-template-rows: 0fr;opacity: 0;transition: grid-template-rows var(--nm-dur-3, 240ms) var(--ui-dzc-ease) 200ms, opacity var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 180ms}
.ui-dzc__row-inner{position: relative;isolation: isolate;display: flex;align-items: center;gap: 10px;min-height: 0;overflow: hidden;padding: 8px 0 8px 8px}
.ui-dzc__row-inner::before{content: "";position: absolute;inset: 2px 0;border-radius: 6px;background: var(--ui-dzc-flash);opacity: 0;pointer-events: none;z-index: -1}
.ui-dzc__row[data-removing] .ui-dzc__row-inner::before{animation: ui-dzc-flash var(--nm-dur-3, 240ms) ease-out both}
.ui-dzc__row[data-removing]{pointer-events: none}
.ui-dzc__row[data-removing] .ui-dzc__icon-btn{background: none}
.ui-dzc__row + .ui-dzc__row .ui-dzc__row-inner{border-top: 0.5px solid var(--ui-dzc-line)}
.ui-dzc__file{align-self: flex-start;width: 16px;height: 16px;margin-top: 2px;overflow: visible}
.ui-dzc__file-sheet, .ui-dzc__file-fold{fill: none;stroke: var(--ui-dzc-icon);stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-dzc__file-sheet{fill: var(--ui-dzc-card)}
.ui-dzc__info{flex: 1;min-width: 0}
.ui-dzc__line{display: flex;align-items: center;gap: 6px;min-width: 0}
.ui-dzc__name{overflow: hidden;font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-dzc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-dzc__done{display: grid;place-items: center;flex: none;color: var(--ui-dzc-ok);animation: ui-dzc-pop var(--nm-dur-4, 380ms) cubic-bezier(0.34, 1.56, 0.64, 1) both}
.ui-dzc__done .ui-dzc__glyph{width: 14px;height: 14px}
.ui-dzc__meta{font-size: 12px;line-height: 16px;font-variant-numeric: tabular-nums;color: var(--ui-dzc-muted);animation: ui-dzc-in 240ms var(--ui-dzc-ease) both}
.ui-dzc__dot{margin: 0 5px;color: var(--ui-dzc-faint)}
.ui-dzc__error{color: var(--ui-dzc-danger)}
.ui-dzc__row[data-status="error"] .ui-dzc__row-inner{animation: ui-dzc-shake 380ms var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both}
.ui-dzc__bar{position: relative;height: 2px;margin-top: 6px;margin-bottom: 2px;overflow: hidden;border-radius: 1px;background: var(--ui-dzc-track);transition: height var(--nm-dur-4, 380ms) var(--ui-dzc-ease) 250ms, margin var(--nm-dur-4, 380ms) var(--ui-dzc-ease) 250ms, opacity var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)) 200ms}
.ui-dzc__bar[data-hidden]{height: 0;margin-top: 0;margin-bottom: 0;opacity: 0}
.ui-dzc__bar > span{position: absolute;inset: 0;border-radius: inherit;background: var(--ui-dzc-accent);transform-origin: left;transition: transform var(--nm-dur-2, 160ms) linear, background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dzc__row[data-status="error"] .ui-dzc__bar > span{background: var(--ui-dzc-danger)}
.ui-dzc__actions{display: flex;flex: none;gap: 2px}
.ui-dzc__icon-btn{display: grid;place-items: center;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-dzc-icon);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-dzc__icon-btn:hover{background: var(--ui-dzc-wash);color: var(--ui-dzc-ink)}
.ui-dzc__retry:active .ui-dzc__glyph{transform: rotate(120deg);transition: transform var(--nm-dur-3, 240ms) var(--ui-dzc-ease)}
.ui-dzc__foot{display: flex;align-items: center;justify-content: space-between;gap: 12px;height: 44px;padding: 0 8px 0 16px;border-top: 0.5px solid var(--ui-dzc-line);font-size: 12px;line-height: 16px;font-variant-numeric: tabular-nums;color: var(--ui-dzc-muted)}
.ui-dzc__foot > span{min-width: 0;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;animation: ui-dzc-in 240ms var(--ui-dzc-ease) both}
.ui-dzc__summary{color: var(--ui-dzc-text)}
.ui-dzc__summary .ui-dzc__dot{color: var(--ui-dzc-faint)}
.ui-dzc__summary-done{display: inline-flex;align-items: center;gap: 6px;color: var(--ui-dzc-ink)}
.ui-dzc__ok{color: var(--ui-dzc-ok)}
.ui-dzc__warn{color: var(--ui-dzc-warn)}
.ui-dzc__summary-done .ui-dzc__glyph{width: 16px;height: 16px}
.ui-dzc__clear{flex: none;height: 28px;padding: 0 10px;border-radius: 6px;background: var(--ui-dzc-card);box-shadow: var(--ui-dzc-shadow);font-size: 13px;line-height: 20px;font-weight: 500;color: var(--ui-dzc-strong);transition: background-color var(--nm-dur-1, 90ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));animation: ui-dzc-in 240ms var(--ui-dzc-ease) both}
.ui-dzc__clear:hover{background: #faf7f4}
.ui-dzc__live{position: absolute;width: 1px;height: 1px;overflow: hidden;clip-path: inset(50%);white-space: nowrap}
.ui-dzc__shimmer{position: relative}
.ui-dzc__shimmer::after{content: attr(data-text);content: attr(data-text) / "";position: absolute;inset: 0;white-space: nowrap;color: transparent;background: linear-gradient(90deg, transparent 38%, var(--ui-dzc-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;-webkit-background-clip: text;background-clip: text;animation: ui-dzc-sweep var(--nm-dur-6, 1100ms) linear infinite;pointer-events: none}
@keyframes ui-dzc-in{from{opacity: 0;transform: translateY(3px)}
to{opacity: 1;transform: none}
}
@keyframes ui-dzc-grow{from{grid-template-rows: 0fr;opacity: 0}
to{grid-template-rows: 1fr;opacity: 1}
}
@keyframes ui-dzc-pop{0%{transform: scale(0.4)}
60%{transform: scale(1.15)}
100%{transform: scale(1)}
}
@keyframes ui-dzc-bob{50%{transform: translateY(-3px)}
}
@keyframes ui-dzc-flash{0%{opacity: 0}
35%{opacity: 1}
100%{opacity: 0}
}
@keyframes ui-dzc-shake{20%, 60%{transform: translateX(-3px)}
40%, 80%{transform: translateX(3px)}
}
@keyframes ui-dzc-sweep{from{background-position: 100% 0}
to{background-position: 0% 0}
}
@container (max-width: 420px){.ui-dzc__area{padding: 20px 12px 16px}
.ui-dzc__foot{padding-left: 12px}
}
.ui-dzc__for-touch{display: none}
@media (hover: none) and (pointer: coarse){.ui-dzc__for-mouse{display: none}
.ui-dzc__for-touch{display: inline}
.ui-dzc__icon-btn{width: 36px;height: 36px}
.ui-dzc__foot{height: 52px}
.ui-dzc__clear{height: 34px;padding: 0 12px}
}
@media (prefers-reduced-motion: reduce){.ui-dzc *, .ui-dzc *::before, .ui-dzc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-dzc{--ui-dzc-card: #211b16;--ui-dzc-ink: rgba(255, 253, 251, 0.9);--ui-dzc-strong: #fffdfb;--ui-dzc-text: rgba(255, 253, 251, 0.62);--ui-dzc-muted: rgba(255, 253, 251, 0.46);--ui-dzc-faint: rgba(255, 253, 251, 0.3);--ui-dzc-icon: rgba(255, 253, 251, 0.5);--ui-dzc-line: rgba(255, 253, 251, 0.08);--ui-dzc-dash: rgba(255, 253, 251, 0.16);--ui-dzc-dash-hover: rgba(255, 253, 251, 0.26);--ui-dzc-sheet-line: rgba(255, 253, 251, 0.2);--ui-dzc-track: rgba(255, 253, 251, 0.08);--ui-dzc-wash: rgba(255, 253, 251, 0.05);--ui-dzc-wash-big: rgba(255, 253, 251, 0.02);--ui-dzc-flash: rgba(255, 253, 251, 0.08);--ui-dzc-accent: #ff8a5c;--ui-dzc-accent-soft: rgba(255, 138, 92, 0.07);--ui-dzc-ok: #2f8d5c;--ui-dzc-danger: #e2544a;--ui-dzc-shine: rgba(255, 253, 251, 0.82);--ui-dzc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4);--ui-dzc-focus: rgba(255, 138, 92, 0.5)}
:where(.dark, [data-theme="dark"]) .ui-dzc__clear:hover{background: #27201a}

`;
