# chatrigo.id: what the site needs, and what we added

A surface audit of `https://www.chatrigo.id/`, mapped onto this library. The question was which
components a landing site of this kind needs, whether any of them already existed here, and what
was missing. Answer: **24 new items, 0 duplicates, 0 changes to the 157 that were already here.**

The site is Indonesian, for a WhatsApp-and-Instagram AI customer-service product. It is an Astro
build with Tailwind v4, Poppins, and a coral accent (`#e14d2a`) on white, laid out on a
`max-w-6xl` column with `3` / `6` / `12` responsive padding steps.

## Routes

| Route | What it is |
| --- | --- |
| `/` | the product landing page: hero, a full app shot, one chat card, four feature cards, a chip switcher beside a phone, four pricing tiers, a three-column comparison, a closing band, nine FAQ entries, footer |
| `/chatrigo-build-website-service` | the services landing page: hero, a two-row work marquee, three service rows, a numbered commercial argument, a four-step process, a three-card services pricing block, an ecosystem section, its own closing band |
| `/privacy`, `/terms`, `/dpa`, `/subprocessors` | the same legal layout four times: a document header, a chip row to switch documents, a sticky contents list, numbered prose sections |
| `/en/*` | the English mirror of all of the above |

Everything below was read off the running page at 1440x1000, plus `/privacy` for the legal layout.

## The 24, and the surface each one answers

Sixteen are `components`, eight are `blocks`. All are `Core`, all carry `url: ""`.

### Site chrome

| Item | Answers |
| --- | --- |
| `site-header` | the 72px sticky header: brand, absolutely-centred nav, one dropdown group, login, a gradient CTA at 40px, a 44px hamburger, and the drawer. On `/privacy` the scrolled state is `bg-white/90` with `backdrop-blur-xl`, which is what the `data-scrolled` flag feeds |
| `site-footer` | the 89px footer: brand mark, ten links wrapping at `gap-x-5 gap-y-2`, copyright |
| `announcement-pill` | "BARU · Mulai gratis dengan Chatrigo", 29px tall, the label chip at `0.62rem` bold with wide tracking |

### Section furniture

| Item | Answers |
| --- | --- |
| `section-intro` | the eyebrow + heading + lead stack. It appears **four times** on the home page alone, which is why it is an item and not a repeated fragment |
| `hero-band` | the opening band, including the glyph that sits inside the `h1` at `0.92em` |
| `feature-grid` | the 2x2 card grid at 568x464 per card, each with a heading, copy capped at 36 characters, and a visual |
| `use-case-switcher` | the eight chips that swap a headline, a body and a CTA beside a phone |
| `cta-band` | the closing band, including the mark behind the content at `opacity 0.06` |
| `faq-accordion` | nine entries, 70px collapsed and 255px open, one open at a time |
| `highlight-band` | "Chatrigo Micro Included", one line on a solid ground |
| `process-steps` | the four delivery steps joined by a connector, with a ring dot at the end |
| `numbered-points` | the commercial argument beside three rows with square two-digit badges |

### Conversion

| Item | Answers |
| --- | --- |
| `pricing-tiers` | **both** pricing blocks. The home page has four tiers with a pill ribbon, a discount chip and per-feature help; the services page has three cards with a rectangular tab ribbon, subtitles, a "Custom Pricing" plan with no period, a footnote and 64px buttons. One block carries both configurations |
| `comparison-matrix` | the six-row, three-column comparison, with the Chatrigo column raised |

### Product shots

| Item | Answers |
| --- | --- |
| `cs-inbox` | the full product shot: a 320px conversation list with a search field, two segment rows and a count, beside a thread with an `AI Aktif` mark and a takeover bar |
| `channel-inbox` | the compact three-row preview used as a feature card visual |
| `mock-thread` | the chat bubble stack, including the typing row, the handoff note pill and the cited-source block |
| `stock-card` | the catalogue entry an answer was drawn from, with stock meta and the quoted reply |
| `phone-mock` | the device used beside the use-case switcher |
| `chat-window` | the in-app window chrome with traffic dots, a title and a status slot |
| `browser-frame` | the browser chrome with an address bar over a fixed 16 by 10 viewport |
| `service-row` | a service explained full width, alternating its shot side |
| `portfolio-marquee` | the two counter-scrolling rows of work previews |

