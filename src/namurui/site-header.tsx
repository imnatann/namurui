"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type ReactNode,
} from "react";

/*
 * Site Header: the sticky bar a marketing page wears above its content: a brand slot, centre
 * links with one dropdown group, a quiet login link, a gradient call to action and a 44px menu
 * button. A passive scroll listener flips a data-scrolled flag, so the bar stays transparent over
 * the hero and gains a solid ground the moment content passes under it. The group closes on
 * Escape, on an outside pointerdown and when focus leaves it; the drawer locks body scroll and
 * closes on Escape or a backdrop tap. Styles are injected below, so no extra files are needed.
 */

export type HeaderNavItem = {
  /** Link text */
  label: string;
  /** Destination */
  href: string;
  /** Stable identity; falls back to the href and the index */
  key?: string;
};

export type HeaderNavGroup = {
  /** Button label, e.g. "Solutions" */
  label: string;
  /** Panel entries */
  items: readonly HeaderNavItem[];
};

export type SiteHeaderProps = {
  /** Brand slot, usually an anchor around a mark and wordmark; a Namur mark is drawn when omitted */
  brand?: ReactNode;
  /** Plain links: the first leads, the rest trail the groups */
  links: readonly HeaderNavItem[];
  /** Dropdown groups, drawn between the leading link and the rest */
  groups?: readonly HeaderNavGroup[];
  /** Quiet link at the right of the bar */
  login?: { label: string; href: string };
  /** Gradient call to action at the right of the bar */
  cta?: { label: string; href: string };
  /** Called with the item a visitor activated, before the href navigates */
  onNavigate?: (item: HeaderNavItem) => void;
  /** Extra class on the root */
  className?: string;
};

/* A stable empty array, so an omitted `groups` does not read as a new payload on every render */
const NO_GROUPS: readonly HeaderNavGroup[] = [];

const identity = (item: HeaderNavItem, index: number) => item.key ?? `${item.href}#${index}`;

