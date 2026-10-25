"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Integration Picker – the integrations page of a command menu, in a single self-contained file.
 * A search field sits in the header behind a breadcrumb, the service list is split into Connected and Available
 * with one grey highlight that glides to the picked row, and the picked service shows beside it between the
 * product mark and the service mark, joined by a pair of arrows that turn once it is connected. The service tile
 * and the detail column replay a short blur-and-rise whenever the pick changes, and a ring keeps spreading behind
 * the tiles while the picker is on. ↑/↓ move the pick, ↵ switches it, ⌘/ jumps to the search field. Below 560px of
 * its own width the two columns stack and the key hints go away; below 400px the feature list hides too.
 * The styles are injected below, so no extra files are needed.
 */

/** How the mark behind a service logo is painted. */
export type IntegrationTone = "brand" | "light" | "ink";

export type IntegrationService = {
  /** Stable id; also the row's `data-id` and its DOM id suffix */
  id: string;
  /** Product name in the list, e.g. "Linear" */
  name: string;
  /** Second line in the list, e.g. "Project management" */
  category: string;
  /** Mark background – "brand" paints it in `brand`, "light" white, "ink" black. Default "brand" */
  tone?: IntegrationTone;
  /** Brand colour as a CSS colour, e.g. "#5E6AD2"; required for the "brand" tone */
  brand?: string;
  /** Shown next to the connected chip, e.g. "linear.app" */
  domain?: string;
  /** One sentence for the detail column */
  description?: string;
  /** Short capability lines under the description */
  features?: string[];
  /** Your own mark for this service, sitting in the 24px logo slot */
  icon?: ReactNode;
  /** Starts connected */
  connected?: boolean;
};

export type IntegrationPickerProps = {
  /** Services to list – ten sample ones when left out */
  services?: IntegrationService[];
  /** Id of the picked service, when you keep the pick yourself */
  value?: string;
  /** Id of the picked service on the first render */
  defaultValue?: string;
  /** Called when another service is picked */
  onChange?: (id: string) => void;
  /** Called after a service was switched on */
  onConnect?: (service: IntegrationService) => void;
  /** Called after a service was switched off */
  onDisconnect?: (service: IntegrationService) => void;
  /** Called by "Explore integration" for the picked service */
  onExplore?: (service: IntegrationService) => void;
  /** Called by the back arrow, and by Esc when the search is empty */
  onBack?: () => void;
  /** Your product's name in the title, e.g. "affectUI + Linear" */
  appName?: string;
  /** Your product's mark on the black tile; the affect mark is drawn when this is left out */
  appIcon?: ReactNode;
  /** Keeps the spreading ring and the turned arrows on */
  animate?: boolean;
  /** Freezes the spreading ring */
  paused?: boolean;
  /** Extra class on the block */
  className?: string;
};

const defaultServices: IntegrationService[] = [
  {
    id: "linear",
    name: "Linear",
    category: "Project management",
    tone: "brand",
    brand: "#5E6AD2",
    domain: "linear.app",
    description: "Turn requests from chat into issues and keep their status in sync both ways.",
    features: ["Create issues from any message", "Two-way status sync", "Link issues to customers"],
    connected: true,
  },
  {
    id: "notion",
    name: "Notion",
    category: "Docs & wiki",
    tone: "light",
    domain: "notion.so",
    description: "Search the pages the assistant may read, and file the result back where the team looks.",
    features: ["Search across the workspace", "Append to a page", "Draft a note from a database"],
    connected: true,
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    tone: "brand",
    brand: "#635BFF",
    domain: "stripe.com",
    description: "Look invoices up while the answer is written, so billing replies carry the real number.",
    features: ["Find a customer by email", "Read subscription status", "Pull the last invoice"],
    connected: true,
  },
  {
    id: "figma",
    name: "Figma",
    category: "Design",
    tone: "light",
    domain: "figma.com",
    description: "Hand a frame to the model so the copy, the spacing and the tokens match the latest design.",
    features: ["Read the active frame", "List comments", "Export an asset"],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "CRM",
    tone: "brand",
    brand: "#FF7A59",
    domain: "hubspot.com",
    description: "Enrich a lead, log the call and move the deal before the follow-up is written.",
    features: ["Update a contact", "Log an activity", "Move a deal stage"],
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "Commerce",
    tone: "brand",
    brand: "#95BF47",
    domain: "shopify.com",
    description: "Check stock and order state before anyone promises a delivery date to a customer.",
    features: ["Look up an order", "Read stock levels", "Draft a refund"],
  },
  {
    id: "airtable",
    name: "Airtable",
    category: "Databases",
    tone: "light",
    domain: "airtable.com",
    description: "Treat a base as a table the assistant can read, filter and append to as the work moves.",
    features: ["Read a base", "Filter records", "Append a row"],
  },
  {
    id: "webflow",
    name: "Webflow",
    category: "Website",
    tone: "brand",
    brand: "#146EF5",
    domain: "webflow.com",
    description: "Publish the pages the assistant drafts, then read what people do on them afterwards.",
    features: ["Draft a page", "Publish a change", "Read page traffic"],
  },
  {
    id: "vercel",
    name: "Vercel",
    category: "Developer tools",
    tone: "ink",
    domain: "vercel.com",
    description: "Read deployments and build logs, then redeploy the branch that fixed the failing check.",
    features: ["Read a deployment", "Follow the build log", "Redeploy a branch"],
  },
  {
    id: "clickup",
    name: "ClickUp",
    category: "Project management",
    tone: "light",
    domain: "clickup.com",
    description: "Keep the task list current as work moves, with the owner and the due date already set.",
    features: ["Create a task", "Change a status", "Assign an owner"],
  },
];