## Why none of them is a duplicate

This was the harder half of the audit: the library already had 157 items, and several of the new
ones look, at a glance, like something that was already there. Each pair was read side by side.

| Looks like | Actually | Verdict |
| --- | --- | --- |
| `site-header` vs `app-shell` | `app-shell` is the product's own shell with a sidebar, for use *inside* an app. This is marketing chrome: nav, one dropdown, a login link, a drawer | new |
| `pricing-tiers` vs `pricing-plans` | `pricing-plans` is a Pro reconstruction and cannot be edited. It has three flat cards and one switch. The two chatrigo blocks need four tiers, two ribbon shapes, per-feature help, per-card subtitles and footnotes, a plan with no period, and a section footnote | new, and it covers both pages rather than adding a third pricing item |
| `comparison-matrix` vs `data-table` | `data-table` is an editable spreadsheet: cell and range selection, in-place edit, copy, paste, undo, sort. This is read-only, three fixed competitor columns, one raised, with a labelled value under each feature name | new |
| `cs-inbox` vs `agent-inbox` | `agent-inbox` lists agent **tasks** with live clocks and cost. This lists customer **conversations** with channel, unread and routing, beside the open thread, and its action is takeover | new |
| `channel-inbox` vs `cs-inbox` | the full app shot with three panes and state, versus a 360px titled window whose only job is three conversations on three channels | new, both kept, boundary documented |
| `mock-thread` vs `group-chat` / `agent-chat` | those are working chat surfaces with a composer a person types into. This is a static visual with a source note and a handoff pill | new |
| `chat-window` vs `browser-frame` | an in-app window with a title and a status, versus browser chrome with an address bar over a 16:10 viewport | new, both kept, neither may take the other's slot |
| `feature-grid` vs `tips-panel` / `agent-gallery` | `tips-panel` is short actionable tips; `agent-gallery` is gradient panels that glide open. This is a plain 2x2 of heading + copy + visual | new |
| `faq-accordion` vs `setup-guide` / `stepper-form` | those track completion of tasks. This is read-only Q and A with one panel open | new |
| `portfolio-marquee` vs `logo-marquee` / `testimonial-wall` | `logo-marquee` is one row of logos with inertia scrub; `testimonial-wall` is vertical quote columns. This is two horizontal rows in opposite directions of wide project previews | new |
| `process-steps` vs `numbered-points` | the delivery process, with circles, connectors and a trailing ring; versus a commercial argument, with square badges and a side heading | new, both kept |
| `service-row` vs `feature-grid` | a full-width alternating row with a chip, a capability tag row and a 48px CTA, versus a grid of small cards | new |

## Not built, and why

| Surface | Why not |
| --- | --- |
| a logo strip | the site has none |
| testimonials | the site has none |
| a cookie banner | the only fixed or sticky element on either page is the header |
| a chat launcher button | the site sends people to `wa.me` with a plain link, not a floating widget |
| the nine site screenshots and the ecosystem figure | those are photographs of other websites. A component library ships structure, not other people's screenshots, so the frames take a slot and the demos fill it with drawn skeletons |
| `/en/*` | the same components with different strings. Nothing new to build |

## Theme

The components are **NamurUI Ember**, not chatrigo's palette. The site's coral on white is its
brand, not ours. What we took is the surface inventory and the anatomy of each surface: the
information each one carries, its proportions, and the interaction it needs. Colour, radii,
typography and timing all come from `DESIGN.md` and `src/styles/motion.css`, with every
`var(--nm-*)` reference carrying its literal fallback so a component still animates correctly in a
host page that never loads the token sheet.