export function SiteHeader({
  brand,
  links,
  groups = NO_GROUPS,
  login,
  cta,
  onNavigate,
  className,
}: SiteHeaderProps) {
  const uid = useId();
  const root = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const groupNodes = useRef<Array<HTMLDivElement | null>>([]);
  const groupButtons = useRef<Array<HTMLButtonElement | null>>([]);

  const [scrolled, setScrolled] = useState(false);
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [drawer, setDrawer] = useState(false);

  const drawerId = `${uid}-drawer`;
  const panelId = (index: number) => `${uid}-panel-${index}`;

  /* The ground is earned by the distance the bar's own scroll container has travelled, not by the
   * viewport: a page scrolls the document and a preview scrolls a box. Scroll events do not bubble,
   * so the listener runs in the capture phase, where it reaches both. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = root.current;
    if (!node) return;

    const scrollerOf = (start: HTMLElement): HTMLElement | null => {
      let parent = start.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const { overflowY } = window.getComputedStyle(parent);
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return parent;
        parent = parent.parentElement;
      }
      return null;
    };

    const scroller = scrollerOf(node);
    const read = () => {
      const travelled = scroller ? scroller.scrollTop : window.scrollY;
      setScrolled(travelled > 4);
    };
    read();
    window.addEventListener("scroll", read, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", read, true);
  }, []);

  /* One Escape closes whichever surface is open and hands focus back to the button that opened it,
   * so a keyboard never lands on nothing. */
  useEffect(() => {
    if (openGroup === null && !drawer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openGroup !== null) {
        event.preventDefault();
        setOpenGroup(null);
        groupButtons.current[openGroup]?.focus();
      }
      if (drawer) {
        event.preventDefault();
        setDrawer(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openGroup, drawer]);

  /* A pointerdown anywhere outside the open group closes its panel, which is what a visitor
   * expects when they reach for the rest of the page. */
  useEffect(() => {
    if (openGroup === null) return;
    const onDown = (event: PointerEvent) => {
      const node = groupNodes.current[openGroup];
      if (node && event.target instanceof Node && node.contains(event.target)) return;
      setOpenGroup(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openGroup]);

  /* The drawer is a full-height surface over the page, so the page behind it holds still while it
   * is open. The previous value is restored, not blanked, in case a host owns that property. */
  useEffect(() => {
    if (!drawer || typeof document === "undefined") return;
    const { body } = document;
    const before = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = before;
    };
  }, [drawer]);

  /* Focus leaving the group closes its panel: a keyboard that tabs out of the group should not
   * leave a menu open behind it. */
  const onGroupBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (openGroup === null) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setOpenGroup(null);
  };

  const follow = (item: HeaderNavItem) => {
    setDrawer(false);
    setOpenGroup(null);
    onNavigate?.(item);
  };

  const closeAll = () => {
    setDrawer(false);
    setOpenGroup(null);
  };

  const lead = links[0];
  const rest = links.slice(1);

  return (
    <header
      ref={root}
      className={["ui-shd", className].filter(Boolean).join(" ")}
      data-scrolled={scrolled ? "true" : undefined}
      data-drawer={drawer ? "open" : undefined}
    >
      {/* React 19 hoists this into <head> once, no matter how many render */}
      <style href="ui-site-header" precedence="default">
        {css}
      </style>

      {/* The tap target that closes the drawer: the whole page below the bar */}
      <div className="ui-shd__scrim" aria-hidden="true" onClick={() => setDrawer(false)} />

      <div className="ui-shd__drawer" id={drawerId} data-open={drawer ? "true" : undefined}>
        <nav className="ui-shd__drawer-nav" aria-label="Menu">
          {lead ? (
            <a className="ui-shd__drawer-link" href={lead.href} onClick={() => follow(lead)}>
              {lead.label}
            </a>
          ) : null}

          {groups.map((group, index) => (
            <div className="ui-shd__drawer-group" key={`${group.label}#${index}`}>
              <p className="ui-shd__drawer-label">{group.label}</p>
              {group.items.map((item, itemIndex) => (
                <a
                  key={identity(item, itemIndex)}
                  className="ui-shd__drawer-link"
                  href={item.href}
                  onClick={() => follow(item)}
                >
                  {item.label}
                </a>
              ))}
            </div>
          ))}

          {rest.map((item, index) => (
            <a
              key={identity(item, index)}
              className="ui-shd__drawer-link"
              href={item.href}
              onClick={() => follow(item)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {cta ? (
          <a className="ui-shd__cta ui-shd__cta--wide" href={cta.href} onClick={closeAll}>
            {cta.label}
          </a>
        ) : null}
        {login ? (
          <a className="ui-shd__drawer-login" href={login.href} onClick={closeAll}>
            {login.label}
          </a>
        ) : null}
      </div>

      <div className="ui-shd__bar">
        <div className="ui-shd__brand">{brand ?? <DefaultBrand />}</div>

        <nav className="ui-shd__nav" aria-label="Primary">
          {lead ? (
            <a className="ui-shd__link" href={lead.href} onClick={() => follow(lead)}>
              {lead.label}
            </a>
          ) : null}

          {groups.map((group, index) => {
            const open = openGroup === index;
            return (
              <div
                key={`${group.label}#${index}`}
                className="ui-shd__group"
                data-open={open ? "true" : undefined}
                ref={(node) => {
                  groupNodes.current[index] = node;
                }}
                onBlur={onGroupBlur}
              >
                <button
                  type="button"
                  className="ui-shd__group-button"
                  aria-expanded={open}
                  aria-controls={panelId(index)}
                  ref={(node) => {
                    groupButtons.current[index] = node;
                  }}
                  onClick={() => {
                    setDrawer(false);
                    setOpenGroup((current) => (current === index ? null : index));
                  }}
                >
                  {group.label}
                  <svg
                    className="ui-shd__chevron"
                    viewBox="0 0 12 12"
                    width="12"
                    height="12"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M2.75 4.5 6 7.75 9.25 4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <div className="ui-shd__panel" id={panelId(index)} data-open={open ? "true" : undefined}>
                  {group.items.map((item, itemIndex) => (
                    <a
                      key={identity(item, itemIndex)}
                      className="ui-shd__panel-link"
                      href={item.href}
                      onClick={() => follow(item)}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}

          {rest.map((item, index) => (
            <a
              key={identity(item, index)}
              className="ui-shd__link"
              href={item.href}
              onClick={() => follow(item)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ui-shd__right">
          {login ? (
            <a className="ui-shd__login" href={login.href} onClick={closeAll}>
              {login.label}
            </a>
          ) : null}
          {cta ? (
            <a className="ui-shd__cta" href={cta.href} onClick={closeAll}>
              {cta.label}
            </a>
          ) : null}
        </div>

        <button
          type="button"
          ref={menuButton}
          className="ui-shd__menu"
          aria-expanded={drawer}
          aria-controls={drawerId}
          aria-label={drawer ? "Close menu" : "Open menu"}
          onClick={() => {
            setOpenGroup(null);
            setDrawer((current) => !current);
          }}
        >
          <span className="ui-shd__menu-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>
    </header>
  );
}

/* The bar a host gets when it does not pass a brand: the Namur mark and wordmark, at the 28px
 * mark height the reference header measures. */
function DefaultBrand() {
  return (
    <span className="ui-shd__default">
      <span className="ui-shd__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" focusable="false">
          <path
            d="M5 5.25h14A1.75 1.75 0 0 1 20.75 7v7.5A1.75 1.75 0 0 1 19 16.25h-6.4L8 19.5v-3.25H5a1.75 1.75 0 0 1-1.75-1.75V7A1.75 1.75 0 0 1 5 5.25Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M8 9.5h8M8 12.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="ui-shd__wordmark">Namur</span>
    </span>
  );
}

const css = /* css */ `
.ui-shd {
  /* Knobs. Override any of these on .ui-shd to retheme the bar in a host. */
  --ui-shd-ink: var(--text, #1a1410);
  /* 65 percent of the foreground ink: the resting weight of a nav link */
  --ui-shd-ink-soft: rgba(26, 20, 16, 0.65);
  --ui-shd-ink-login: rgba(26, 20, 16, 0.72);
  /* The scrolled ground is one step above the page, so the bar reads as a surface over content
   * instead of vanishing into a page of the same tone */
  --ui-shd-ground: var(--panel, #fffdfb);
  --ui-shd-panel: var(--panel, #fffdfb);
  --ui-shd-line: var(--border, #e8e0d7);
  --ui-shd-hover: var(--hover-bg, #7a4a1c12);
  --ui-shd-cta-from: var(--accent, #c2410c);
  --ui-shd-cta-to: var(--accent-hover, #9a3412);
  --ui-shd-cta-ink: var(--accent-fg, #fffdfb);
  --ui-shd-scrim: rgba(20, 16, 13, 0.42);
  --ui-shd-lift: #3d1f0a26;
  --ui-shd-focus: var(--accent, #c2410c);
  /* The measured bar height: 4.5rem, and the drawer's ceiling is measured from it */
  --ui-shd-bar: 72px;
  --ui-shd-dur-fast: var(--nm-dur-2, 160ms);
  --ui-shd-dur: var(--nm-dur-3, 240ms);
  --ui-shd-dur-surface: var(--nm-dur-4, 380ms);
  --ui-shd-ease-out: var(--nm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  --ui-shd-ease-in: var(--nm-ease-in, cubic-bezier(0.55, 0, 0.68, 0.19));
  --ui-shd-ease-both: var(--nm-ease-both, cubic-bezier(0.65, 0, 0.35, 1));

  position: sticky;
  top: 0;
  z-index: 50;
  box-sizing: border-box;
  width: 100%;
  background-color: transparent;
  color: var(--ui-shd-ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 20px;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
  transition:
    background-color var(--ui-shd-dur-surface) var(--ui-shd-ease-both),
    box-shadow var(--ui-shd-dur-surface) var(--ui-shd-ease-both);
}
.ui-shd *,
.ui-shd *::before,
.ui-shd *::after {
  box-sizing: border-box;
}
.ui-shd a {
  text-decoration: none;
}
.ui-shd p {
  margin: 0;
}

/* Content is under the bar: it needs a ground of its own to stay legible. The drawer's scrim also
 * lies under the bar, so an open drawer earns the ground too, or the brand would be dimmed. */
.ui-shd[data-scrolled="true"],
.ui-shd[data-drawer="open"] {
  background-color: var(--ui-shd-ground);
  box-shadow:
    inset 0 -1px 0 var(--ui-shd-line),
    0 16px 30px -22px var(--ui-shd-lift);
}

/* The bar ----------------------------------------------------------------- */
.ui-shd__bar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  max-width: 72rem;
  height: var(--ui-shd-bar);
  margin: 0 auto;
  padding: 0 24px;
}

/* Brand ------------------------------------------------------------------- */
.ui-shd__brand {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 32px;
}
.ui-shd__brand > a,
.ui-shd__default {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: inherit;
}
.ui-shd__mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background-image: linear-gradient(160deg, var(--ui-shd-cta-from), var(--ui-shd-cta-to));
  color: var(--ui-shd-cta-ink);
  box-shadow: inset 0 1px 0 #ffffff33;
}
.ui-shd__wordmark {
  overflow: hidden;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Centre links: absolutely centred at left 1/2, whatever the brand or the right cluster measures */
.ui-shd__nav {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 6px;
  transform: translate(-50%, -50%);
}
.ui-shd__link,
.ui-shd__group-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 34px;
  margin: 0;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-control, 8px);
  background: none;
  color: var(--ui-shd-ink-soft);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.01em;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--ui-shd-dur-fast) var(--ui-shd-ease-out);
}
.ui-shd__link:hover,
.ui-shd__group-button:hover,
.ui-shd__group[data-open="true"] .ui-shd__group-button {
  color: var(--ui-shd-ink);
}
.ui-shd__link:focus-visible,
.ui-shd__group-button:focus-visible,
.ui-shd__panel-link:focus-visible,
.ui-shd__login:focus-visible,
.ui-shd__cta:focus-visible,
.ui-shd__menu:focus-visible,
.ui-shd__drawer-link:focus-visible,
.ui-shd__drawer-login:focus-visible {
  outline: 2px solid var(--ui-shd-focus);
  outline-offset: 2px;
}

/* One dropdown group ------------------------------------------------------ */
.ui-shd__group {
  position: relative;
  display: flex;
  align-items: center;
}
.ui-shd__chevron {
  flex: none;
  opacity: 0.7;
  transition: transform var(--ui-shd-dur) var(--ui-shd-ease-both);
}
.ui-shd__group[data-open="true"] .ui-shd__chevron {
  transform: rotate(180deg);
}
.ui-shd__panel {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  z-index: 4;
  display: grid;
  gap: 2px;
  min-width: 224px;
  padding: 6px;
  border-radius: var(--radius-preview, 12px);
  background: var(--ui-shd-panel);
  box-shadow:
    inset 0 0 0 1px var(--ui-shd-line),
    0 20px 36px -24px var(--ui-shd-lift);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translate(-50%, -6px);
  transform-origin: 50% 0;
  transition:
    opacity var(--ui-shd-dur-fast) var(--ui-shd-ease-in),
    transform var(--ui-shd-dur-fast) var(--ui-shd-ease-in),
    visibility 0s var(--ui-shd-dur-fast);
}
.ui-shd__panel[data-open="true"] {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translate(-50%, 0);
  transition:
    opacity var(--ui-shd-dur) var(--ui-shd-ease-out),
    transform var(--ui-shd-dur) var(--ui-shd-ease-out),
    visibility 0s;
}
.ui-shd__panel-link {
  display: block;
  padding: 9px 10px;
  border-radius: var(--radius-control, 8px);
  color: var(--ui-shd-ink-soft);
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  transition:
    color var(--ui-shd-dur-fast) var(--ui-shd-ease-out),
    background-color var(--ui-shd-dur-fast) var(--ui-shd-ease-out);
}
.ui-shd__panel-link:hover {
  background: var(--ui-shd-hover);
  color: var(--ui-shd-ink);
}

/* Right cluster ----------------------------------------------------------- */
.ui-shd__right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ui-shd__login {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-control, 8px);
  color: var(--ui-shd-ink-login);
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  transition: color var(--ui-shd-dur-fast) var(--ui-shd-ease-out);
}
.ui-shd__login:hover {
  color: var(--ui-shd-ink);
}
.ui-shd__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 18px;
  border-radius: var(--radius-preview, 12px);
  background-image: linear-gradient(180deg, var(--ui-shd-cta-from), var(--ui-shd-cta-to));
  color: var(--ui-shd-cta-ink);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
  white-space: nowrap;
  box-shadow:
    inset 0 1px 0 #ffffff33,
    0 10px 18px -14px var(--ui-shd-cta-from);
  transition:
    transform var(--nm-dur-1, 90ms) var(--ui-shd-ease-out),
    box-shadow var(--ui-shd-dur-fast) var(--ui-shd-ease-out);
}
.ui-shd__cta:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 #ffffff40,
    0 14px 22px -14px var(--ui-shd-cta-from);
}
.ui-shd__cta:active {
  transform: translateY(0);
}

/* The 44px menu button ---------------------------------------------------- */
.ui-shd__menu {
  position: relative;
  display: none;
  flex: none;
  width: 44px;
  height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--ui-shd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--ui-shd-dur-fast) var(--ui-shd-ease-out);
}
.ui-shd__menu:hover {
  background: var(--ui-shd-hover);
}
.ui-shd__menu-lines {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 18px;
  height: 13px;
  transform: translate(-50%, -50%);
}
.ui-shd__menu-lines span {
  position: absolute;
  left: 0;
  width: 18px;
  height: 1.5px;
  border-radius: 2px;
  background: currentColor;
  transition:
    transform var(--ui-shd-dur) var(--ui-shd-ease-both),
    opacity var(--ui-shd-dur-fast) var(--ui-shd-ease-out);
}
.ui-shd__menu-lines span:nth-child(1) {
  top: 0;
}
.ui-shd__menu-lines span:nth-child(2) {
  top: 5.75px;
}
.ui-shd__menu-lines span:nth-child(3) {
  top: 11.5px;
}
.ui-shd__menu[aria-expanded="true"] .ui-shd__menu-lines span:nth-child(1) {
  transform: translateY(5.75px) rotate(45deg);
}
.ui-shd__menu[aria-expanded="true"] .ui-shd__menu-lines span:nth-child(2) {
  opacity: 0;
}
.ui-shd__menu[aria-expanded="true"] .ui-shd__menu-lines span:nth-child(3) {
  transform: translateY(-5.75px) rotate(-45deg);
}

/* The drawer and the tap target behind it --------------------------------- */
/* The tap target that closes the drawer: the whole page below the bar, never the bar itself, so
 * the brand and the close button stay at full contrast while the page dims behind them. */
.ui-shd__scrim {
  position: fixed;
  inset: var(--ui-shd-bar) 0 0;
  z-index: 1;
  background: var(--ui-shd-scrim);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity var(--ui-shd-dur) var(--ui-shd-ease-in),
    visibility 0s var(--ui-shd-dur);
}
.ui-shd[data-drawer="open"] .ui-shd__scrim {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition:
    opacity var(--ui-shd-dur) var(--ui-shd-ease-out),
    visibility 0s;
}
.ui-shd__drawer {
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - var(--ui-shd-bar));
  padding: 4px 0 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--ui-shd-panel);
  box-shadow:
    inset 0 1px 0 var(--ui-shd-line),
    0 24px 40px -30px var(--ui-shd-lift);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-10px);
  transition:
    opacity var(--ui-shd-dur) var(--ui-shd-ease-in),
    transform var(--ui-shd-dur) var(--ui-shd-ease-in),
    visibility 0s var(--ui-shd-dur);
}
.ui-shd__drawer[data-open="true"] {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: none;
  transition:
    opacity var(--ui-shd-dur) var(--ui-shd-ease-out),
    transform var(--ui-shd-dur) var(--ui-shd-ease-out),
    visibility 0s;
}
.ui-shd__drawer-nav {
  display: flex;
  flex-direction: column;
}
.ui-shd__drawer-link {
  display: block;
  padding: 12px 40px;
  color: var(--ui-shd-ink);
  font-size: 0.95rem;
  font-weight: 500;
  transition: background-color var(--ui-shd-dur-fast) var(--ui-shd-ease-out);
}
.ui-shd__drawer-link:hover {
  background: var(--ui-shd-hover);
}
.ui-shd__drawer-group {
  display: flex;
  flex-direction: column;
}
.ui-shd__drawer-label {
  padding: 18px 40px 4px;
  color: var(--ui-shd-ink-soft);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.ui-shd__drawer-group .ui-shd__drawer-link {
  padding-left: 52px;
}
.ui-shd__cta--wide {
  height: 44px;
  margin: 16px 40px 0;
}
.ui-shd__drawer-login {
  margin: 4px 40px 0;
  padding: 12px 0;
  color: var(--ui-shd-ink-soft);
  font-size: 0.85rem;
  font-weight: 500;
  text-align: center;
  transition: color var(--ui-shd-dur-fast) var(--ui-shd-ease-out);
}
.ui-shd__drawer-login:hover {
  color: var(--ui-shd-ink);
}

/* Below xl the bar keeps the brand and the 44px button, and nothing else ----- */
@media (max-width: 1279px) {
  .ui-shd__nav,
  .ui-shd__right {
    display: none;
  }
  .ui-shd__menu {
    display: block;
  }
  .ui-shd__bar {
    padding: 0 16px;
  }
}

:where(.dark, [data-theme="dark"]) .ui-shd {
  --ui-shd-ink: var(--text, #f4ece4);
  --ui-shd-ink-soft: rgba(244, 236, 228, 0.65);
  --ui-shd-ink-login: rgba(244, 236, 228, 0.72);
  --ui-shd-ground: var(--panel-raised, #231d18);
  /* The panel floats one step above the bar's own ground, so an open menu reads as a surface even
   * when the bar has earned its ground behind it */
  --ui-shd-panel: var(--preview, #26201a);
  --ui-shd-line: var(--border, #33291f);
  --ui-shd-hover: var(--hover-bg, #ffffff0f);
  --ui-shd-cta-from: var(--accent, #ff6b35);
  --ui-shd-cta-to: var(--accent-hover, #ff8256);
  --ui-shd-cta-ink: var(--accent-fg, #1a0f08);
  --ui-shd-scrim: rgba(11, 9, 8, 0.6);
  --ui-shd-lift: #00000066;
  --ui-shd-focus: var(--accent, #ff6b35);
}

@media (prefers-reduced-motion: reduce) {
  .ui-shd,
  .ui-shd__link,
  .ui-shd__group-button,
  .ui-shd__chevron,
  .ui-shd__panel,
  .ui-shd__panel-link,
  .ui-shd__login,
  .ui-shd__cta,
  .ui-shd__menu,
  .ui-shd__menu-lines span,
  .ui-shd__scrim,
  .ui-shd__drawer,
  .ui-shd__drawer-link,
  .ui-shd__drawer-login {
    transition-duration: 1ms;
  }
  .ui-shd__cta:hover {
    transform: none;
  }
}
`;