/** The brand colour rides in as a custom property; the sheet owns every painted colour. */
function brandStyle(service: IntegrationService): CSSProperties | undefined {
  if ((service.tone ?? "brand") !== "brand" || !service.brand) return undefined;
  return { "--ui-ipc-brand": service.brand } as CSSProperties;
}

export function IntegrationPicker({
  services = defaultServices,
  value,
  defaultValue,
  onChange,
  onConnect,
  onDisconnect,
  onExplore,
  onBack,
  appName = "affectUI",
  appIcon,
  animate = true,
  paused = false,
  className,
}: IntegrationPickerProps) {
  const base = `ui-ipc${useId()}`;
  const listId = `${base}-list`;

  const [query, setQuery] = useState("");
  const [pick, setPick] = useState(defaultValue ?? "");
  const [live, setLive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(services.map((service) => [service.id, Boolean(service.connected)])),
  );
  const [pill, setPill] = useState({ top: 30, height: 44 });
  const [swapped, setSwapped] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const painted = useRef(false);

  const term = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      services.filter(
        (service) =>
          !term ||
          service.name.toLowerCase().includes(term) ||
          service.category.toLowerCase().includes(term),
      ),
    [services, term],
  );
  const sections: Array<{ label: string; rows: IntegrationService[] }> = [
    { label: "Connected", rows: rows.filter((service) => live[service.id]) },
    { label: "Available", rows: rows.filter((service) => !live[service.id]) },
  ];

  const wanted = value ?? pick;
  const active = rows.find((service) => service.id === wanted) ?? rows[0];
  const activeId = active?.id;
  const activeLive = activeId ? Boolean(live[activeId]) : false;
  const connectedCount = services.filter((service) => live[service.id]).length;
  const order = rows.map((service) => service.id).join("|");

  /* One highlight for the whole list: it is re-measured onto whichever row is picked. */
  useLayoutEffect(() => {
    const node = activeId ? itemRefs.current[activeId] : null;
    if (!node) return;
    setPill({ top: node.offsetTop, height: node.offsetHeight });
  }, [activeId, order]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const node = activeId ? itemRefs.current[activeId] : null;
      if (node) setPill({ top: node.offsetTop, height: node.offsetHeight });
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeId]);

  /* The tile and the detail column replay their entrance on every change of pick. */
  useEffect(() => {
    if (!painted.current) {
      painted.current = true;
      return;
    }
    setSwapped(true);
    const timer = window.setTimeout(() => setSwapped(false), 520);
    return () => window.clearTimeout(timer);
  }, [activeId]);

  /* ⌘/ puts the caret in the search field from anywhere on the page. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const select = (id: string) => {
    if (value === undefined) setPick(id);
    onChange?.(id);
  };

  const move = (step: 1 | -1) => {
    if (rows.length === 0) return;
    const at = active ? rows.indexOf(active) : -1;
    const next = rows[(at + step + rows.length) % rows.length];
    if (!next) return;
    select(next.id);
    itemRefs.current[next.id]?.scrollIntoView({ block: "nearest" });
  };

  const toggle = (service: IntegrationService) => {
    const was = Boolean(live[service.id]);
    setLive((current) => ({ ...current, [service.id]: !was }));
    if (was) onDisconnect?.(service);
    else onConnect?.(service);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active) toggle(active);
    } else if (event.key === "Escape") {
      if (query) {
        event.preventDefault();
        setQuery("");
      } else if (onBack) {
        event.preventDefault();
        onBack();
      }
    }
  };

  return (
    <div
      className={["ui-ipc", className].filter(Boolean).join(" ")}
      data-on={animate ? "true" : undefined}
      data-paused={paused ? "" : undefined}
      data-swapped={swapped ? "" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many pickers render */}
      <style href="ui-integration-picker" precedence="default">
        {css}
      </style>

      <div className="ui-ipc__card">
        <div className="ui-ipc__top">
          <button type="button" className="ui-ipc__back" aria-label="Back" onClick={() => onBack?.()}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </button>
          <label className="ui-ipc__search">
            <span className="ui-ipc__crumb">Integrations</span>
            <input
              ref={inputRef}
              placeholder="Search integrations"
              aria-label="Search integrations"
              aria-controls={listId}
              aria-activedescendant={activeId ? `${base}-${activeId}` : undefined}
              role="combobox"
              aria-expanded="true"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <kbd className="ui-ipc__kbd">⌘/</kbd>
          </label>
        </div>

        <div className="ui-ipc__body">
          <div id={listId} ref={listRef} className="ui-ipc__list" role="listbox" aria-label="Integrations">
            {active ? (
              <span
                className="ui-ipc__pill"
                aria-hidden="true"
                style={{ transform: `translateY(${pill.top}px)`, height: `${pill.height}px` }}
              />
            ) : null}
            {sections.map((section) =>
              section.rows.length === 0 ? null : (
                <div key={section.label} role="group" aria-label={section.label} className="ui-ipc__group">
                  <span className="ui-ipc__label">{section.label}</span>
                  {section.rows.map((service) => (
                    <button
                      key={service.id}
                      id={`${base}-${service.id}`}
                      data-id={service.id}
                      type="button"
                      role="option"
                      aria-selected={service.id === activeId}
                      className="ui-ipc__item"
                      tabIndex={-1}
                      ref={(node) => {
                        itemRefs.current[service.id] = node;
                      }}
                      onClick={() => select(service.id)}
                    >
                      <span className="ui-ipc__logo" data-tone={service.tone ?? "brand"} style={brandStyle(service)}>
                        <ServiceMark id={service.id} icon={service.icon} />
                      </span>
                      <span className="ui-ipc__name">
                        <b>{service.name}</b>
                        <small>{service.category}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ),
            )}
            {rows.length === 0 ? (
              <p className="ui-ipc__empty">
                Nothing matches <b>{query.trim()}</b>
              </p>
            ) : null}
          </div>

          <section className="ui-ipc__detail" aria-live="polite">
            {active ? (
              <>
                <div className="ui-ipc__art" aria-hidden="true">
                  <span className="ui-ipc__rings">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="ui-ipc__tile ui-ipc__tile--app">
                    {appIcon ?? (
                      <svg viewBox="0 0 107 107" className="ui-ipc__mark" fill="currentColor">
                        <path d={APP_MARK} />
                      </svg>
                    )}
                  </span>
                  <span className="ui-ipc__link">
                    <svg viewBox="0 0 16 16">
                      <path d={LINK_MARK} />
                    </svg>
                  </span>
                  <span
                    className="ui-ipc__tile ui-ipc__tile--brand"
                    data-tone={active.tone ?? "brand"}
                    style={brandStyle(active)}
                  >
                    <ServiceMark id={active.id} icon={active.icon} />
                  </span>
                </div>

                <div className="ui-ipc__info">
                  <div className="ui-ipc__title">
                    <div>
                      <h3>
                        {appName} + {active.name}
                      </h3>
                      <span className="ui-ipc__domain">
                        {active.domain}
                        {activeLive ? <span className="ui-ipc__state">Connected</span> : null}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activeLive}
                      aria-label={`${activeLive ? "Disconnect" : "Connect"} ${active.name}`}
                      className="ui-ipc__switch"
                      onClick={() => toggle(active)}
                    />
                  </div>

                  {active.description ? <p className="ui-ipc__desc">{active.description}</p> : null}

                  {active.features?.length ? (
                    <ul className="ui-ipc__features">
                      {active.features.map((feature) => (
                        <li key={feature}>
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="m3.5 8.5 3 3 6-7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <button type="button" className="ui-ipc__explore" onClick={() => onExplore?.(active)}>
                    Explore integration
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6.5 4 10.5 8l-4 4" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <p className="ui-ipc__empty ui-ipc__empty--detail">
                Nothing matches <b>{query.trim()}</b>
              </p>
            )}
          </section>
        </div>

        <footer className="ui-ipc__foot">
          <span className="ui-ipc__count">
            <i aria-hidden="true" />
            {connectedCount} of {services.length} connected
          </span>
          <span className="ui-ipc__hints" aria-hidden="true">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <span>to move</span>
            <kbd>↵</kbd>
            <span>to switch</span>
          </span>
        </footer>
      </div>
    </div>
  );
}

/** The mark of one service; your own `icon` wins over the built-in brand marks. */
function ServiceMark({ id, icon }: { id: string; icon?: ReactNode }) {
  const uid = useId().replace(/:/g, "_");
  if (icon) return <>{icon}</>;

  switch (id) {
    case "linear":
      return (
        <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
          <path d={MARK_LINEAR} />
        </svg>
      );
    case "notion":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={MARK_NOTION} />
        </svg>
      );
    case "stripe":
      return (
        <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
          <path d={MARK_STRIPE} />
        </svg>
      );
    case "figma":
      return (
        <svg viewBox="0 0 38 57" aria-hidden="true">
          <path d={FIGMA_DOT} fill="#1ABCFE" />
          <path d={FIGMA_BAR} fill="#0ACF83" />
          <path d={FIGMA_CORNER} fill="#FF7262" />
          <path d={FIGMA_WING} fill="#F24E1E" />
          <path d={FIGMA_HALF} fill="#A259FF" />
        </svg>
      );
    case "hubspot":
      return (
        <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
          <path d={MARK_HUBSPOT} />
        </svg>
      );
    case "shopify":
      return (
        <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
          <path d={MARK_SHOPIFY} />
        </svg>
      );
    case "airtable":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#FCB400" d={AIRTABLE_TOP} />
          <path fill="#18BFFF" d={AIRTABLE_RIGHT} />
          <path fill="#F82B60" d={AIRTABLE_LEFT} />
        </svg>
      );
    case "webflow":
      return (
        <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
          <path d={MARK_WEBFLOW} />
        </svg>
      );
    case "vercel":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="m12 1.608 12 20.784H0Z" />
        </svg>
      );
    case "clickup":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id={`ui-ipc-cu${uid}-a`} x1="0" y1="1" x2="1" y2="0">
              <stop stopColor="#8930FD" />
              <stop offset="1" stopColor="#49CCF9" />
            </linearGradient>
            <linearGradient id={`ui-ipc-cu${uid}-b`} x1="0" y1="1" x2="1" y2="0">
              <stop stopColor="#FF02F0" />
              <stop offset="1" stopColor="#FFC800" />
            </linearGradient>
          </defs>
          <path fill={`url(#ui-ipc-cu${uid}-a)`} d={CLICKUP_BASE} />
          <path fill={`url(#ui-ipc-cu${uid}-b)`} d={CLICKUP_PEAK} />
        </svg>
      );
    default:
      return null;
  }
}

/* Brand marks, lifted verbatim from the reference DOM */
const MARK_LINEAR = "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z";
const MARK_NOTION = "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z";
const MARK_STRIPE = "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z";
const FIGMA_DOT = "M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z";
const FIGMA_BAR = "M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z";
const FIGMA_CORNER = "M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z";
const FIGMA_WING = "M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z";
const FIGMA_HALF = "M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z";
const MARK_HUBSPOT = "M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z";
const MARK_SHOPIFY = "M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z";
const AIRTABLE_TOP = "M11.992 1.966c-.434 0-.87.086-1.28.257L1.779 5.917c-.503.208-.49.908.012 1.116l8.982 3.558a3.266 3.266 0 0 0 2.454 0l8.982-3.558c.503-.196.503-.908.012-1.116l-8.957-3.694a3.255 3.255 0 0 0-1.272-.257z";
const AIRTABLE_RIGHT = "M23.4 8.056a.589.589 0 0 0-.222.045l-10.012 3.877a.612.612 0 0 0-.38.564v8.896a.6.6 0 0 0 .821.552L23.62 18.1a.583.583 0 0 0 .38-.551V8.653a.6.6 0 0 0-.6-.596z";
const AIRTABLE_LEFT = "M.676 8.095a.644.644 0 0 0-.48.19C.086 8.396 0 8.53 0 8.69v8.355c0 .442.515.737.908.54l6.27-3.006.307-.147 2.969-1.436c.466-.22.43-.908-.061-1.092L.883 8.138a.57.57 0 0 0-.207-.044z";
const MARK_WEBFLOW = "m24 4.515-7.658 14.97H9.149l3.205-6.204h-.144C9.566 16.713 5.621 18.973 0 19.485v-6.118s3.596-.213 5.71-2.435H0V4.515h6.417v5.278l.144-.001 2.622-5.277h4.854v5.244h.144l2.72-5.244H24Z";
const CLICKUP_BASE = "M2 18.439l3.69-2.828c1.961 2.56 4.044 3.739 6.363 3.739 2.307 0 4.33-1.166 6.203-3.704L22 18.405C19.298 22.065 15.941 24 12.053 24 8.178 24 4.788 22.078 2 18.439z";
const CLICKUP_PEAK = "M12.04 6.15l-6.568 5.66-3.036-3.52L12.055 0l9.543 8.296-3.05 3.509z";
const APP_MARK = "M106.447 67.3367C106.447 69.7104 104.523 71.6348 102.149 71.6348H75.928C73.5542 71.6348 71.6299 73.5591 71.6299 75.9329V102.16C71.6299 104.534 69.7056 106.458 67.3318 106.458H35.8198C35.8185 106.458 35.8174 106.459 35.8174 106.46C35.8174 106.462 35.8163 106.463 35.8149 106.463H4.29811C1.92433 106.463 0 104.539 0 102.165V39.1262C0 36.7525 1.92433 34.8281 4.29811 34.8281H30.5193C32.8931 34.8281 34.8174 32.9038 34.8174 30.53V4.29812C34.8174 1.92433 36.7417 0 39.1155 0H102.149C104.523 0 106.447 1.92433 106.447 4.29811V67.3367ZM35.8174 66.3425C35.8174 68.7163 37.7417 70.6406 40.1155 70.6406H66.3318C68.7056 70.6406 70.6299 68.7163 70.6299 66.3425V40.1155C70.6299 37.7417 68.7056 35.8174 66.3318 35.8174H40.1155C37.7417 35.8174 35.8174 37.7417 35.8174 40.1155V66.3425Z";
const LINK_MARK = "M2.5 6h10.5M10.5 3.5 13 6l-2.5 2.5M13.5 10H3M5.5 7.5 3 10l2.5 2.5";

const css = /* css */ `
.ui-ipc{--ui-ipc-card: #fffdfb;--ui-ipc-strong: #0b0908;--ui-ipc-ink: rgba(11, 9, 8, 0.88);--ui-ipc-text: rgba(11, 9, 8, 0.61);--ui-ipc-muted: rgba(11, 9, 8, 0.45);--ui-ipc-faint: rgba(11, 9, 8, 0.27);--ui-ipc-icon: rgba(11, 9, 8, 0.447);--ui-ipc-line: rgba(11, 9, 8, 0.06);--ui-ipc-line-strong: rgba(11, 9, 8, 0.1);--ui-ipc-wash: rgba(11, 9, 8, 0.03);--ui-ipc-soft: rgba(11, 9, 8, 0.015);--ui-ipc-fill: rgba(11, 9, 8, 0.06);--ui-ipc-light: #fffdfb;--ui-ipc-light-ring: rgba(11, 9, 8, 0.1);--ui-ipc-ink-tile: #0b0908;--ui-ipc-ink-mark: #fffdfb;--ui-ipc-app: #0b0908;--ui-ipc-app-ink: #fffdfb;--ui-ipc-app-ring: rgba(255, 253, 251, 0.1);--ui-ipc-tile-shadow: 0 1px 2px 0 rgba(11, 9, 8, 0.05), 0 8px 16px -8px rgba(11, 9, 8, 0.18);--ui-ipc-ring: rgba(11, 9, 8, 0.06);--ui-ipc-accent: rgba(217, 84, 31, 0.765);--ui-ipc-focus: rgba(217, 84, 31, 0.35);--ui-ipc-switch-off: rgba(11, 9, 8, 0.1);--ui-ipc-ok: #2f8d5c;--ui-ipc-ok-fill: rgba(47, 141, 92, 0.08);--ui-ipc-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 1px -1px rgba(11, 9, 8, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.05);--ui-ipc-ease: cubic-bezier(0.22, 1, 0.36, 1);box-sizing: border-box;container-type: inline-size;display: grid;width: 100%;max-width: 660px;font-family: "Inter", "InterVariable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;font-size: 13px;line-height: 20px;font-weight: 400;color: var(--ui-ipc-ink);-webkit-font-smoothing: antialiased}
.ui-ipc *, .ui-ipc *::before, .ui-ipc *::after{box-sizing: border-box}
:where(.ui-ipc) button{margin: 0;padding: 0;border: 0;background: none;font: inherit;color: inherit;cursor: pointer}
:where(.ui-ipc) svg{display: block;flex: none}
.ui-ipc button:focus-visible{outline: 2px solid var(--ui-ipc-focus);outline-offset: 1px}
.ui-ipc__card{display: grid;grid-template-rows: auto minmax(0, 1fr) auto;min-height: 0;overflow: hidden;border-radius: 10px;background: var(--ui-ipc-card);box-shadow: var(--ui-ipc-shadow)}
.ui-ipc__top{display: flex;align-items: center;gap: 6px;height: 48px;padding: 0 12px 0 10px;border-bottom: 0.5px solid var(--ui-ipc-line)}
.ui-ipc__back{display: grid;place-items: center;flex: none;width: 28px;height: 28px;border-radius: 6px;color: var(--ui-ipc-icon);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ipc__back:hover{background: var(--ui-ipc-wash);color: var(--ui-ipc-ink)}
.ui-ipc__back svg, .ui-ipc__lens{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-ipc__lens{margin: 0 4px 0 6px;color: var(--ui-ipc-icon)}
.ui-ipc__search{display: flex;flex: 1;align-items: center;gap: 8px;min-width: 0;height: 100%;cursor: text}
.ui-ipc__crumb{flex: none;padding: 2px 6px;border-radius: 5px;background: var(--ui-ipc-fill);font-size: 12px;font-weight: 500;line-height: 16px;color: var(--ui-ipc-text)}
.ui-ipc__search input{flex: 1;min-width: 0;height: 20px;padding: 0;border: 0;background: transparent;font: inherit;font-size: 13px;line-height: 20px;color: var(--ui-ipc-ink);caret-color: var(--ui-ipc-accent);outline: none}
.ui-ipc__search input::placeholder{color: var(--ui-ipc-faint)}
.ui-ipc__search input:focus-visible{outline: none}
.ui-ipc kbd{display: inline-grid;place-items: center;flex: none;min-width: 20px;height: 20px;padding: 0 5px;border-radius: 5px;box-shadow: inset 0 0 0 0.5px var(--ui-ipc-line-strong);font-family: inherit;font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-ipc-muted)}
.ui-ipc__body{display: grid;grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);height: 356px;min-height: 0}
.ui-ipc__list{position: relative;min-height: 0;padding: 0 4px 4px;overflow-y: auto;border-right: 0.5px solid var(--ui-ipc-line);scrollbar-width: thin}
.ui-ipc__group{display: flex;flex-direction: column}
.ui-ipc__label{padding: 10px 8px 4px;font-size: 10px;font-weight: 500;line-height: 16px;letter-spacing: 0.5px;text-transform: uppercase;color: var(--ui-ipc-muted)}
.ui-ipc__pill{position: absolute;top: 0;left: 4px;right: 4px;border-radius: 6px;background: var(--ui-ipc-fill);transition: transform 90ms ease-out, height 90ms ease-out}
.ui-ipc__item{position: relative;display: flex;flex: none;align-items: center;gap: 10px;height: 44px;padding: 0 8px;border-radius: 6px;text-align: left;transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ipc__item:not([aria-selected="true"]):hover{background: var(--ui-ipc-wash)}
.ui-ipc__name{display: grid;min-width: 0}
.ui-ipc__name b{overflow: hidden;font-weight: 400;line-height: 20px;color: var(--ui-ipc-ink);white-space: nowrap;text-overflow: ellipsis}
.ui-ipc__name small{overflow: hidden;font-size: 12px;line-height: 16px;color: var(--ui-ipc-muted);white-space: nowrap;text-overflow: ellipsis}
.ui-ipc__logo{display: grid;place-items: center;flex: none;width: 24px;height: 24px;border-radius: 6px;box-shadow: 0 0 0 0.5px var(--ui-ipc-mark-ring), 0 1px 1px -1px rgba(0, 0, 0, 0.1)}
:is(.ui-ipc__logo, .ui-ipc__tile--brand)[data-tone="brand"]{--ui-ipc-mark-ring: rgba(0, 0, 0, 0.06);background: var(--ui-ipc-brand);color: #fff}
:is(.ui-ipc__logo, .ui-ipc__tile--brand)[data-tone="light"]{--ui-ipc-mark-ring: var(--ui-ipc-light-ring);background: var(--ui-ipc-light);color: var(--ui-ipc-strong)}
:is(.ui-ipc__logo, .ui-ipc__tile--brand)[data-tone="ink"]{--ui-ipc-mark-ring: rgba(0, 0, 0, 0.06);background: var(--ui-ipc-ink-tile);color: var(--ui-ipc-ink-mark)}
.ui-ipc__logo svg{width: 13px;height: 13px}
.ui-ipc__empty{margin: 0;padding: 14px 8px;font-size: 13px;color: var(--ui-ipc-muted)}
.ui-ipc__empty b{font-weight: 500;color: var(--ui-ipc-ink)}
.ui-ipc__empty--detail{display: grid;place-items: center;height: 100%}
.ui-ipc__detail{display: flex;flex-direction: column;min-height: 0;overflow: hidden}
.ui-ipc__art{position: relative;display: flex;flex: none;align-items: center;justify-content: center;gap: 16px;height: 104px;overflow: hidden;margin: 8px 8px 0;border-radius: 8px;background: var(--ui-ipc-soft);box-shadow: inset 0 0 0 0.5px var(--ui-ipc-line)}
.ui-ipc__rings{position: absolute;inset: 0;display: grid;place-items: center;pointer-events: none}
.ui-ipc__rings i{position: absolute;width: calc(90px + var(--n, 0) * 56px);aspect-ratio: 1;border-radius: 50%;box-shadow: inset 0 0 0 0.5px var(--ui-ipc-ring)}
.ui-ipc__rings i:nth-child(2){--n: 1}
.ui-ipc__rings i:nth-child(3){--n: 2}
.ui-ipc__rings i:nth-child(4){opacity: 0;box-shadow: inset 0 0 0 0.5px var(--ui-ipc-accent)}
.ui-ipc[data-on] .ui-ipc__rings i:nth-child(4){animation: ui-ipc-spread var(--nm-dur-6, 1100ms) var(--ui-ipc-ease) infinite}
.ui-ipc[data-paused] .ui-ipc__rings i{animation-play-state: paused}
@keyframes ui-ipc-spread{0%{opacity: 0.5;transform: scale(0.9)}
100%{opacity: 0;transform: scale(2.6)}
}
.ui-ipc__tile{position: relative;z-index: 1;display: grid;place-items: center;width: 44px;height: 44px;border-radius: 10px;box-shadow: 0 0 0 0.5px var(--ui-ipc-mark-ring), var(--ui-ipc-tile-shadow)}
.ui-ipc__tile svg{width: 20px;height: 20px}
.ui-ipc__tile--app{background: var(--ui-ipc-app);box-shadow: inset 0 0 0 0.5px var(--ui-ipc-app-ring), var(--ui-ipc-tile-shadow);color: var(--ui-ipc-app-ink)}
.ui-ipc__tile--app .ui-ipc__mark{width: 18px;height: 18px}
.ui-ipc[data-swapped] .ui-ipc__tile--brand{animation: ui-ipc-swap var(--nm-dur-4, 380ms) var(--ui-ipc-ease)}
@keyframes ui-ipc-swap{from{opacity: 0;transform: translateY(6px) scale(0.92);filter: blur(4px)}
to{opacity: 1;transform: none;filter: none}
}
.ui-ipc__link{position: relative;z-index: 1;display: grid;place-items: center;width: 28px;height: 28px;color: var(--ui-ipc-faint);transition: color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--nm-dur-5, 620ms) var(--ui-ipc-ease)}
.ui-ipc__link svg{width: 16px;height: 16px;fill: none;stroke: currentColor;stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-ipc[data-on] .ui-ipc__link{color: var(--ui-ipc-accent);transform: rotate(180deg)}
.ui-ipc__info{display: flex;flex: 1;flex-direction: column;padding: 12px 16px 16px}
.ui-ipc[data-swapped] .ui-ipc__info{animation: ui-ipc-in var(--nm-dur-4, 380ms) var(--ui-ipc-ease)}
@keyframes ui-ipc-in{from{opacity: 0;transform: translateY(4px)}
to{opacity: 1;transform: none}
}
.ui-ipc__title{display: flex;align-items: flex-start;justify-content: space-between;gap: 12px}
.ui-ipc__title > div{display: grid;min-width: 0}
.ui-ipc__title h3{margin: 0;overflow: hidden;font-size: 15px;font-weight: 500;line-height: 24px;color: var(--ui-ipc-strong);white-space: nowrap;text-overflow: ellipsis}
.ui-ipc__domain{display: flex;align-items: center;gap: 6px;min-width: 0;font-size: 12px;line-height: 16px;color: var(--ui-ipc-muted)}
.ui-ipc__state{padding: 0 5px;border-radius: 5px;background: var(--ui-ipc-ok-fill);font-size: 11px;font-weight: 500;line-height: 16px;color: var(--ui-ipc-ok);animation: ui-ipc-in var(--nm-dur-3, 240ms) var(--ui-ipc-ease)}
.ui-ipc__desc{margin: 8px 0 0;font-size: 13px;line-height: 20px;color: var(--ui-ipc-text)}
.ui-ipc__features{display: grid;gap: 2px;margin: 10px 0 0;padding: 0;list-style: none}
.ui-ipc__features li{display: flex;align-items: center;gap: 8px;min-width: 0;font-size: 13px;line-height: 20px;color: var(--ui-ipc-text)}
.ui-ipc__features svg{width: 16px;height: 16px;fill: none;stroke: var(--ui-ipc-icon);stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round}
.ui-ipc__switch{position: relative;flex: none;width: 32px;height: 18px;margin-top: 3px;border-radius: 6px;background: var(--ui-ipc-switch-off);transition: background-color var(--nm-dur-3, 240ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ipc__switch::after{content: "";position: absolute;top: 2px;left: 2px;width: 14px;height: 14px;border-radius: 4px;background: #fffdfb;box-shadow: 0 0 0 0.5px rgba(11, 9, 8, 0.06), 0 1px 2px rgba(11, 9, 8, 0.18);transition: transform var(--nm-dur-3, 240ms) var(--ui-ipc-ease)}
.ui-ipc__switch[aria-checked="true"]{background: var(--ui-ipc-accent)}
.ui-ipc__switch[aria-checked="true"]::after{transform: translateX(14px)}
.ui-ipc__explore{display: inline-flex;align-items: center;align-self: flex-start;gap: 4px;height: 28px;margin-top: auto;padding: 0 6px 0 10px;border-radius: 6px;background: var(--ui-ipc-card);box-shadow: var(--ui-ipc-shadow);font-size: 13px;font-weight: 500;line-height: 20px;color: var(--ui-ipc-strong);transition: background-color var(--nm-dur-2, 160ms) var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1))}
.ui-ipc__info > :nth-last-child(2){margin-bottom: 16px}
.ui-ipc__explore svg{width: 16px;height: 16px;fill: none;stroke: var(--ui-ipc-icon);stroke-width: 1.1;stroke-linecap: round;stroke-linejoin: round;transition: transform var(--nm-dur-2, 160ms) var(--ui-ipc-ease)}
.ui-ipc__explore:hover{background: linear-gradient(var(--ui-ipc-wash), var(--ui-ipc-wash)), var(--ui-ipc-card)}
.ui-ipc__explore:hover svg{transform: translateX(2px)}
.ui-ipc__foot{display: flex;align-items: center;justify-content: space-between;gap: 12px;height: 40px;padding: 0 12px;border-top: 0.5px solid var(--ui-ipc-line);font-size: 12px;line-height: 16px;color: var(--ui-ipc-muted)}
.ui-ipc__count{display: inline-flex;align-items: center;gap: 8px;min-width: 0;white-space: nowrap;font-variant-numeric: tabular-nums}
.ui-ipc__count i{width: 6px;height: 6px;border-radius: 2px;background: var(--ui-ipc-ok)}
.ui-ipc__hints{display: inline-flex;align-items: center;gap: 2px;white-space: nowrap}
.ui-ipc__hints span{margin: 0 8px 0 4px}
.ui-ipc__hints span:last-child{margin-right: 0}
@container (max-width: 560px){.ui-ipc__body{grid-template-columns: minmax(0, 1fr);height: auto}
.ui-ipc__list{max-height: 196px;border-right: 0;border-bottom: 0.5px solid var(--ui-ipc-line)}
.ui-ipc__art{height: 88px}
.ui-ipc__detail{overflow: visible}
.ui-ipc__info > :nth-last-child(2){margin-bottom: 14px}
.ui-ipc__hints{display: none}
}
@container (max-width: 400px){.ui-ipc__features{display: none}
.ui-ipc__kbd{display: none}
}
@media (hover: none) and (pointer: coarse){.ui-ipc__top{height: 52px}
.ui-ipc__back{width: 32px;height: 32px}
.ui-ipc__item{height: 48px}
.ui-ipc__explore{height: 32px}
}
@media (prefers-reduced-motion: reduce){.ui-ipc *, .ui-ipc *::before, .ui-ipc *::after{animation: none !important;transition: none !important}
}
:where(.dark, [data-theme="dark"]) .ui-ipc{--ui-ipc-card: #211b16;--ui-ipc-strong: #fffdfb;--ui-ipc-ink: rgba(255, 253, 251, 0.9);--ui-ipc-text: rgba(255, 253, 251, 0.62);--ui-ipc-muted: rgba(255, 253, 251, 0.46);--ui-ipc-faint: rgba(255, 253, 251, 0.3);--ui-ipc-icon: rgba(255, 253, 251, 0.5);--ui-ipc-line: rgba(255, 253, 251, 0.08);--ui-ipc-line-strong: rgba(255, 253, 251, 0.12);--ui-ipc-wash: rgba(255, 253, 251, 0.04);--ui-ipc-soft: rgba(255, 253, 251, 0.02);--ui-ipc-fill: rgba(255, 253, 251, 0.08);--ui-ipc-light: #2b231b;--ui-ipc-light-ring: rgba(255, 253, 251, 0.12);--ui-ipc-ink-tile: #f4ece4;--ui-ipc-ink-mark: #181310;--ui-ipc-app: #0b0908;--ui-ipc-app-ink: #fffdfb;--ui-ipc-app-ring: rgba(255, 253, 251, 0.14);--ui-ipc-tile-shadow: 0 1px 2px 0 rgba(11, 9, 8, 0.4), 0 10px 16px -8px rgba(11, 9, 8, 0.6);--ui-ipc-ring: rgba(255, 253, 251, 0.07);--ui-ipc-accent: #ff8a5c;--ui-ipc-focus: rgba(255, 138, 92, 0.5);--ui-ipc-switch-off: rgba(255, 253, 251, 0.14);--ui-ipc-ok: #2f8d5c;--ui-ipc-ok-fill: rgba(47, 141, 92, 0.14);--ui-ipc-shadow: 0 0 0 0.5px rgba(255, 253, 251, 0.1), 0 1px 2px 0 rgba(11, 9, 8, 0.4)}

`;