Two chatrigo behaviours were deliberately not carried over. The site staggers every section with
its own bespoke `cubic-bezier(0.2, 0.7, 0.2, 1)` and a `--motion-delay` variable per element; we
use the `--nm-ease-*` set and `--nm-stagger` so a whole page composed from these items keeps one
tempo. And the site's card entrances replay on every scroll into view; ours run once, because a
second entrance on the way back up reads as a bug.
## Result

All 24 were built, registered and verified on the tree.

| Check | Result |
| --- | --- |
| `tsc --noEmit` | 0 errors |
| `vite build` | green, 374.04 kB entry / 103.80 kB gzip |
| Routes that mount | **181 of 181**, 0 empty, 0 threw, 0 missing, 0 horizontal overflow |
| Console errors across the sweep | 0 |
| Cross-component class collisions introduced | 0 (every new root class was checked against the 279 `ui-*` tokens already on disk) |
| Exported names declared twice | 0 (all 42 new type names were checked against the 874 exports already on disk) |
| `var(--nm-*)` without a literal fallback | 0 |
| New component source | 10,435 lines across 24 files |
| New demo source | 4,154 lines across 24 demos |
| Contrast, default theme, after this batch | light 1,287 failing pairs across 82 of 181 routes; dark 977 across 69 |
| Contrast with `data-contrast="high"` | light 740 (42.5% fewer); dark 425 (56.5% fewer) |
| Routes the audit cannot measure | 21 of 181, one of them new: `process-steps` paints no ground of its own, so its text sits on the gallery's preview gradient |

The 24 routes added 524 measurable text pairs and **9 light plus 5 dark failures**. Those 14 were
fixed in the components rather than in the opt-in layer: a chip or badge ink sitting on a
translucent wash of its own colour needs a darker value in light and a lighter one in dark, so
`stock-card`, `cs-inbox` and `comparison-matrix` each declare their own ink, and two demos that drew
white text on the accent ground now read `--accent-fg`. After the fixes the library-wide totals are
unchanged from before the batch, and the generated opt-in sheet is byte-identical: light 42
components and 73 tokens, dark 46 and 106.

### Interaction, verified live

| Item | What was driven | Observed |
| --- | --- | --- |
| `site-header` | scroll the demo frame | `data-scrolled` flips and the bar takes a solid ground |
| `faq-accordion` | open the third entry | the first closes, 1 open, `aria-expanded` follows |
| `use-case-switcher` | pick chip 4 | `aria-selected` moves 0 to 3, the panel text changes, the preview is not re-mounted |
| `cs-inbox` | switch the first segment to Selesai | 13 rows become 2, the count reads 2 of 15 |
| `cs-inbox` | press Takeover | the head mark goes from `AI Aktif` to `Ditangani Anda` and the AI tags drop to 0 |
| `comparison-matrix` | click a help glyph | the tooltip opens at full opacity with its text |
| `pricing-tiers` | switch to yearly | the amounts change, the `-16.7%` chip appears and the change is announced |
| `portfolio-marquee` | watch the track | two rows, one `normal` and one `reverse`, both running, both moved 55px in 900ms |
| `legal-page` | read the contents list | 11 sections, 11 entries, one `aria-current`, the header band pad is 56px / 64px |
| `process-steps` | read the rail | 4 steps, 2 reached and 2 ahead, the connector measures 772px |
| `mock-thread` | watch the cycle | 3 rows, then 4, then the citation, then the note, then reset |

### What this leaves open

`pricing-tiers` carries both pricing blocks, so the library has one pricing item and not two. If a
host needs a third pricing shape, extend that block rather than adding a fourth item: the boundary
between `pricing-plans` and `pricing-tiers` is already thin and a third would make it meaningless.

`process-steps` is unmeasurable by the contrast audit for the same reason the other 20 are: it
paints no ground, so its ink sits on whatever the host page provides. Its tokens come from the
shared palette, so it introduces no new pair, but a host that drops it on a coloured ground is
responsible for that ground's contrast.

## The visual pass

The 24 were built and verified for structure, contrast and behaviour, then looked at as
pictures. One agent took each component, rendered it in both themes at 1440 and 320, and judged
it against the Ember identity. Every one of them changed something, and the ones that had looked
merely correct on paper were the worst offenders.

What the pass found, in the order it hurt:

| Component | What was wrong |
| --- | --- |
| `portfolio-marquee` | the work previews were drawn with **14 hardcoded literals** from the source site's palette. Two full rows of cream cards in a dark identity |
| `cta-band` | the watermark was 544x497 inside a 445px band and its shape was a stroked outline, so it read as a broken box across the whole band |
| `chat-window` | the frame's fill was **darker** than the surface behind it, so it read as a hole, and its hairline measured 1.1:1 against its own fill |
| `channel-inbox` | the same sink, at 1.05:1 below the page |
| `cs-inbox` | the incoming bubble was darker than the log it sat in, and the takeover bar read as a slab bolted to the bottom |
| `process-steps` | the connector was 1px of `--border` on `--bg`, effectively invisible, and the entry animation's `translateY` was being measured into the line geometry |
| `comparison-matrix` | at 320px the table blew out to 832px, and the row separators were 1.06:1 |
| `feature-grid` | two of the four visuals filled 78 and 87px of a 184px slot, so half of them floated in dead space |
| `pricing-tiers` | the demo's config bar was the least finished thing on the page: white pills, invisible dark-on-dark pills, a band behind half the row |
| `mock-thread` | the assistant was named twice per outgoing row, once as a cramped two-letter avatar and once as a tag |
| `site-header` | the scrolled ground was exactly the page tone, so content passed under the bar with only a hairline splitting them |
| `site-footer` | the grouped variant laid out three columns as a grid with a phantom fourth track, and the flat row stranded its last link beside the copyright |
| `announcement-pill` | the demo's link pointed at `#changelog`, which navigated out of the gallery to a blank page |
| `use-case-switcher` | chips carried a literal bullet as their marker, and the preview was a 250px card in a 470px column |
| `phone-mock` | the frame overflowed to 319px inside a 230px column at 320px, and a scrollbar painted inside the 296px screen |
| `browser-frame` | the skeleton filled about 45% of its viewport, and a 560px frame overflowed a 320px viewport |
| `faq-accordion` | row dividers at 1.27:1, and an `scrollHeight` rounded down that shaved the last line of an open answer |
| `legal-page` | the active contents marker was an inset box-shadow on a 12px-rounded row, so the ember stroke curled into a bracket |
| `hero-band` | the headline overflowed its box at 320px, and the demo's pill grew past its own rounded panel |
| `stock-card` | a 26px dead band under a clamped quote, and two labels under the 11px floor |
| `service-row` | three shots that looked like three different experiments rather than three pages of one product |
| `numbered-points` | the badge was 52x44 with uneven padding, and its dark ink sat a step light |
| `section-intro` | the demo's chrome spanned 1054px beside a 620px section, and the eyebrow was 10.88px |
| `highlight-band` | the demo stacked three solid grounds at once, so three statuses appeared live at the same time |

Two cross-cutting defects ran through most of the set, and both are now fixed everywhere: text
under 11px carrying meaning (10px previews, 9px chips, 9.92px eyebrows, 9.6px badges), and demo
chrome that competed with its own component for the single ember accent.

The pass changed no class name, prop name, exported type or token name. Afterwards: 24 of 24 pass
the house-contract scan, `tsc` is clean, the build is green, 181 of 181 routes mount, and the 24
routes measure **0 failing contrast pairs in both themes** across 537 dark and 572 light pairs,
so the library-wide figures above are unchanged.
