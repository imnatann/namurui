# Catalogue

All 181 items. `Tier` is `Free` for the original MIT sources, `Pro` for the
reimplementations, and `Core` for first-party NamurUI components that have no upstream
original.

Every prop table is generated from that component's exported props type, so it lists exactly
what the shipped component accepts.

Items are grouped by what they do in a product. `Kind` is the shape (component, screen,
block, illustration, motion), which is a separate axis and a separate filter in the gallery.

## Agents (43)

Planning, steering, reviewing and paying for agent work.

| Item | Kind | Tier | What it is |
| --- | --- | --- | --- |
| [Agent budget](#agent-budget) | Components | Core | A run's token budget as a segmented meter, with spend, remaining allowance and an overshoot projection |
| [Agent Chat](#agent-chat) | Screens | Pro | Chat with an orchestrating agent, the agents at work, and a brief to fill in beside it |
| [Agent Cursors](#agent-cursors) | Components | Pro | Agents working in a document like teammates in a multiplayer editor – live pointers with names, suggestions typed letter by letter, images they resize, code they fix and comments beside the page |
| [Agent diff](#agent-diff) | Components | Core | A code diff an agent produced, hunk by hunk, with per-hunk accept and reject |
| [Agent Graph](#agent-graph) | Components | Pro | Agents and the tools they call as a living network – a pulse along the link for every call and its answer, busy links growing thicker, agents that breathe while they work and turn amber when they need you |
| [Agent handoff](#agent-handoff) | Components | Core | Control passing from one agent to another, with the reason, the payload and an accept or decline decision |
| [Agent Inbox](#agent-inbox) | Components | Pro | All your background agent tasks in one calm list – live clocks and status tags, filter tabs with rolling counts, rows that unfold to the last steps with Approve, Reject, Retry or Open, and glide to their new place |
| [Agent Lanes](#agent-lanes) | Components | Pro | Where every agent is right now – a live timeline with a lane per agent, tasks growing into “now”, hand-offs drawn between agents and approvals right on the block |
| [Agent Ledger](#agent-ledger) | Components | Pro | Everything an agent changed in your systems, each change with an undo – before and after per row, and pointing at Undo shows what builds on it: what would be undone too, and what can't be taken back |
| [Agent logs](#agent-logs) | Components | Core | A structured log stream with level filters, search and pinnable rows |
| [Agent permissions](#agent-permissions) | Components | Core | A tool permission matrix with allow, ask and deny per tool, and a scope for remembering the decision |
| [Agent Plan](#agent-plan) | Components | Pro | An agent's step-by-step plan to review before it runs – rename, drag to reorder, remove or add steps, then watch each one run with live timers and retry from a failed step |
| [Agent Queue](#agent-queue) | Components | Pro | The work waiting for your agents, and how fast it moves – jobs drop into a live queue, glide into free worker slots as growing bars and land in Done or Failed, while a depth chart shows the backlog build up when a rate limit pauses the workers and drain when they resume |
| [Agent replay](#agent-replay) | Components | Core | A step-through debugger over one agent's reasoning, showing each step's input, output and decision |
| [Agent Run](#agent-run) | Screens | Pro | One autonomous agent run: the plan ticking through its steps, the tool calls, an approval it waits on and the draft it wrote |
| [Agent sandbox](#agent-sandbox) | Components | Core | An agent's sandboxed workspace as a file tree beside a preview pane, with a reset action |
| [Agent schedule](#agent-schedule) | Components | Core | What wakes an agent: recurring schedules and event triggers, with last run, next run and enablement |
| [Agent Steering](#agent-steering) | Components | Pro | Steer an agent while it works – queue a note for the next step and watch it glide into the plan when the agent picks it up, or interrupt right away |
| [Agent terminal](#agent-terminal) | Components | Core | Streamed command output from an agent's tool call, with severity marking and jump-to-latest |
| [Agent Tree](#agent-tree) | Components | Pro | Who started whom – an orchestrator and its sub-agents as a live tree, with status, cost and time on every card, costs rolling up each branch, and branches that fold to one line |
| [Approval Card](#approval-card) | Components | Pro | An agent asks before it acts – risk badge, preview, Approve and Deny with shortcuts, a pausing countdown, and a smooth morph into a resolved row |
| [Autonomy Dial](#autonomy-dial) | Components | Pro | How much an agent may do on its own – a three-stop dial, and its real actions gliding between “Runs on its own” and “Asks you first”, with a lock for what always asks |
| [Branch explorer](#branch-explorer) | Components | Core | Parallel attempts an agent made from a common root, each with its cost and outcome, and a way to promote one |
| [Context Window](#context-window) | Components | Pro | What fills the model's context, as a field of cells – hover a part to light it up, remove files, and compact the conversation while its cells shimmer and clear |
| [Cost meter](#cost-meter) | Components | Core | What a session has actually spent, as a running figure with a rate sparkline and a per-model breakdown |
| [Decision Tree](#decision-tree) | Components | Pro | An agent stuck on a decision lays out its options as a tree – the consequences of each branch, the risky ones marked, its own pick highlighted – and you choose a path or write your own |
| [Delegate Board](#delegate-board) | Components | Pro | Hand work to your agents by dragging it onto them – each agent previews its new “busy until” time, or switch to Auto and every new task goes to whoever is free first |
| [Fan-out Grid](#fan-out-grid) | Components | Pro | One agent hands a big job to many workers – every task a cell on a live grid that fills in as they get through it, with retries, failures, cost and the time left, and the details of any task on hover |
| [Goal tracker](#goal-tracker) | Components | Core | An objective with a token budget, a live clock, and pause, resume, complete and drop states |
| [Guardrail editor](#guardrail-editor) | Components | Core | Ordered policy rules with a matcher and an action, plus a tester showing which rule fires on sample input |
| [Human review queue](#human-review-queue) | Components | Core | A queue of items awaiting a human decision, worked through one at a time with keyboard shortcuts |
| [Inline Diff](#inline-diff) | Components | Pro | AI edits to prose shown inline – struck and added words you accept or reject one by one, with keys, a popover and undo |
| [Memory graph](#memory-graph) | Components | Core | What an agent remembers as a node and link graph, with a detail panel for the selected entity |
| [Memory Panel](#memory-panel) | Components | Pro | What the assistant remembers about you, grouped and editable – a master switch, category filters, and on every memory edit in place, pause or forget with Undo on the tray |
| [Parallel Attempts](#parallel-attempts) | Components | Pro | An agent tries the same task several ways at once and the best one wins – every attempt races as a row with its model, approach and live bar, then gets a score; the best is marked and picked, and you can switch to another |
| [Permission Request](#permission-request) | Components | Pro | An agent asks for one specific right – who, why and exactly what will happen – and you allow it once, for an hour or always; then it folds into one line with the time left and Revoke |
| [Review Center](#review-center) | Components | Pro | A focused workspace for what your agents want to do – the queue sorted by risk, one item at a time with the shaky spans marked, Approve, Edit, Reject and Skip on single keys, a stamp as each one leaves and the next one rising in |
| [Session replay](#session-replay) | Components | Core | A scrubber over a recorded session timeline, with a playhead, transport controls and the event under the playhead |
| [Subagent spawn](#subagent-spawn) | Components | Core | A parent agent fanning out N children, each with its own task and status, collapsing to a tally as they finish |
| [Todo phases](#todo-phases) | Components | Core | Phases containing tasks, with per-item status, a live step and an attempt count |
| [Tool Call Card](#tool-call-card) | Components | Free | An agent's tool call in one line – live timer, status and summary, folds open to highlighted arguments and result with copy, retry on errors and a group that sums them up |
| [Tool registry](#tool-registry) | Components | Core | The catalogue of tools an agent may call, with signatures, risk level and per-tool enablement |
| [Trace Waterfall](#trace-waterfall) | Components | Pro | Where the time and money of an agent run go – every LLM call, tool call and sub-agent as a bar on a live timeline, with tokens and cost per step, the slowest call marked and branches that fold into their parent |

## Conversation (24)

Messages, answers, drafts and the composer around them.

| Item | Kind | Tier | What it is |
| --- | --- | --- | --- |
| [AI Answer](#ai-answer) | Components | Pro | Streamed answer with source cards, citation chips that preview their source, copy, regenerate, feedback and follow-ups |
| [Assistant Home](#assistant-home) | Screens | Pro | AI assistant start page: greeting, prompt box with tools, connected apps and suggestions |
| [Attachment tray](#attachment-tray) | Components | Core | Composer attachments with upload progress, a rejected reason and an overflow chip |
| [Chat Composer](#chat-composer) | Components | Pro | Prompt composer with model picker, voice input, app connections and approval request |
| [Cited Answer](#cited-answer) | Components | Pro | An AI answer wired to its sources – point at a citation to light up its sentence and source, click to unfold the quoted passage with the matching words marked |
| [Comment Thread](#comment-thread) | Components | Free | One comment with replies – an assistant reports what it did, folds open details and answers @mentions |
| [Comments Panel](#comments-panel) | Components | Pro | Comment feed with filters, runnable /edit commands, resolve and a composer |
| [Compaction divider](#compaction-divider) | Components | Core | The in-transcript compaction marker: reason, method, token delta, failure and a running sweep |
| [Email Draft](#email-draft) | Components | Free | Agent-written email for review – switch recipient and tone, edit inline, remove the attachment, send or discard with undo |
| [Entry actions](#entry-actions) | Components | Core | The per-message action row: fork, branch, copy and jump, disabled while the session is busy |
| [File mention](#file-mention) | Components | Core | Inline file cards with path, line count, an expandable preview and a skipped reason |
| [Ghost text](#ghost-text) | Components | Core | Inline word completion aligned to the caret, accepted with Tab and dismissed with Escape |
| [Group chat](#group-chat) | Components | Core | A shared thread where several agents and one human talk, with per-speaker identity and a reply target |
| [Message Actions](#message-actions) | Components | Free | The quiet bar under an AI message – copy turns into a check, regenerate spins and unfolds a version switcher, thumbs pop and ask why, read aloud becomes a tiny equalizer |
| [Model Picker](#model-picker) | Components | Pro | The model menu of an AI chat – point at a model and its speed, quality and cost bars fill, switch on extended thinking and its effort unfolds, while the tray rolls the first-token time and price |
| [Reaction Bar](#reaction-bar) | Components | Free | Like, comment, repost and share in one pill – icons pop and fill, counts roll in digit by digit |
| [Reasoning block](#reasoning-block) | Components | Core | A collapsible reasoning block with duration, tokens, narration promoted to answer text, and a redacted placeholder |
| [Side question](#side-question) | Components | Core | A stack of aside questions with a streaming answer, cancel, and an interrupted note |
| [Slash palette](#slash-palette) | Components | Core | A slash-triggered autocomplete over the runtime command catalog, with argument hints and source badges |
| [Smart Recommendation](#smart-recommendation) | Components | Free | Suggestion card with a confidence signal, alternatives to switch to and accept with undo |
| [Thinking Loader](#thinking-loader) | Components | Free | A small working pill for AI replies – an eight-ray spinner and a shimmering label that rolls through phases and settles on a check |
| [Thinking State](#thinking-state) | Components | Pro | AI working panel with a live timer, searched sources and thinking steps that appear one by one |
| [Voice session](#voice-session) | Components | Core | Live voice phase, input and output level meters, streaming captions, mute and stop |
| [Writing Assistant](#writing-assistant) | Components | Pro | AI chat card with a soft gradient glow, suggestions, streaming replies and live voice dictation |

## Workspace (20)

App frames, screens, sessions, files and settings.

| Item | Kind | Tier | What it is |
| --- | --- | --- | --- |
| [AI Workspace](#ai-workspace) | Blocks | Pro | Complete assistant app – sidebar, welcome, streaming chat and projects, built on the Chat Composer |
| [App Directory](#app-directory) | Blocks | Pro | Browse, search and connect integrations – categories, filters and app cards with a connect flow |
| [App Shell Flat](#app-shell-flat) | Screens | Pro | The App Shell laid flat – gray sidebar and an edge-to-edge page, split by a single hairline |
| [App Shell Inset](#app-shell) | Screens | Pro | Collapsible sidebar with workspace, menu, projects and account – the frame every screen sits in |
| [Auth panel](#auth-panel) | Components | Core | Provider sign-in rows with a browser handoff state and per-account sign-out |
| [Client Context](#client-context) | Blocks | Pro | A client workspace with live numbers and a shared context timeline – switch clients, search, filter and add notes or files |
| [CRM](#crm) | Screens | Pro | Company list with pipelines, open views as tabs and an editable data table |
| [Folder](#folder) | Screens | Pro | Inside one folder: breadcrumbs, file cards with previews, and an empty state |
| [Folders](#files) | Screens | Pro | Folder overview with tabs, search, sort, grid/list toggle and file templates |
| [Image viewer](#image-viewer) | Components | Core | A lightbox with click-to-zoom, clamped panning, paging and a download link |
| [Integrations](#integrations) | Screens | Pro | App directory with a sticky header, categories, search and connect states |
| [Onboarding](#onboarding) | Screens | Pro | First-run flow of an AI workspace: workspace setup, tool connections, team invites and a first agent, with a getting-started checklist |
| [Project Card](#project-card) | Components | Pro | A two-line project summary that quietly unfolds on hover – a progress ring with one segment per subtask, a people filter and a status picker, all linked by hover |
| [Runtime settings](#runtime-settings) | Components | Core | The nine agent-behaviour settings in one panel, with a draft and a save bar that appears only when dirty |
| [Session browser](#session-browser) | Components | Core | A searchable session list grouped by day, with inline rename, delete confirmation and export |
| [Session tree](#session-tree) | Components | Core | The session entry tree with parent rails, bookmark chips, an off-branch recession and a current-leaf marker |
| [Settings & Billing](#settings-billing) | Screens | Pro | Settings page with tabs: workspace, members, API keys and billing with plan, usage, payment method, plan comparison and invoices |
| [Setup Guide](#setup-guide) | Components | Pro | Onboarding panel with a progress bar and collapsible task groups that strike through when done |
| [Task Board](#task-board) | Blocks | Pro | Kanban board with drag and drop, quick add, a detail panel, search, label filters and a compact view |
| [Tips Panel](#tips-panel) | Components | Free | Grid of short tips with one action each – taken tips turn into a done state |

## Data display (12)

Tables, charts, meters and money.

| Item | Kind | Tier | What it is |
| --- | --- | --- | --- |
| [Analytics](#analytics) | Screens | Pro | Revenue dashboard: key figures, revenue by channel, breakdown, top products and weekly trends |
| [Breakdown Chart](#breakdown-chart) | Components | Pro | Stacked bar chart with measure, slice and segment pickers, a hover breakdown and a linked table |
| [Change Summary](#change-summary) | Components | Free | What moved since last time – one metric per row with a colored trend |
| [Compact Breakdown](#compact-breakdown) | Components | Pro | A total split into its parts in one small card – numbers roll, the bar glides and the ranked rows trade places when the period changes |
| [Data Table](#data-table) | Components | Pro | Spreadsheet-style table: select cells and ranges, edit in place, copy and paste, undo and sort |
| [Evals](#evals) | Screens | Pro | Prompt evaluation dashboard: pass rate by version, reviewable prompt changes and test cases you can re-run |
| [Experiment Card](#experiment-card) | Components | Pro | An A/B test in two lines that quietly unfolds on hover – variants linked to a tiny chart, a metric switch with rolling numbers, and a winner you pick with a click |
| [Invoice & Credit Note](#invoice-credit) | Blocks | Pro | An invoice and its credit note stacked like paper – switch between them, pick lines to credit, adjust amounts and issue |
| [KPI Board](#kpi-board) | Blocks | Pro | The top of a dashboard – three trend cards, an overview chart that compares this period with the last, and a focus card; hover shows any day's value and every number rolls when the range changes |
| [KPI Chart](#kpi-chart) | Components | Pro | Metric card with a multi-line chart and a tooltip that follows the pointer |
| [Metrics Dashboard](#metrics-dashboard) | Blocks | Pro | Sales overview – KPI cards pick the metric, one chart switches between dotted line and bars, with top products and channels |
| [Usage Meter](#usage-meter) | Components | Pro | Plan usage and AI credits – a stacked credits meter by category, daily sparkline, limits and a button that speaks up near the limit |

## Controls (14)

Buttons, fields, pickers and the forms built from them.

| Item | Kind | Tier | What it is |
| --- | --- | --- | --- |
| [Billing Schedule](#billing-schedule) | Components | Pro | Build a billing phase – start date, duration, products with repeats and timing, discount, minimum and live totals |
| [Button](#button) | Components | Free | Primary, secondary, ghost and destructive buttons with icons, sizes and a shimmering loading state |
| [Combobox](#combobox) | Components | Pro | Pick one or many from a searchable, grouped list – chips with avatars, highlighted matches, create-on-the-fly and full keyboard support |
| [Command Menu](#command-menu) | Components | Pro | Search and run anything from one field – tool actions with logos and ⌘1–⌘5, everyday commands with icons |
| [Date Range Picker](#date-range-picker) | Components | Pro | Presets and two calendars with a hover preview, comparison with the previous period or year, full keyboard control |
| [Dropzone](#dropzone) | Components | Pro | Drag files in and watch them upload – fanning documents, colored type badges, progress with time left, errors with retry |
| [Filter Menu](#filter-menu) | Components | Free | Grouped filters with removable chips, collapsible checkbox groups, Clear all and full keyboard control |
| [Integration Picker](#integration-picker) | Components | Pro | Integrations page of a command menu – search, a list of services and the picked one with its connection on two tiles |
| [Integration Settings](#integration-settings) | Components | Pro | Settings card for a connected service – on/off switch, API key, validated site address, time zone and a save bar |
| [OTP Input](#otp-input) | Components | Free | The verification code field done right – a gliding focus ring, paste and SMS autofill, a calm shake on errors and a morph into Verified |
| [Profile Menu](#profile-menu) | Components | Free | Account card with the signed-in user, menu actions and profile setup progress |
| [Prompt Library](#prompt-library) | Components | Pro | Saved prompt templates with variables – type straight into the sentence, watch the finished prompt assemble below, and use it once every variable is filled |
| [Segmented Control](#segmented-control) | Components | Free | Switch between two to six options – a raised pill or underline that glides, stretches a little and can be dragged across, with icons, counts and badges |
| [Stepper Form](#stepper-form) | Components | Pro | A multi-step flow for onboarding and setup – steps that fill and check off, sliding steps, a card that morphs to each step, inline validation and a success state |

## Feedback (8)

Progress, notices and the state of the system.

| Item | Kind | Tier | What it is |
| --- | --- | --- | --- |
| [Connection banner](#connection-banner) | Components | Core | Transport health: starting, reconnecting with a countdown, exited with a code, and a history-gap note |
| [Decision Inbox](#decision-inbox) | Components | Free | Open decisions with two quick answers each – answered ones confirm and fold away |
| [Error card](#error-card) | Components | Core | A failed turn with provider metadata, HTTP status, retryability and a scheduled-retry state |
| [Notification Stack](#notification-stack) | Components | Free | Notice cards stacked behind each other – dismiss the front one to reveal the next |
| [Progress Tracker](#progress-tracker) | Components | Free | Onboarding checklist with an animated progress bar, ticks that draw themselves and auto play |
| [Status strip](#status-strip) | Components | Core | Keyed status slots in one row, folding the overflow into a popover and collapsing to nothing when empty |
| [Toaster](#toaster) | Components | Pro | Calm toasts from anywhere – a stack that fans out on hover, promise toasts that morph from spinner to check, swipe to dismiss |
| [Widget strip](#widget-strip) | Components | Core | Keyed extension widgets above or below the composer, with textual severity and a leave animation |

## Marketing (28)

Public site: chrome, landing sections, pricing and legal.

| Item | Kind | Tier | What it is |
| --- | --- | --- | --- |
| [Agent Gallery](#agent-gallery) | Blocks | Pro | Slim gradient panels with one open product screen in the middle – pick a panel and it glides open |
| [Announcement pill](#announcement-pill) | Components | Core | A launch pill with a label chip, a message and an optional dismiss |
| [Browser frame](#browser-frame) | Components | Core | Browser chrome with dots and an address bar over a fixed 16 by 10 viewport |
| [Channel inbox](#channel-inbox) | Components | Core | A compact inbox preview listing conversations across channels with unread and status marks |
| [Chat window](#chat-window) | Components | Core | A titled window chrome with traffic dots and a status slot, wrapping any preview |
| [Comparison matrix](#comparison-matrix) | Components | Core | Three products compared feature by feature, with the recommended column raised |
| [CS inbox](#cs-inbox) | Components | Core | The full customer-service inbox: conversation list, thread and a takeover bar |
| [CTA band](#cta-band) | Blocks | Core | A closing band with a watermark mark, a headline, a lead and two CTAs |
| [FAQ accordion](#faq-accordion) | Components | Core | Questions that fold open one at a time, with a plus that turns and a single-open rule |
| [Feature grid](#feature-grid) | Blocks | Core | A two-column grid of feature cards, each with a heading, copy and a visual slot |
| [Hero band](#hero-band) | Blocks | Core | The opening band of a landing page: launch pill, headline with an inline glyph, lead and two CTAs |
| [Highlight band](#highlight-band) | Components | Core | A one line emphasised band that sets a highlight apart from the prose around it |
| [Legal page](#legal-page) | Blocks | Core | A legal document page with a document switcher, a sticky contents list and numbered sections |
| [Logo Marquee](#logo-marquee) | Blocks | Free | The endless “Trusted by” strip – a seamless loop that eases to a stop on hover, scrubs with inertia and lifts the hovered logo to colour |
| [Mock thread](#mock-thread) | Components | Core | A chat bubble stack with channel avatars, an AI tag, a typing bubble and a source note |
| [Numbered points](#numbered-points) | Blocks | Core | A commercial argument: a heading and lead beside rows that carry square step numbers |
| [Phone mock](#phone-mock) | Components | Core | A phone frame with status bar, app bar, scrolling thread and a composer |
| [Portfolio marquee](#portfolio-marquee) | Components | Core | Two rows of work previews scrolling in opposite directions, pausing on hover |
| [Pricing Plans](#pricing-plans) | Blocks | Pro | Pricing section with a monthly / yearly switch, three plan cards and collapsible details |
| [Pricing tiers](#pricing-tiers) | Blocks | Core | Four plan cards with a monthly or yearly switch, discount badge, ribbon badges and per-feature help |
| [Process steps](#process-steps) | Components | Core | A numbered process as a line of steps with connectors, horizontal or stacked |
| [Section intro](#section-intro) | Components | Core | The eyebrow, heading and lead paragraph that opens a marketing section, centred or left |
| [Service row](#service-row) | Blocks | Core | A service explained full width: a tag chip, a heading, capability tags and a CTA beside a shot |
| [Site footer](#site-footer) | Components | Core | Slim site footer with a brand mark, wrap-friendly link rows and a copyright line |
| [Site header](#site-header) | Components | Core | Sticky marketing header with centre nav, one dropdown group, a login link and a gradient CTA |
| [Stock card](#stock-card) | Components | Core | A catalogue entry that an answer cited, with stock meta and the quoted reply |
| [Testimonial Wall](#testimonial-wall) | Blocks | Free | The landing-page wall of quotes – columns that scroll endlessly in opposite directions, ease to a stop on hover and scrub with inertia |
| [Use case switcher](#use-case-switcher) | Blocks | Core | Chips that switch the headline, copy and CTA beside a phone preview |

## Artwork & motion (32)

Illustrations, backgrounds and motion primitives.

| Item | Kind | Tier | What it is |
| --- | --- | --- | --- |
| [Agent Team](#agent-team) | Illustrations | Free | A prompt types itself and branches out into three agents, each with a role and overlapping tool logos |
| [Blur Crossfade](#blur-crossfade) | Motion | Pro | Swaps content with a soft blur while the box glides smoothly to the size of what comes next |
| [Cover Flow](#cover-flow) | Illustrations | Free | Browse covers in 3D – drag, flick or scrub the row, it springs to the nearest cover; images drift in their frames over a soft reflection |
| [DACH Region](#region-dach) | Illustrations | Free | DACH map with fading neighbours and a pastel band along the border, switchable to the US, China, India, Brazil or Japan |
| [Empty Calendar](#empty-calendar) | Illustrations | Free | Stack of calendar cards marked empty, fanning out on hover |
| [Enrichment Orbit](#enrichment-orbit) | Illustrations | Free | Grok tile inside two rings with comets and data nodes orbiting around it |
| [Frost Cloud](#frost-cloud) | Illustrations | Free | A frosted white cloud with eyes cut out of it, on a red-orange or blue sky – it floats, turns to look around, blinks, follows the pointer and bounces with a wink when clicked |
| [Ghosted Chat](#ghosted-chat) | Illustrations | Free | Unanswered chat messages marked as read, with a thumbs-down reply on hover |
| [Glass Folder](#glass-folder) | Illustrations | Pro | Glassy blue folder with documents behind a frosted pocket that tips open on hover |
| [Glow Cloud](#glow-cloud) | Illustrations | Free | A glowing cloud with eyes in blue or red-orange – it floats, turns to look around, blinks, follows the pointer and bounces with a wink when clicked |
| [Glow Keyboard](#glow-keyboard) | Illustrations | Pro | AI chat input that types itself over a glass keyboard – every key press sends a wave up the gradient floor |
| [Gradient Floor](#gradient-floor) | Motion | Pro | A blurred colour gradient that glows up from the bottom edge – two layers that drift and morph |
| [Gradient Text](#gradient-text) | Motion | Pro | Letters cut from a liquid, ever-flowing gradient – the color sweeps across the word the first time it's seen |
| [Grid Background](#grid-background) | Motion | Free | A fine line grid that drifts slowly behind your content and fades out towards the edges |
| [Integration Beam](#integration-beam) | Illustrations | Free | Your product between the tools it connects – light pulses flow along curved beams, hover to focus a tool, click to pause it |
| [Integration Flow](#integration-flow) | Illustrations | Pro | Integration pills rotating along a dashed arc, each beaming its data into a central analysis hub |
| [Integration Grid](#integration-grid) | Illustrations | Free | Honeycomb-like wall of integration logos around a bright centre tile with your product mark, fading out toward the edges |
| [Layer Stack](#layer-stack) | Illustrations | Free | Isometric stack of five layers with a list beside it – the chosen entry lifts its layer out in color |
| [Lead Sourcing](#lead-sourcing) | Illustrations | Free | ChatGPT tile linked to Gmail and Grok, with a shine running along the connection |
| [Logo Cluster](#logo-cluster) | Illustrations | Free | Your mark on a white disc in the middle – company logos bounce out of it and settle around it |
| [Model Wheel](#model-wheel) | Illustrations | Free | AI model names on a turning drum – the rows bend away at the edges and each model lands on a soft gray fill |
| [Number Ticker](#number-ticker) | Motion | Free | Odometer-style numbers – every digit rolls to its new value and counts in from zero when it scrolls into view |
| [Outreach Branches](#outreach-branches) | Illustrations | Pro | Lines branching out to Gmail, Slack and Notion with colored pulses flowing down |
| [Project Flow](#project-flow) | Illustrations | Pro | Animated scene of a client task branching into subtasks, notes and assigned roles |
| [Shimmer Loader](#shimmer-loader) | Motion | Free | Skeleton blocks that share one soft light sweep, plus shimmering text for “Thinking…” states |
| [Side Folder](#side-folder) | Illustrations | Free | Glassy blue folder on its side, documents sliding out to the right as the pocket swings open on hover |
| [Tab Overload](#tab-overload) | Illustrations | Free | Overlapping browser windows where the highlight follows the hovered tab |
| [Team Invite](#team-invite) | Illustrations | Free | Connected teammates – a cursor drags a new one into the empty slot, the line turns solid and they go online |
| [Text Reveal](#text-reveal) | Motion | Free | Text that arrives word by word or letter by letter – each piece rises out of a soft blur as it scrolls into view |
| [Tilt Card](#tilt-card) | Motion | Pro | A card that tilts in 3D towards the pointer, with a soft glare that follows it and a smooth spring back |
| [Voice Orb](#voice-orb) | Illustrations | Pro | The face of a voice assistant – a sphere of dots that breathes, catches sound, collapses into a spinning ring while thinking and ripples when it speaks |
| [World Map Continental](#world-map) | Illustrations | Pro | World map with one highlighted continent and a pastel band along its coastline, switchable between all six |

---

## API reference

### Agents

#### Agent budget

<a id="agent-budget"></a>

`Core` · Components: A run's token budget as a segmented meter, with spend, remaining allowance and an overshoot projection

```tsx
import { … } from "@/components/agent-budget";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Run the budget belongs to |
| limit | `number` | Token ceiling for the run |
| segments | `readonly BudgetPart[]` | Token parts, in bar and legend order |
| rate | `number` | Tokens per minute measured over the last turns; omit until there is a rate |
| endsInSeconds | `number` | Seconds of run left, so the projection knows where the run lands |
| className | `string` | Extra class on the root |

#### Agent Chat

<a id="agent-chat"></a>

`Pro` · Screens: Chat with an orchestrating agent, the agents at work, and a brief to fill in beside it

```tsx
import { … } from "@/components/agent-chat";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` | Extra class on the root |
| workspace | `string` | Workspace name; its first letter is the logo tile |
| nav | `ChatNavGroup[]` | Menu rows, in groups |
| chats | `string[]` | Conversations under the menu; an empty list shows the empty line |
| news | `{ title: string; more: string; kicker?: string; count?: number }` | The "what's new" card above the account; the kicker defaults to `New in <workspace>` |
| guide | `{ title: string; percent: number; cheer: string; height?: number }` | Getting-started card in the sidebar foot |
| user | `{ name: string; initials?: string }` | Account at the bottom; two initials are derived from the name when omitted |
| turn | `ChatTurn` | The orchestrator's turn |
| route | `{ name: string; hint: string }` | The composer's route line |
| brief | `ChatBrief` | The brief beside the thread |
| activity | `{ text: string; note: string }[]` | Rows for the Activity tab |
| assetsNote | `string` | The Assets tab line shown before anything is generated |
| initialAngle | `string` | Selling angle selected on the first render; defaults to the brief's `selected` angle |
| defaultBriefOpen | `boolean` | Whether the brief starts open |
| onSend | `(text: string) => void` | Called with the message text when the composer is submitted |
| onAngleChange | `(name: string) => void` | Called when another selling angle is chosen |
| onChannelChange | `(name: string, on: boolean) => void` | Called when a channel switch is flipped |
| onGenerate | `() => void` | Called when the brief's primary action is pressed |
| onNavigate | `(label: string) => void` | Called with a sidebar label |

#### Agent Cursors

<a id="agent-cursors"></a>

`Pro` · Components: Agents working in a document like teammates in a multiplayer editor – live pointers with names, suggestions typed letter by letter, images they resize, code they fix and comments beside the page

```tsx
import { … } from "@/components/agent-cursors";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` | Extra class on the root |
| title | `string` | Document name in the top bar |
| agents | `readonly Agent[]` |  |
| cursors | `readonly Cursor[]` |  |
| blocks | `readonly Block[]` |  |
| comments | `readonly Comment[]` |  |
| marks | `readonly Mark[]` |  |
| view | `AgentCursorsView` | Which view the tabs show |
| onViewChange | `(view: AgentCursorsView) => void` |  |
| followed | `string \| null` | The agent you are following, if any |
| onFollow | `(agent: string \| null) => void` |  |
| openComment | `string \| null` | The comment whose card is open, if any |
| onCommentOpen | `(comment: string \| null) => void` |  |
| spent | `number` | Total spent; defaults to the sum of the pointers' costs |
| onAcceptAll | `() => void` |  |
| onReplyChange | `(comment: string, reply: string) => void` |  |
| onResolve | `(comment: string) => void` |  |
| table | `DocTable` |  |
| height | `number` | Visible height of the sheet, in px |
| fade | `boolean` | Fade the sheet out at the bottom |
| live | `string` | Announcement text for the live region |

#### Agent diff

<a id="agent-diff"></a>

`Core` · Components: A code diff an agent produced, hunk by hunk, with per-hunk accept and reject

```tsx
import { … } from "@/components/agent-diff";
```

| Name | Type | Description |
| --- | --- | --- |
| file | `string` | Path of the file the agent edited |
| hunks | `readonly DiffHunk[]` | The hunks, in file order |
| decisions | `Readonly<Record<string, HunkDecision>>` | Decisions keyed by hunk id; omit to let the component own them |
| onDecide | `(id: string, decision: "accepted" \| "rejected") => void` | One hunk accepted or rejected |
| className | `string` |  |

#### Agent Graph

<a id="agent-graph"></a>

`Pro` · Components: Agents and the tools they call as a living network – a pulse along the link for every call and its answer, busy links growing thicker, agents that breathe while they work and turn amber when they need you

```tsx
import { … } from "@/components/agent-graph";
```

| Name | Type | Description |
| --- | --- | --- |
| nodes | `GraphNode[]` | Every agent, tool and user; ids keep nodes in place and new ids grow in |
| calls | `GraphCall[]` | Recent calls, newest last – a new id sends a streak from → to |
| edges | `[string, string][]` | Links that are always there, even before their first call |
| now | `number` | The clock for calls per minute and link heat; without it the graph ticks every second |
| heatWindow | `number` | How far back (ms) calls count towards a link's weight |
| onSelect | `(node: GraphNode \| null) => void` | A node was clicked – null when its card closes |
| height | `number` | Fixed height of the stage in px; by default it follows the width |
| formatCost | `(amount: number) => string` | Formats every cost |
| title | `string` | Heading of the bar |
| className | `string` | Extra class on the root |

#### Agent handoff

<a id="agent-handoff"></a>

`Core` · Components: Control passing from one agent to another, with the reason, the payload and an accept or decline decision

```tsx
import { … } from "@/components/agent-handoff";
```

| Name | Type | Description |
| --- | --- | --- |
| from | `HandoffAgent` | Agent giving up control |
| to | `HandoffAgent` | Agent taking over |
| reason | `string` | Why control is moving, quoted under the connector |
| payload | `HandoffPayloadItem[]` | What travels with the handoff, shown as label and value rows |
| size | `string` | Size of the payload, e.g. "42 KB". The item count is measured from `payload` |
| stamp | `string` | When the request was raised, e.g. "2 min ago" |
| state | `HandoffState` | Controlled state. Leave undefined to let the card resolve itself |
| defaultState | `HandoffState` | Initial state when uncontrolled |
| onAccept | `() => void` | Called when control is accepted |
| onDecline | `() => void` | Called when the handoff is declined |
| onReopen | `() => void` | Called by Reopen or Send again after a decision |
| className | `string` |  |

#### Agent Inbox

<a id="agent-inbox"></a>

`Pro` · Components: All your background agent tasks in one calm list – live clocks and status tags, filter tabs with rolling counts, rows that unfold to the last steps with Approve, Reject, Retry or Open, and glide to their new place

```tsx
import { … } from "@/components/agent-inbox";
```

| Name | Type | Description |
| --- | --- | --- |
| tasks | `AgentInboxTask[]` |  |
| view | `AgentInboxView` | Controlled layout. |
| defaultView | `AgentInboxView` |  |
| onViewChange | `(view: AgentInboxView) => void` |  |
| openId | `string \| null` | Controlled expanded card. `null` folds everything. |
| defaultOpenId | `string \| null` |  |
| onOpenChange | `(id: string \| null) => void` |  |
| onApprove | `(task: AgentInboxTask) => void` |  |
| onReject | `(task: AgentInboxTask) => void` |  |
| onRetry | `(task: AgentInboxTask) => void` |  |
| onOpen | `(task: AgentInboxTask) => void` | The underlying run, pull request or document behind the card. |
| crumb | `string` | Trail above the title. |
| title | `string` |  |
| layoutLabel | `string` | Accessible name of the board/list switch. |
| lanes | `AgentInboxLane[]` |  |
| emptyLabel | `string` | Copy for a lane with nothing in it. |
| className | `string` |  |

#### Agent Lanes

<a id="agent-lanes"></a>

`Pro` · Components: Where every agent is right now – a live timeline with a lane per agent, tasks growing into “now”, hand-offs drawn between agents and approvals right on the block

```tsx
import { … } from "@/components/agent-lanes";
```

| Name | Type | Description |
| --- | --- | --- |
| agents | `LaneAgent[]` | One lane per agent, top to bottom |
| tasks | `LaneTask[]` | Every block on the timeline |
| span | `number` | How much history the lanes show, in ms (default 30 minutes) |
| now | `number` | A clock you own; without it the lanes follow the real one |
| onApprove | `(task: LaneTask) => void` | Approve what a waiting task asks for |
| onReject | `(task: LaneTask) => void` | Stop a waiting task as it stands |
| onOpen | `(task: LaneTask) => void` | Open a task in its full run view |
| title | `string` | Header label (default "Agents") |
| className | `string` | Extra class on the root, merged after "ui-alc" |

#### Agent Ledger

<a id="agent-ledger"></a>

`Pro` · Components: Everything an agent changed in your systems, each change with an undo – before and after per row, and pointing at Undo shows what builds on it: what would be undone too, and what can't be taken back

```tsx
import { … } from "@/components/agent-ledger";
```

| Name | Type | Description |
| --- | --- | --- |
| rows | `readonly LedgerRow[]` | The changes, any order – newest is shown first |
| title | `string` | Heading in the bar |
| agent | `string` | Who made the changes, next to the title |
| undone | `readonly string[]` | Ids of the changes already undone – controlled |
| defaultUndone | `readonly string[]` | Rows undone before the first paint – uncontrolled |
| previewId | `string \| null` | The row whose Undo is being pointed at – controlled preview |
| defaultPreviewId | `string \| null` | Preview before a pointer lands – uncontrolled |
| onPreviewChange | `(id: string \| null) => void` | The preview moved – `null` when the pointer left |
| onUndo | `(ids: string[]) => void` | The row to undo and every reversible change built on it, in the order they cascade |
| now | `number` | Clock for "27s ago", epoch ms – left out, the ledger ticks itself |
| className | `string` | Extra class on the root |

#### Agent logs

<a id="agent-logs"></a>

`Core` · Components: A structured log stream with level filters, search and pinnable rows

```tsx
import { … } from "@/components/agent-logs";
```

| Name | Type | Description |
| --- | --- | --- |
| rows | `LogRow[]` | The stream, in the order it should read. Newest first suits a console pane |
| title | `string` | Heading in the top bar |
| query | `string` | Controlled search text. Leave it out to let the field keep its own |
| onQueryChange | `(query: string) => void` |  |
| streaming | `boolean` | The run is live: the header dot breathes in ember. `false` pauses the dot, not the rows |
| onPinChange | `(id: string, pinned: boolean) => void` | A row was pinned or unpinned; `pinned` is the state it moved to |
| pinnedIds | `string[]` | Rows to pin before the first render. Later changes are ignored: the user owns the pins |
| className | `string` |  |

#### Agent permissions

<a id="agent-permissions"></a>

`Core` · Components: A tool permission matrix with allow, ask and deny per tool, and a scope for remembering the decision

```tsx
import { … } from "@/components/agent-permissions";
```

| Name | Type | Description |
| --- | --- | --- |
| tools | `PermissionTool[]` | The tools asking for a right, in the order they should be ruled on |
| value | `Record<string, PermissionDecision>` | Controlled rulings, keyed by tool id |
| defaultValue | `Record<string, PermissionDecision>` | Starting rulings for the uncontrolled case |
| onChange | `(id: string, decision: PermissionDecision) => void` | Fires with the tool id and its new ruling |
| scope | `PermissionScope` | Controlled scope |
| defaultScope | `PermissionScope` | Starting scope, defaults to "session" |
| onScopeChange | `(scope: PermissionScope) => void` | Fires when the scope changes |
| onApply | `(rulings: Record<string, PermissionDecision>, scope: PermissionScope) => void` | Fires when the rulings are handed to the runner |
| title | `string` | Heading over the matrix |
| subject | `string` | Who is asking, shown under the heading |
| className | `string` |  |

#### Agent Plan

<a id="agent-plan"></a>

`Pro` · Components: An agent's step-by-step plan to review before it runs – rename, drag to reorder, remove or add steps, then watch each one run with live timers and retry from a failed step

```tsx
import { … } from "@/components/agent-plan";
```

| Name | Type | Description |
| --- | --- | --- |
| steps | `PlanStep[]` | Controlled steps – pair with onChange. |
| defaultSteps | `PlanStep[]` | Initial steps when uncontrolled – edits stay inside the component. |
| status | `AgentPlanStatus` | Review, executing or finished. |
| onChange | `(steps: PlanStep[]) => void` | Every edit during review: rename, remove, reorder, add. |
| onRun | `(steps: PlanStep[]) => void` | "Run plan" pressed – receives the steps in their final order. Also renders "Run again" once done. |
| onCancel | `() => void` | Renders a Cancel button beside Run plan in review. |
| onRetry | `(stepId: string) => void` | Renders "Retry from here" under a failed step. |
| title | `string` | The goal of the plan, used as the heading and the list's label. |
| estimate | `string` | Estimated run time shown in review, e.g. "~2 min". |
| className | `string` | Extra class on the root. |

#### Agent Queue

<a id="agent-queue"></a>

`Pro` · Components: The work waiting for your agents, and how fast it moves – jobs drop into a live queue, glide into free worker slots as growing bars and land in Done or Failed, while a depth chart shows the backlog build up when a rate limit pauses the workers and drain when they resume

```tsx
import { … } from "@/components/agent-queue";
```

| Name | Type | Description |
| --- | --- | --- |
| jobs | `QueueJob[]` |  |
| workers | `QueueWorker[]` |  |
| concurrency | `number` | How many jobs may run at once. Defaults to the size of the worker pool. |
| minConcurrency | `number` |  |
| maxConcurrency | `number` |  |
| onConcurrencyChange | `(workers: number) => void` |  |
| paused | `boolean` |  |
| onPausedChange | `(paused: boolean) => void` |  |
| limitedFor | `number \| null` | ms left on a provider rate limit. Set it and the board freezes until it runs out. |
| throughput | `number` | Jobs finished per minute. |
| waitP95 | `number` | 95th percentile wait, in ms. |
| done | `number` | How many jobs landed in each bin. |
| failed | `number` |  |
| depth | `number[]` | Queue depth, oldest first. The newest sample is the dot at the right edge. |
| window | `number` | How far back the chart looks, in ms. |
| backpressure | `number` | A depth that means trouble – the dashed rule, and the warning tone on Waiting. |
| rateLimits | `QueueRateLimit[]` |  |
| title | `string` |  |
| name | `string` |  |
| emptyLabel | `string` | What the queue column says when nothing waits. |
| openJobId | `string \| null` |  |
| defaultOpenJobId | `string \| null` |  |
| onOpenJobChange | `(id: string \| null, job: QueueJob \| null) => void` |  |
| onPromote | `(job: QueueJob) => void` | Pull a waiting job to the front. |
| onCancel | `(job: QueueJob) => void` | Drop a waiting job, or stop one that is running. |
| onRetry | `(job: QueueJob) => void` | Send a job that already failed once back into the queue. |
| className | `string` |  |

#### Agent replay

<a id="agent-replay"></a>

`Core` · Components: A step-through debugger over one agent's reasoning, showing each step's input, output and decision

```tsx
import { … } from "@/components/agent-replay";
```

| Name | Type | Description |
| --- | --- | --- |
| steps | `readonly ReplayStep[]` | The chain, in the order the agent reasoned it |
| title | `string` | What the chain was chasing |
| agent | `string` | Which agent ran it |
| index | `number` | The step on screen, when the caller owns it |
| defaultIndex | `number` | The step to open on when the caller does not own it |
| onIndexChange | `(index: number) => void` | Called with the step index every time the debugger moves |
| visited | `readonly number[]` | The steps already seen, when the caller owns the trail |
| onVisitedChange | `(visited: readonly number[]) => void` | Called with every step seen so far whenever the trail grows |
| className | `string` |  |

#### Agent Run

<a id="agent-run"></a>

`Pro` · Screens: One autonomous agent run: the plan ticking through its steps, the tool calls, an approval it waits on and the draft it wrote

```tsx
import { … } from "@/components/agent-run";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Run title, shown in the header and on the plan |
| agent | `string` | Agent that owns the run |
| triggeredBy | `string` | Who started it |
| steps | `RunStep[]` | Plan steps, in order |
| draft | `RunDraft` | The draft the run wrote, with its suggestions |
| cost | `string` | Price of the run, shown in Details |
| onApprove | `(approval: RunApproval) => void` | Called with the approval that is waiting, when it is granted |
| onDeny | `(approval: RunApproval) => void` | Called when the waiting approval is denied; the run stops there |
| onStop | `() => void` | Called when Stop run is pressed |
| onDone | `() => void` | Called once, when the run works through every step on its own |
| className | `string` | Extra class on the root |

#### Agent sandbox

<a id="agent-sandbox"></a>

`Core` · Components: An agent's sandboxed workspace as a file tree beside a preview pane, with a reset action

```tsx
import { … } from "@/components/agent-sandbox";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Heading in the top bar |
| nodes | `readonly SandboxNode[]` | The sandbox as the agent left it |
| baseline | `readonly SandboxNode[]` | The same workspace as it stood before the run. Reset restores this, so it is not optional |
| defaultSelectedId | `string` | The row selected on the first paint – defaults to the first file |
| onSelect | `(node: SandboxNode) => void` | The selection moved |
| onOpen | `(node: SandboxNode) => void` | Enter on a file |
| onReset | `() => void` | The reset was confirmed and the tree restored |
| className | `string` |  |

#### Agent schedule

<a id="agent-schedule"></a>

`Core` · Components: What wakes an agent: recurring schedules and event triggers, with last run, next run and enablement

```tsx
import { … } from "@/components/agent-schedule";
```

| Name | Type | Description |
| --- | --- | --- |
| triggers | `readonly AgentTrigger[]` | The wake rules, in the order they should read |
| title | `string` | Heading in the bar |
| agent | `string` | Who the rules belong to, next to the title |
| enabled | `readonly string[]` | Ids of the triggers that are on. Controlled: left out, the component keeps them itself |
| defaultEnabled | `readonly string[]` | Which triggers start on when the component keeps them itself. Falls back to each trigger's own `enabled` flag |
| runningId | `string \| null` | The trigger currently running. Controlled: left out, Run now owns the state |
| onToggle | `(id: string, enabled: boolean) => void` | A switch moved |
| onRunNow | `(id: string) => void` | Run now was pressed on a trigger that is on and not blocked |
| now | `number` | Clock, epoch ms. Left out, the schedule ticks itself |
| className | `string` | Extra class on the root |

#### Agent Steering

<a id="agent-steering"></a>

`Pro` · Components: Steer an agent while it works – queue a note for the next step and watch it glide into the plan when the agent picks it up, or interrupt right away

```tsx
import { … } from "@/components/agent-steering";
```

| Name | Type | Description |
| --- | --- | --- |
| steps | `SteerStep[]` | The plan, top to bottom. One step should be `"active"` while the run is going. |
| queue | `SteerNote[]` | Notes waiting for the next step — they glide into the step that picks them up. |
| onSteer | `(text: string) => void` | Enter or the send button: queue `text` for the next step. |
| onInterrupt | `(text: string, noteId?: string) => void` | Ctrl/⌘ + Enter, or a chip's “Now”: hand the note to the current step immediately. `noteId` is the queued chip that was pulled in, when the interruption came from the queue. |
| onRemove | `(noteId: string) => void` | The chip's dismiss button. Omit it and the queue cannot be edited. |
| onPause | `() => void` |  |
| onResume | `() => void` |  |
| status | `SteerStatus` |  |
| title | `string` |  |
| agent | `string` |  |
| startedAt | `number` | Epoch ms the run started; the state pill counts from here while running. Defaults to mount. |
| draft | `string` | Controlled draft. Leave it out to let the field keep its own text. |
| onDraftChange | `(value: string) => void` |  |
| placeholder | `string` |  |
| className | `string` |  |

#### Agent terminal

<a id="agent-terminal"></a>

`Core` · Components: Streamed command output from an agent's tool call, with severity marking and jump-to-latest

```tsx
import { … } from "@/components/agent-terminal";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Heading on the chrome bar |
| command | `string` | The command being run, shown in the bar. The leading `$` is added by the terminal |
| lines | `readonly TerminalLine[]` | Every line the call has produced. The terminal paces their arrival |
| status | `TerminalStatus` | Where the call is – `running` streams, `stopped` freezes the output |
| exitCode | `number` | Process exit code, shown once the call is no longer running |
| initialLines | `number` | Lines already on screen when the terminal mounts, revealed without the entrance animation |
| pace | `number` | Milliseconds between two revealed lines |
| onClear | `() => void` | The clear control was pressed; the terminal also empties its own scrollback |
| onStop | `() => void` | The stop control was pressed – only offered while the call is running |
| className | `string` | Extra class on the root |

#### Agent Tree

<a id="agent-tree"></a>

`Pro` · Components: Who started whom – an orchestrator and its sub-agents as a live tree, with status, cost and time on every card, costs rolling up each branch, and branches that fold to one line

```tsx
import { … } from "@/components/agent-tree";
```

| Name | Type | Description |
| --- | --- | --- |
| tree | `AgentTreeNode` | The whole tree – pass it again whenever the run changes |
| title | `string` | Heading of the bar, and the accessible name of the tree |
| now | `number` | The clock for running times; without it the tree ticks every second while an agent runs |
| formatCost | `(usd: number) => string` | Formats every amount, e.g. "$0.42" |
| collapsed | `readonly string[]` | Ids of folded branches, controlled |
| defaultCollapsed | `readonly string[]` | Starting folded branches when uncontrolled |
| onCollapsedChange | `(collapsed: string[]) => void` | A branch was folded or opened |
| onResolve | `(node: AgentTreeNode, action: AgentTreeAction) => void` | An answer from the window behind "needs you" or "failed" |
| onSelect | `(node: AgentTreeNode) => void` | A click on a card – makes the cards clickable |
| className | `string` |  |

#### Approval Card

<a id="approval-card"></a>

`Pro` · Components: An agent asks before it acts – risk badge, preview, Approve and Deny with shortcuts, a pausing countdown, and a smooth morph into a resolved row

```tsx
import { … } from "@/components/approval-card";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | What the agent wants to do, e.g. "Send campaign email". |
| description | `string` | One line of context under the title. |
| risk | `ApprovalRisk` | Risk badge. `low` is the unstyled default; `medium` and `high` recolour it. |
| icon | `ReactNode` | Leading glyph. Defaults to a shield. |
| details | `ApprovalDetail[]` | Label/value rows shown under the divider. |
| preview | `ReactNode` | Custom preview content; `children` is used when this is absent. |
| children | `ReactNode` | Custom preview content. |
| status | `ApprovalStatus` | Controlled status. Leave undefined to let the card resolve itself. |
| defaultStatus | `ApprovalStatus` | Initial status when uncontrolled. |
| onApprove | `(event: { always: boolean }) => void \| Promise<void>` | Called on Approve. Return a promise to hold the button in its busy state. |
| onDeny | `(event: { reason: ApprovalDenyReason }) => void` | Called on Deny or when the countdown expires. |
| onEdit | `() => void` | Adds an Edit button before Deny. |
| expiresIn | `number` | Countdown length in seconds. `0`/undefined hides the timer. |
| onExpire | `() => void` | Called when the countdown reaches zero, before `onDeny({ reason: "timeout" })`. |
| allowAlways | `boolean` | Show the "always allow" checkbox. |
| alwaysLabel | `string` |  |
| approveLabel | `string` |  |
| denyLabel | `string` |  |
| editLabel | `string` |  |
| shortcuts | `boolean` | Show the Esc / ⌘↵ keycaps. |
| label | `string` | Small caption above the card; also reserves the space the pending card animates over. |
| actions | `ApprovalActions` | Where the actions live. Defaults to the tray footer. |
| className | `string` |  |

#### Autonomy Dial

<a id="autonomy-dial"></a>

`Pro` · Components: How much an agent may do on its own – a three-stop dial, and its real actions gliding between “Runs on its own” and “Asks you first”, with a lock for what always asks

```tsx
import { … } from "@/components/autonomy-dial";
```

| Name | Type | Description |
| --- | --- | --- |
| actions | `AgentAction[]` | The agent's actions, in the order you want them listed |
| level | `AutonomyLevel` | Controlled stop: 0 Always ask, 1 If risky, 2 Full auto |
| defaultLevel | `AutonomyLevel` | Starting stop when uncontrolled |
| onLevelChange | `(level: AutonomyLevel) => void` | Called when a stop is chosen, by click or arrow key |
| locked | `string[]` | Controlled ids of actions that always ask, whatever the stop |
| defaultLocked | `string[]` | Starting locks when uncontrolled |
| onLockChange | `(locked: string[]) => void` | Called with the next lock set when a lock is toggled |
| title | `string` | Heading, e.g. the agent's name |
| subtitle | `string` | Line under the heading |
| className | `string` |  |

#### Branch explorer

<a id="branch-explorer"></a>

`Core` · Components: Parallel attempts an agent made from a common root, each with its cost and outcome, and a way to promote one

```tsx
import { … } from "@/components/branch-explorer";
```

| Name | Type | Description |
| --- | --- | --- |
| root | `string` | The shared starting point every branch grew from |
| branches | `Branch[]` | The branches, in the order they left the root |
| title | `string` | Heading above the tree |
| adopted | `string` | Controlled adopted branch id; leave it out and the component owns the choice |
| onPromote | `(branch: Branch) => void` | An alternative was promoted to the adopted line |
| formatCost | `(amount: number) => string` | Formats every cost, per branch, in the header total, and in the delta |
| className | `string` |  |

#### Context Window

<a id="context-window"></a>

`Pro` · Components: What fills the model's context, as a field of cells – hover a part to light it up, remove files, and compact the conversation while its cells shimmer and clear

```tsx
import { … } from "@/components/context-window";
```

| Name | Type | Description |
| --- | --- | --- |
| parts | `ContextPart[]` | Bands of the context, top of the list first. |
| limit | `number` | Total size of the window in tokens. |
| title | `string` |  |
| model | `{ name: string; icon?: ReactNode }` | The model the window belongs to. The mark defaults to Anthropic's. |
| cells | `number` | Cells in the field, laid out `columns` wide. |
| columns | `number` |  |
| narrowColumns | `number` | Columns once the card is narrower than 310px. |
| warnAt | `number` | Fill ratio at which the readout turns amber. |
| fullAt | `number` | Fill ratio at which it turns red. |
| onRemove | `(part: ContextPart, item: ContextItem) => void` | A file's remove control; the band's tokens arrive through props on the next render. |
| onCompact | `(part: ContextPart) => void \| Promise<void>` | Compaction: return a promise to hold the shimmer until the work has settled. |
| action | `{ label: string; onClick?: () => void }` |  |
| className | `string` |  |

#### Cost meter

<a id="cost-meter"></a>

`Core` · Components: What a session has actually spent, as a running figure with a rate sparkline and a per-model breakdown

```tsx
import { … } from "@/components/cost-meter";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Label above the figure |
| total | `number` | Total spent so far, in the currency's major unit |
| tokens | `number` | Tokens billed so far |
| elapsedSeconds | `number` | Seconds the session has been running |
| series | `readonly CostMeterPoint[]` | Spend per interval, oldest first – drives the sparkline and the recent rate |
| models | `readonly CostMeterModel[]` | Per-model split, shown largest cost first |
| currency | `string` | Symbol before every figure |
| intervalSeconds | `number` | Seconds one sparkline interval covers |
| className | `string` | Extra class on the root |

#### Decision Tree

<a id="decision-tree"></a>

`Pro` · Components: An agent stuck on a decision lays out its options as a tree – the consequences of each branch, the risky ones marked, its own pick highlighted – and you choose a path or write your own

```tsx
import { … } from "@/components/decision-tree";
```

| Name | Type | Description |
| --- | --- | --- |
| decisions | `Decision[]` | The queue; each entry is one question with its branches |
| onChoose | `(decision: Decision, choice: DecisionChoice) => string \| void \| Promise<string \| void>` | Called with the decision and the path taken – return a line for the agent's reply |
| allowOther | `boolean` | Shows the "Other…" branch with a field for your own instruction |
| title | `string` | Heading in the header row |
| className | `string` |  |

#### Delegate Board

<a id="delegate-board"></a>

`Pro` · Components: Hand work to your agents by dragging it onto them – each agent previews its new “busy until” time, or switch to Auto and every new task goes to whoever is free first

```tsx
import { … } from "@/components/delegate-board";
```

| Name | Type | Description |
| --- | --- | --- |
| agents | `DelegateAgent[]` |  |
| tasks | `DelegateTask[]` | Work still in the pile. Everything else lives in an agent's queue. |
| onAssign | `(taskId: string, agentId: string \| null) => void` | Called on every hand-off. `null` puts the task back in the pile. |
| auto | `boolean` | Controlled Auto switch. |
| defaultAuto | `boolean` |  |
| onAutoChange | `(auto: boolean) => void` |  |
| defaultPickedId | `string \| null` | Task shown as picked on first render – what a click or Enter would have selected. |
| defaultTargetAgentId | `string \| null` | Agent shown as the drop target on first render, so a preview is visible without input. |
| now | `number` | Clock to render against, in epoch ms. Defaults to the real one, ticking every 15s. |
| title | `string` |  |
| hint | `string` |  |
| pileLabel | `string` | Heading over the pile. |
| agentsLabel | `string` | Heading over the roster. |
| autoLabel | `string` |  |
| emptyLabel | `string` | Copy shown when nothing is left to hand over. |
| howTo | `string` | Screen-reader instructions attached to every task. |
| className | `string` |  |

#### Fan-out Grid

<a id="fan-out-grid"></a>

`Pro` · Components: One agent hands a big job to many workers – every task a cell on a live grid that fills in as they get through it, with retries, failures, cost and the time left, and the details of any task on hover

```tsx
import { … } from "@/components/fan-out-grid";
```

| Name | Type | Description |
| --- | --- | --- |
| tasks | `FanoutTask[]` |  |
| job | `string` | What the whole job does, beside the title – e.g. "Enrich 240 leads" |
| workers | `number` | How many workers run at once; the time left is worked out from it |
| now | `number` | The clock, in milliseconds from the start of the job |
| onRetry | `(ids: string[]) => void` | Gets the ids of every failed task once "Retry failed" is pressed |
| onSelect | `(task: FanoutTask \| null) => void` | A cell was reached (hover, arrow keys, click) – null when it is let go |
| formatCost | `(amount: number) => string` | Formats every cost, in the header and in the details |
| title | `string` | Heading of the bar |
| icon | `ReactNode` | A mark before the title, e.g. the agent's logo |
| className | `string` |  |

#### Goal tracker

<a id="goal-tracker"></a>

`Core` · Components: An objective with a token budget, a live clock, and pause, resume, complete and drop states

```tsx
import { … } from "@/components/goal-tracker";
```

| Name | Type | Description |
| --- | --- | --- |
| objective | `string` | What the goal is trying to reach, as the run stated it |
| status | `GoalStatus` | Where the goal stands; leave it out and the card owns the state itself |
| tokensUsed | `number` | Tokens spent on the goal so far |
| tokenBudget | `number` | Token ceiling for the goal; omit for a goal with no ceiling |
| timeUsedSeconds | `number` | Run time banked before this render, in seconds |
| onPause | `() => void` | Called when a running goal should stop counting |
| onResume | `() => void` | Called when a paused goal should run again, or a dropped one should be restored |
| onDrop | `() => void` | Called once the user confirms the drop; dropping discards the run's direction |
| onEditObjective | `(objective: string) => void` | Called with the committed objective text |
| className | `string` | Extra class on the root |

#### Guardrail editor

<a id="guardrail-editor"></a>

`Core` · Components: Ordered policy rules with a matcher and an action, plus a tester showing which rule fires on sample input

```tsx
import { … } from "@/components/guardrail-editor";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Heading over the rule list |
| rules | `GuardrailRule[]` | The rules in precedence order. Set this to own the list |
| defaultRules | `GuardrailRule[]` | Starting rules when the caller does not own the list |
| onRulesChange | `(rules: GuardrailRule[]) => void` | Called with the whole next list on every move and toggle |
| sample | `string` | Sample text. Set this to own the field |
| defaultSample | `string` | Starting sample text when the caller does not own the field |
| onSampleChange | `(sample: string) => void` | Called on every keystroke in the tester |
| onEvaluate | `(verdict: GuardrailVerdict) => void` | Called with the verdict each time the tester evaluates |
| className | `string` | Extra class on the root |

#### Human review queue

<a id="human-review-queue"></a>

`Core` · Components: A queue of items awaiting a human decision, worked through one at a time with keyboard shortcuts

```tsx
import { … } from "@/components/human-review-queue";
```

| Name | Type | Description |
| --- | --- | --- |
| items | `readonly ReviewItem[]` | The requests waiting for a person, in the order they should be worked |
| title | `string` | Heading in the bar |
| agent | `string` | Who queued them, shown next to the title |
| onDecide | `(decision: ReviewDecision) => void` | One request filed, with the verdict and the edited wording if there was one |
| onReopen | `() => void` | The queue was reopened after coming up empty |
| className | `string` | Extra class on the root |

#### Inline Diff

<a id="inline-diff"></a>

`Pro` · Components: AI edits to prose shown inline – struck and added words you accept or reject one by one, with keys, a popover and undo

```tsx
import { … } from "@/components/inline-diff";
```

| Name | Type | Description |
| --- | --- | --- |
| original | `string` | The prose as it is now |
| revised | `string` | The prose the AI suggests – diffed word by word against original |
| changes | `readonly DiffSegment[]` | Pre-computed segments, when the diff is not prose-to-prose |
| label | `string` | The suggestion line above the prose, e.g. "Suggested by AI · Make it shorter" |
| onAccept | `(index: number, change: DiffChange) => void` | One change accepted: index in the segments, and the words involved |
| onReject | `(index: number, change: DiffChange) => void` | One change rejected: index in the segments, and the words involved |
| onChange | `(text: string) => void` | Fired on every decision and undo with the prose so far – pending changes keep the original words |
| onDone | `(text: string) => void` | Fired when the last pending change is decided |
| ref | `Ref<InlineDiffHandle>` |  |
| className | `string` |  |

#### Memory graph

<a id="memory-graph"></a>

`Core` · Components: What an agent remembers as a node and link graph, with a detail panel for the selected entity

```tsx
import { … } from "@/components/memory-graph";
```

| Name | Type | Description |
| --- | --- | --- |
| nodes | `MemoryNode[]` | The remembered entities |
| links | `MemoryLink[]` | Relations between them; links to unknown ids are ignored |
| selectedId | `string \| null` | Selected node id, controlled; `null` means nothing is selected |
| onSelect | `(id: string \| null) => void` | Called with the chosen id, or `null` when the selection is cleared |
| title | `string` | Heading of the card |
| className | `string` | Extra class on the root |

#### Memory Panel

<a id="memory-panel"></a>

`Pro` · Components: What the assistant remembers about you, grouped and editable – a master switch, category filters, and on every memory edit in place, pause or forget with Undo on the tray

```tsx
import { … } from "@/components/memory-panel";
```

| Name | Type | Description |
| --- | --- | --- |
| memories | `Memory[]` | { id, text, category, source?, date?, paused? } – source and date are shown as given, e.g. "From chat" and "Oct 12" |
| onChange | `(memories: Memory[]) => void` | Called with the full list after any change. With it the panel shows exactly the memories you pass; without it the changes live inside the panel |
| onAdd | `(memory: Memory) => void` | A memory was added with New memory |
| onEdit | `(id: string, text: string) => void` | The text of a memory was edited and saved |
| onPause | `(id: string, paused: boolean) => void` | A memory was paused or resumed |
| onForget | `(id: string) => void` | A memory was forgotten – it can still come back with Undo |
| onUndo | `(memory: Memory) => void` | A forgotten memory was brought back with Undo, at its old place |
| enabled | `boolean` | The Use memory switch, controlled |
| defaultEnabled | `boolean` | Start state of the switch when it is not controlled |
| onEnabledChange | `(enabled: boolean) => void` | Called when the switch is flipped |
| categories | `string[]` | Order of the groups and the choices for new memories – defaults to the categories in the order they appear |
| title | `string` | Heading of the panel |
| maxHeight | `number` | Height of the list in px before it scrolls |
| undoFor | `number` | How long Undo stays in the last row after forgetting, in ms |
| addedSource | `string` | Source given to memories added in the panel; their date is today |
| action | `{ label: string; onClick: () => void }` | A button in the last row of the card – Undo takes its place for a moment after forgetting |
| className | `string` | Extra class on the root |

#### Parallel Attempts

<a id="parallel-attempts"></a>

`Pro` · Components: An agent tries the same task several ways at once and the best one wins – every attempt races as a row with its model, approach and live bar, then gets a score; the best is marked and picked, and you can switch to another

```tsx
import { … } from "@/components/parallel-attempts";
```

| Name | Type | Description |
| --- | --- | --- |
| attempts | `Attempt[]` | One per attempt, in the order the rows should race |
| task | `string` | What all of them try to do, after the title – e.g. "Fix the flaky checkout test" |
| title | `string` | Heading of the bar; defaults to "Best of <how many>" |
| picked | `string \| null` | Controlled pick – leave it out and the best finished attempt is picked on its own |
| onPick | `(attempt: Attempt) => void` | Another attempt was taken with "Use" |
| formatCost | `(amount: number) => string` | Formats every cost, per attempt and in the header total |
| className | `string` |  |

#### Permission Request

<a id="permission-request"></a>

`Pro` · Components: An agent asks for one specific right – who, why and exactly what will happen – and you allow it once, for an hour or always; then it folds into one line with the time left and Revoke

```tsx
import { … } from "@/components/permission-request";
```

| Name | Type | Description |
| --- | --- | --- |
| request | `PermissionRequestSpec` | The specific right being asked for. |
| decision | `RequestDecision \| null` | Controlled answer. Leave undefined to let the card answer itself. |
| defaultDecision | `RequestDecision \| null` | Starting answer when uncontrolled. |
| onAllow | `(grant: PermissionGrant) => void` | Called with the chosen scope when the request is allowed. |
| onDeny | `(reason: "user" \| "timeout") => void` | Called on Deny or Esc. |
| onRevoke | `() => void` | Called on Revoke; the card returns to asking. |
| onExpire | `() => void` | Called once when a timed grant runs out. |
| now | `number` | Clock for the time left. Leave undefined to tick every second. |
| className | `string` | Extra class on the root. |

#### Review Center

<a id="review-center"></a>

`Pro` · Components: A focused workspace for what your agents want to do – the queue sorted by risk, one item at a time with the shaky spans marked, Approve, Edit, Reject and Skip on single keys, a stamp as each one leaves and the next one rising in

```tsx
import { … } from "@/components/review-center";
```

| Name | Type | Description |
| --- | --- | --- |
| items | `CenterReviewItem[]` | Everything waiting – decided items take themselves out |
| onDecide | `(item: CenterReviewItem, result: ReviewResult) => void` | A decision was made: approved, rejected (with an optional reason) or skipped |
| onUndo | `(item: CenterReviewItem, result: ReviewResult) => void` | The last decision was taken back |
| reviewed | `number` | How many were reviewed before this session, e.g. earlier today |
| total | `number` | The total in the header – defaults to reviewed + items.length |
| title | `string` | Heading of the bar |
| sla | `number` | How long an item may wait before it turns – ms |
| now | `number` | The clock (epoch ms) – defaults to the real one, ticking every 10s |
| lowConfidence | `number` | Below this an item counts as Unsure |
| reasons | `string[]` | The quick reasons offered on R, picked with 1–4 |
| sort | `ReviewSort` | High risk first then oldest, oldest first, or as passed |
| filter | `ReviewFilter` | The queue's filter, controlled |
| defaultFilter | `ReviewFilter` | Starting filter when uncontrolled |
| onFilterChange | `(filter: ReviewFilter) => void` | The filter changed |
| peek | `boolean` | Open the first agent note when the center appears – default true |
| className | `string` | Extra class on the root |

#### Session replay

<a id="session-replay"></a>

`Core` · Components: A scrubber over a recorded session timeline, with a playhead, transport controls and the event under the playhead

```tsx
import { … } from "@/components/session-replay";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Heading over the transport |
| events | `readonly SessionEvent[]` | The recorded session, in any order; positions come from each event's `at` |
| duration | `number` | Length of the recording in ms; defaults to the last event plus a tail |
| value | `number` | Playhead position in ms. Omit to let the component hold it |
| onValueChange | `(at: number) => void` |  |
| playing | `boolean` | Whether the clock is running. Omit to let the component hold it |
| onPlayingChange | `(playing: boolean) => void` |  |
| selection | `SessionSpan \| null` | Marked range. Omit to let the component hold it |
| onSelectionChange | `(span: SessionSpan \| null) => void` |  |
| initialSpeed | `number` | Speed the clock starts at |
| className | `string` |  |

#### Subagent spawn

<a id="subagent-spawn"></a>

`Core` · Components: A parent agent fanning out N children, each with its own task and status, collapsing to a tally as they finish

```tsx
import { … } from "@/components/subagent-spawn";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Parent agent name in the header |
| tasks | `readonly Subagent[]` | The children that already exist when the parent mounts |
| batch | `number` | How many children one press of Spawn adds |
| slowest | `number` | Longest a child may run before it settles, in ms |
| onEvent | `(child: Subagent, event: SubagentEvent) => void` | Called when a child is spawned, settles or is cancelled |
| className | `string` |  |

#### Todo phases

<a id="todo-phases"></a>

`Core` · Components: Phases containing tasks, with per-item status, a live step and an attempt count

```tsx
import { … } from "@/components/todo-phases";
```

| Name | Type | Description |
| --- | --- | --- |
| phases | `readonly TodoPhase[]` | Phases exactly as the agent sent them; set_todos replaces the list wholesale |
| attempt | `number` | Reminder frame's attempt counter; the header appears only when this is set |
| maxAttempts | `number` | Ceiling the attempt counter runs against |
| onToggle | `(phase: string, item: TodoItem) => void` | Called with the phase name and the row that was activated; omit for a read-only list |
| className | `string` | Extra class on the root |

#### Tool Call Card

<a id="tool-call-card"></a>

`Free` · Components: An agent's tool call in one line – live timer, status and summary, folds open to highlighted arguments and result with copy, retry on errors and a group that sums them up

```tsx
import { … } from "@/components/tool-call-card";
```

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Tool name as the agent calls it, shown in mono – e.g. "search_web" |
| summary | `ReactNode` | Short human summary – e.g. "Searched the web for 'CRM pricing 2026'" |
| icon | `ReactNode` | Icon in the tile on the left – defaults to a wrench |
| status | `ToolCallStatus` |  |
| args | `unknown` | Arguments the tool was called with – objects are pretty-printed, JSON strings parsed |
| result | `unknown` | What the tool returned – objects are pretty-printed, JSON strings parsed, other text shown as is |
| error | `string` | Error message, shown when status is "error" |
| startedAt | `number` | When the call started (ms since epoch, e.g. Date.now()) – the live timer counts from here |
| duration | `number` | Final duration in ms – otherwise measured while the card shows "running" |
| defaultOpen | `boolean` | Start expanded (uncontrolled) |
| open | `boolean` | Expanded state (controlled) |
| onOpenChange | `(open: boolean) => void` |  |
| openOnError | `boolean` | Opens the card when the call fails and closes it again on the next run, unless someone toggled it |
| onRetry | `() => void` | Shows a Retry button next to the error |
| maxCodeHeight | `number` | Height in px after which arguments and result are capped with a fade and "Show all" |
| className | `string` |  |

#### Tool registry

<a id="tool-registry"></a>

`Core` · Components: The catalogue of tools an agent may call, with signatures, risk level and per-tool enablement

```tsx
import { … } from "@/components/tool-registry";
```

| Name | Type | Description |
| --- | --- | --- |
| tools | `RegisteredTool[]` | The tools attached to this agent |
| referenced | `string[]` | Ids the current agent has already called or planned to call |
| enabled | `string[]` | Controlled set of enabled ids. Omit to let the registry own the set |
| defaultEnabled | `string[]` | Initial set when the registry owns it. Defaults to every tool enabled |
| onEnabledChange | `(enabled: string[]) => void` | Called with the complete next set after any toggle |
| title | `string` | Registry heading |
| subtitle | `string` | One line under the heading, e.g. the agent and run |
| className | `string` |  |

#### Trace Waterfall

<a id="trace-waterfall"></a>

`Pro` · Components: Where the time and money of an agent run go – every LLM call, tool call and sub-agent as a bar on a live timeline, with tokens and cost per step, the slowest call marked and branches that fold into their parent

```tsx
import { … } from "@/components/trace-waterfall";
```

| Name | Type | Description |
| --- | --- | --- |
| root | `TraceSpan` | The whole run – the root span is the first row and everything hangs off it |
| now | `number` | The clock in ms from the start of the run – fixed for a replay, left out to tick from `startedAt` |
| startedAt | `number` | Epoch ms when the run started – without `now` the component keeps its own clock while it runs |
| collapsed | `readonly string[]` | Ids of folded spans, controlled |
| defaultCollapsed | `readonly string[]` | Spans folded before the first paint – uncontrolled |
| onCollapsedChange | `(collapsed: string[]) => void` | A branch was folded or opened |
| openId | `string \| null` | The span whose details are open, controlled |
| defaultOpenId | `string \| null` | The details open before the first paint – uncontrolled |
| onOpenChange | `(id: string \| null, span?: TraceSpan) => void` | A row was pressed, or the panel closed – `null` when nothing is open |
| markSlowest | `boolean` | Tags the slowest finished call – needs at least two of them to mean anything |
| minRange | `number` | The shortest time the axis shows, in ms – the run outgrows it in round steps |
| title | `string` | Heading in the bar |
| task | `string` | What the run was asked to do, next to the title |
| formatCost | `(amount: number) => string` | Money formatting for the values in the bars and the panel |
| className | `string` | Extra class on the root |

### Conversation

#### AI Answer

<a id="ai-answer"></a>

`Pro` · Components: Streamed answer with source cards, citation chips that preview their source, copy, regenerate, feedback and follow-ups

```tsx
import { … } from "@/components/ai-answer";
```

| Name | Type | Description |
| --- | --- | --- |
| question | `string` | The question the answer replies to – the card's title |
| sources | `AnswerSource[]` | Numbered in order: chip "1" and the "1" on the first card are the same source |
| answer | `string` | The markdown-ish answer. Blank lines make paragraphs, "- " lines a list, `**bold**` is heavier, and `[1]` or `[1,3]` (1-based) become citation chips. |
| streaming | `boolean` | More text is still coming: the answer will not settle once it has caught up |
| animate | `boolean` | Stream the text in word by word; false shows the whole answer at once |
| speed | `number` | Words per second while writing; the original demo writes at 38 |
| followUps | `string[]` | Related questions offered under the finished answer |
| onFollowUp | `(question: string) => void` |  |
| onRegenerate | `() => void` |  |
| onStop | `() => void` |  |
| onFeedback | `(value: "up" \| "down", reason?: string) => void` | Thumbs. A down vote opens the reason chips; guessing why is up to the caller |
| feedbackReasons | `string[]` | The chips under a down vote – "Not accurate", "Wrong source", … |
| onCopy | `(text: string) => void` | Called with the copied text: markup gone, sources numbered underneath |
| className | `string` |  |

#### Assistant Home

<a id="assistant-home"></a>

`Pro` · Screens: AI assistant start page: greeting, prompt box with tools, connected apps and suggestions

```tsx
import { … } from "@/components/assistant-home";
```

| Name | Type | Description |
| --- | --- | --- |
| greeting | `string` | Headline above the composer |
| placeholder | `string` | Placeholder in the prompt field |
| workspace | `string` | Workspace name; its first letter becomes the logo |
| user | `{ name: string; avatar?: string }` | Account at the bottom of the sidebar; without an avatar it shows initials |
| nav | `AssistantNavItem[]` | Sidebar menu items |
| active | `string` | Label of the menu item or project that is open |
| projects | `string[]` | Project list under the menu |
| suggestions | `AssistantSuggestion[]` | Chips under the composer, four on the first row and the rest on the second |
| models | `AssistantModel[]` | Models offered by the model menu |
| apps | `AssistantApp[]` | Connected apps; their marks sit next to Connect apps |
| plugins | `AssistantPlugin[]` | Plugins offered by the Plugins menu |
| folders | `AssistantFolder[]` | Folders offered by the Work in a folder menu |
| news | `{ kicker: string; title: string; more: string }` | Changelog card above the guide |
| guide | `{ title: string; percent: number; cheer: string }` | Progress card above the account |
| model | `string` | Selected model id; the component keeps its own state when omitted |
| value | `string` | Prompt text; the component keeps its own state when omitted |
| defaultValue | `string` | Initial prompt text in uncontrolled mode |
| messages | `AssistantMessage[]` | Thread turns; when given the parent owns them and should append in onSend |
| onSend | `(text: string, options: AssistantSendOptions) => void` | Called with the prompt and the composer settings when a turn is sent |
| onChange | `(text: string) => void` | Called on every edit of the prompt |
| onModelChange | `(id: string) => void` | Called when another model is picked |
| onNavigate | `(label: string) => void` | Called with a menu item or project label |
| onNewChat | `() => void` | Called when New chat is chosen, after the thread has been cleared |
| onSearch | `() => void` | Called when the search button is pressed |
| onWorkspace | `() => void` | Called when the workspace button is pressed |
| onAccount | `() => void` | Called when the account button is pressed |
| onInvite | `() => void` | Called when Invite people is pressed |
| onOpenGuide | `() => void` | Called when the getting-started card is pressed |
| onOpenChangelog | `() => void` | Called when Full changelog is pressed |
| onDismissNews | `() => void` | Called when the changelog card is dismissed |
| onDictate | `(listening: boolean) => void` | Called when dictation starts or stops; the mic pulses while it listens |
| className | `string` | Extra class on the root |

#### Attachment tray

<a id="attachment-tray"></a>

`Core` · Components: Composer attachments with upload progress, a rejected reason and an overflow chip

```tsx
import { … } from "@/components/attachment-tray";
```

| Name | Type | Description |
| --- | --- | --- |
| files | `readonly AttachmentFile[]` | Files in composer order |
| onRemove | `(id: string) => void` | Called with the file id once its exit has played |
| onRetry | `(id: string) => void` | Called to offer a rejected file to the bridge again |
| onOpen | `(id: string) => void` | Called when a ready file is opened in the viewer |
| maxVisible | `number` | Chips shown before the remainder folds into a +N chip |
| className | `string` | Extra class on the root |

#### Chat Composer

<a id="chat-composer"></a>

`Pro` · Components: Prompt composer with model picker, voice input, app connections and approval request

```tsx
import { … } from "@/components/chat-composer";
```

| Name | Type | Description |
| --- | --- | --- |
| value | `string` | The draft (controlled) |
| defaultValue | `string` | Starting draft when uncontrolled |
| onChange | `(value: string) => void` | Called with the whole draft on every keystroke and after dictation |
| onSend | `(message: string, model: ChatModel) => void` | Called with the trimmed message and the model that will answer it |
| models | `ChatModel[]` | Rows of the model menu |
| modelId | `string` | Chosen model id (controlled) |
| onModelChange | `(model: ChatModel) => void` | Called with the model the user picked |
| apps | `ChatApp[]` | Marks in the connect row, in order |
| connectLabel | `string` | Copy of the connect row |
| appsState | `ChatApps` | State of the app connection – done swaps the connect row for the project row (controlled; left out, a press walks idle → loading → done on its own) |
| onConnectApps | `() => void` | Called when the connect row is pressed |
| project | `string` | Copy of the project row |
| onSelectProject | `() => void` | Called when the project row is pressed |
| approval | `ChatApproval` | State of the approval chip (controlled) – left out, a press walks idle → loading → done |
| approvalLabel | `string` | Copy before access is granted |
| grantedLabel | `string` | Copy after access is granted |
| onRequestApproval | `() => void` | Called when the approval chip is pressed |
| onAttach | `() => void` | Called when the attachment button is pressed |
| recording | `boolean` | Whether the mic is open (controlled) – left out, the mic keeps its own state |
| heard | `string` | Transcript written over the field while dictating |
| onRecordingChange | `(recording: boolean) => void` | Called with the next recording state |
| onDictationCommit | `(text: string) => void` | Called with the transcript when the recording is kept |
| placeholder | `string` |  |
| maxLines | `number` | Lines the field grows to before it scrolls |
| className | `string` | Extra class on the root |

#### Cited Answer

<a id="cited-answer"></a>

`Pro` · Components: An AI answer wired to its sources – point at a citation to light up its sentence and source, click to unfold the quoted passage with the matching words marked

```tsx
import { … } from "@/components/cited-answer";
```

| Name | Type | Description |
| --- | --- | --- |
| sentences | `CitedSentence[]` | The answer, one entry per sentence; markers are appended from `cites` |
| sources | `CitedSource[]` | The sources, in citation-number order |
| pagesRead | `number` | Pages read, shown beside the source count |
| activeSource | `string \| null` | Source kept lit while nothing is pointed at |
| openSource | `string \| null` | Open source id; omit to let the card own the state |
| defaultOpenSource | `string \| null` | Source unfolded on first render when the card owns the state |
| onOpenSourceChange | `(id: string \| null) => void` |  |
| action | `{ label?: string; onClick?: () => void }` | Footer action; "Follow up" by default |
| onCopyQuote | `(source: CitedSource) => void` | Called with the source once its quote is copied |
| label | `string` | Accessible name for the card |
| className | `string` |  |

#### Comment Thread

<a id="comment-thread"></a>

`Free` · Components: One comment with replies – an assistant reports what it did, folds open details and answers @mentions

```tsx
import { … } from "@/components/comment-thread";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` |  |
| messages | `ThreadMessage[]` |  |
| currentUser | `ThreadAuthor` |  |
| assistant | `ThreadAuthor` | The assistant that answers – used for the thinking state |
| onReply | `(text: string) => ThreadMessage \| Promise<ThreadMessage \| void> \| void` | Called with every new reply. Return a message (or a promise of one) to let the assistant answer; return nothing to just post the reply. |
| onClose | `() => void` |  |
| className | `string` |  |

#### Comments Panel

<a id="comments-panel"></a>

`Pro` · Components: Comment feed with filters, runnable /edit commands, resolve and a composer

```tsx
import { … } from "@/components/comments-panel";
```

| Name | Type | Description |
| --- | --- | --- |
| comments | `PanelComment[]` | Every comment – the panel filters and orders them itself |
| filter | `CommentFilter` | Active tab – controlled when given |
| defaultFilter | `CommentFilter` | Tab the panel starts on when `filter` is not controlled |
| onFilterChange | `(filter: CommentFilter) => void` |  |
| sort | `CommentSort` | Feed order – controlled when given |
| defaultSort | `CommentSort` | Order the panel starts on when `sort` is not controlled |
| onSortChange | `(sort: CommentSort) => void` |  |
| onResolve | `(comment: PanelComment, resolved: boolean) => void` | Resolve or reopen a comment; the panel also updates its own copy |
| onRunEdit | `(comment: PanelComment) => Promise<void> \| void` | Runs an /edit comment. The button spins until the returned promise settles – return one when the work is async. Without a handler the panel demonstrates the run itself. |
| onSend | `(text: string) => void` | Called with the trimmed composer text. Supplying it hands the feed to you: add the comment to `comments` yourself. Without it the panel appends the comment locally. |
| currentUser | `CommentAuthor` | Author shown next to the composer and on comments the panel adds itself |
| title | `string` |  |
| maxHeight | `number` | Tallest the feed window grows before it scrolls, in px |
| onClose | `() => void` |  |
| className | `string` |  |

#### Compaction divider

<a id="compaction-divider"></a>

`Core` · Components: The in-transcript compaction marker: reason, method, token delta, failure and a running sweep

```tsx
import { … } from "@/components/compaction-divider";
```

| Name | Type | Description |
| --- | --- | --- |
| reason | `CompactionReason` | Why the bridge compacted: the threshold was reached, the window overflowed, the run went idle, or a turn was left incomplete |
| action | `CompactionAction` | How it compacted: which strategy produced the summary |
| status | `CompactionStatus` | Where the compaction is; a skipped compaction draws nothing at all |
| tokensBefore | `number` | Tokens the window held before the compaction |
| tokensAfter | `number` | Tokens the window holds after the compaction |
| shortSummary | `string` | The summary the compaction kept, revealed when the chip is expanded |
| error | `string` | Message from the failed end frame, shown under the rule |
| onRetry | `() => void` | Retry the compaction; the button is only drawn when this is given |
| expanded | `boolean` | Own the expanded state from outside; omit to let the divider hold it |
| onExpandedChange | `(expanded: boolean) => void` | Called with the next expanded state, whether the divider or the caller holds it |
| className | `string` | Extra class on the root |

#### Email Draft

<a id="email-draft"></a>

`Free` · Components: Agent-written email for review – switch recipient and tone, edit inline, remove the attachment, send or discard with undo

```tsx
import { … } from "@/components/email-draft";
```

| Name | Type | Description |
| --- | --- | --- |
| reference | `string` | Reference of the record, e.g. a subscription or invoice number |
| account | `string` | Account or company under the reference |
| amount | `string` | Amount shown on the right |
| status | `string` | Status chip next to the reference |
| agent | `string` | Who wrote the draft |
| contacts | `DraftContact[]` |  |
| attachment | `string \| null` |  |
| tones | `DraftTone[]` | Text variants to switch between – the first one is shown first |
| link | `{ label: string; href: string }` | Label and target of the link appended to the email |
| onSend | `(email: { to: DraftContact; body: string; attachment: string \| null }) => void` |  |
| onDiscard | `() => void` |  |
| className | `string` |  |

#### Entry actions

<a id="entry-actions"></a>

`Core` · Components: The per-message action row: fork, branch, copy and jump, disabled while the session is busy

```tsx
import { … } from "@/components/entry-actions";
```

| Name | Type | Description |
| --- | --- | --- |
| onFork | `() => void` | Fork the session from this entry; the action is disabled while a turn runs |
| onBranch | `() => void` | Start a named branch from this entry; disabled while a turn runs |
| onCopy | `() => void` | Copy this entry's text; the row flashes Copied when the click lands |
| onJump | `() => void` | Scroll the transcript back to this entry |
| canFork | `boolean` | Whether a fork is possible from this entry; defaults to true |
| canBranch | `boolean` | Whether a branch is possible from this entry; defaults to true |
| canCopy | `boolean` | Whether the entry has copyable text; defaults to true |
| canJump | `boolean` | Whether the entry has somewhere to jump to; defaults to true |
| streaming | `boolean` | The turn is still running, so `fork` and `branch` would answer `session_busy` |
| copied | `boolean` | Hold the copied confirmation on; omit to let the row run its own 1.2 s flash |
| entryId | `string` | Id of the entry, written to the clipboard by Copy entry id |
| className | `string` | Extra class on the root |

#### File mention

<a id="file-mention"></a>

`Core` · Components: Inline file cards with path, line count, an expandable preview and a skipped reason

```tsx
import { … } from "@/components/file-mention";
```

| Name | Type | Description |
| --- | --- | --- |
| files | `readonly FileMentionFile[]` | Files carried by the message, in the order they were mentioned |
| onOpen | `(path: string) => void` | Called with the path when a card body is pressed; omit to leave bodies inert |
| onRemove | `(path: string) => void` | Called with the path when a card's remove control is pressed; omit to hide it |
| className | `string` | Extra class on the root |

#### Ghost text

<a id="ghost-text"></a>

`Core` · Components: Inline word completion aligned to the caret, accepted with Tab and dismissed with Escape

```tsx
import { … } from "@/components/ghost-text";
```

| Name | Type | Description |
| --- | --- | --- |
| value | `string` | Current text; omit it and the component keeps its own |
| suggestion | `string` | Completion suffix drawn after the caret; empty hides the ghost |
| visible | `boolean` | Whether the host is offering completions right now |
| onAccept | `(suffix: string) => void` | Called with the accepted suffix when Tab takes it |
| onDismiss | `() => void` | Called when Escape drops the suggestion |
| onChange | `(next: string) => void` | Called with the next text, typed or accepted |
| placeholder | `string` | Placeholder while the field is empty; also names the field for assistive tech |
| multiline | `boolean` | Wrap and grow with content; false renders a single-line input |
| className | `string` | Extra class on the root |

#### Group chat

<a id="group-chat"></a>

`Core` · Components: A shared thread where several agents and one human talk, with per-speaker identity and a reply target

```tsx
import { … } from "@/components/group-chat";
```

| Name | Type | Description |
| --- | --- | --- |
| participants | `GroupChatParticipant[]` | Every speaker, in roster order, the human among them |
| messages | `GroupChatMessage[]` | The starting thread; messages the human sends are appended to it. Pass a new array to feed the thread from outside |
| selfId | `string` | The participant whose drafts come from the composer, marked "You" |
| draft | `string` | The draft (controlled); left out, the composer holds it |
| onDraftChange | `(draft: string) => void` | Called with the whole draft on every keystroke |
| onSend | `(message: GroupChatMessage) => void` | Called with the message the human sent, after it lands in the thread |
| title | `string` | Heading over the thread |
| rosterTitle | `string` | Heading over the roster |
| placeholder | `string` | Placeholder in the composer |
| className | `string` |  |

#### Message Actions

<a id="message-actions"></a>

`Free` · Components: The quiet bar under an AI message – copy turns into a check, regenerate spins and unfolds a version switcher, thumbs pop and ask why, read aloud becomes a tiny equalizer

```tsx
import { … } from "@/components/message-actions";
```

| Name | Type | Description |
| --- | --- | --- |
| text | `string` | The message text – copied to the clipboard by Copy and used to time Read aloud |
| actions | `MessageActionKey[]` | Which actions to show, in this order |
| versions | `number \| string[]` | All versions of the message, or just how many there are. From 2 on the version switcher shows |
| version | `number` | Controlled version (0-based index) |
| defaultVersion | `number` | Starting version when uncontrolled – defaults to the newest |
| onVersionChange | `(index: number) => void` | Called with the version index picked in the switcher |
| onCopy | `(text?: string) => void` | Called after Copy, with `text` |
| onRegenerate | `() => void` | Called when Regenerate is pressed – add a version and the switcher jumps to it |
| regenerating | `boolean` | Keeps the regenerate arrow spinning while a new version is written |
| onFeedback | `(kind: FeedbackKind \| null, reason?: string) => void` | "up" or "down" when a thumb is pressed, null when it is taken back, and "down" with a reason when the feedback row is sent |
| reasons | `string[]` | Quick reasons in the feedback row. "Other" opens a small text field |
| onSpeak | `(playing: boolean) => void` | Called with true when Read aloud starts and false when it stops |
| speaking | `boolean` | Controlled playing state, e.g. tied to your speech player |
| speakDuration | `number` | How long an uncontrolled read aloud plays, in ms – defaults to an estimate from `text` |
| quiet | `boolean` | Faded until the message is hovered (default true). Put data-ui-message on the message wrapper |
| label | `string` | Accessible name of the bar |
| className | `string` |  |

#### Model Picker

<a id="model-picker"></a>

`Pro` · Components: The model menu of an AI chat – point at a model and its speed, quality and cost bars fill, switch on extended thinking and its effort unfolds, while the tray rolls the first-token time and price

```tsx
import { … } from "@/components/model-picker";
```

| Name | Type | Description |
| --- | --- | --- |
| models | `PickerModel[]` | The models to choose from – rows keep this order |
| value | `string` | Id of the chosen model (controlled) |
| defaultValue | `string` | Chosen model when uncontrolled |
| onChange | `(id: string, model: PickerModel \| undefined) => void` | Called with the picked model's id, and the model itself |
| thinking | `boolean` | Extended thinking switch (controlled) |
| defaultThinking | `boolean` | Starting state of the thinking switch |
| onThinkingChange | `(on: boolean) => void` | Called when the thinking switch flips |
| webSearch | `boolean` | Web search switch (controlled) |
| defaultWebSearch | `boolean` | Starting state of the web search switch |
| onWebSearchChange | `(on: boolean) => void` | Called when the web search switch flips |
| effort | `PickerEffort` | Thinking effort (controlled) – the control only unfolds while thinking is on |
| defaultEffort | `PickerEffort` | Starting effort |
| onEffortChange | `(effort: PickerEffort) => void` | Called with the new effort |
| open | `boolean` | Controlled open state of the menu |
| defaultOpen | `boolean` | Starts open when uncontrolled |
| onOpenChange | `(open: boolean) => void` | Called when the menu opens or closes |
| align | `"start" \| "end"` | Which edge of the trigger the card lines up with |
| side | `"bottom" \| "top"` | Opens below or above the trigger – use top for a composer at the foot of the screen |
| className | `string` | Extra class on the root |

#### Reaction Bar

<a id="reaction-bar"></a>

`Free` · Components: Like, comment, repost and share in one pill – icons pop and fill, counts roll in digit by digit

```tsx
import { … } from "@/components/reaction-bar";
```

| Name | Type | Description |
| --- | --- | --- |
| reactions | `Partial<Record<ReactionKey, ReactionState>>` | Starting counts and whether each action is already taken |
| onReact | `(key: ReactionKey, state: Required<ReactionState>) => void` | Called after an action was toggled, with its new state |
| actions | `ReactionKey[]` | Hide actions you don't need |
| className | `string` |  |

#### Reasoning block

<a id="reasoning-block"></a>

`Core` · Components: A collapsible reasoning block with duration, tokens, narration promoted to answer text, and a redacted placeholder

```tsx
import { … } from "@/components/reasoning-block";
```

| Name | Type | Description |
| --- | --- | --- |
| text | `string` | The reasoning as it arrived; prose with its own line breaks, never markdown |
| narration | `string` | Narration the model addressed to the user but returned as thinking, promoted to answer text |
| summary | `boolean` | The provider shortened `text` before sending it, so the block says so |
| redacted | `boolean` | The provider withheld the reasoning; the body becomes a locked placeholder |
| durationMs | `number` | Milliseconds spent thinking, from the assistant message's `duration` |
| tokens | `number` | Tokens spent on the thinking block, shown beside the duration |
| defaultOpen | `boolean` | Start the block unfolded; a block carrying narration starts unfolded either way |
| open | `boolean` | Open state owned by the caller; omit to let the block keep its own |
| onOpenChange | `(open: boolean) => void` | Called with the next open state whenever the header is pressed |
| onCopy | `(text: string) => void` | Called with the reasoning text when Copy is pressed, before the clipboard write |
| className | `string` | Extra class on the root |

#### Side question

<a id="side-question"></a>

`Core` · Components: A stack of aside questions with a streaming answer, cancel, and an interrupted note

```tsx
import { … } from "@/components/side-question";
```

| Name | Type | Description |
| --- | --- | --- |
| records | `readonly SideQuestionRecord[]` | Asides in the stack, newest first; the first one is always expanded |
| onAsk | `(question: string) => void` | Called with the trimmed question on submit, on a follow-up, and on "Ask again" |
| onCancel | `(id: string) => void` | Called with the record id when the reader stops a running aside |
| draft | `string` | Controlled draft; omit to let the component own the field |
| onDraftChange | `(draft: string) => void` | Fires on every draft change, including the clear after submit |
| className | `string` | Extra class on the root |

#### Slash palette

<a id="slash-palette"></a>

`Core` · Components: A slash-triggered autocomplete over the runtime command catalog, with argument hints and source badges

```tsx
import { … } from "@/components/slash-palette";
```

| Name | Type | Description |
| --- | --- | --- |
| commands | `readonly SlashCommand[]` | Commands exactly as available_commands_update reported them |
| query | `string` | Text typed after the slash, owned by the composer field; a leading "/" is ignored |
| onPick | `(command: SlashCommand) => void` | Called with the command the user picked |
| onClose | `() => void` | Called when Escape, Tab or a click dismisses the palette |
| maxVisible | `number` | Rows shown before the list scrolls; the panel never grows past this |
| className | `string` | Extra class on the root |

#### Smart Recommendation

<a id="smart-recommendation"></a>

`Free` · Components: Suggestion card with a confidence signal, alternatives to switch to and accept with undo

```tsx
import { … } from "@/components/smart-recommendation";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` |  |
| options | `Recommendation[]` | First entry is the recommendation, the rest are offered as alternatives |
| onAccept | `(option: Recommendation) => void` |  |
| onUndo | `(option: Recommendation) => void` |  |
| defaultOpen | `boolean` |  |
| className | `string` |  |

#### Thinking Loader

<a id="thinking-loader"></a>

`Free` · Components: A small working pill for AI replies – an eight-ray spinner and a shimmering label that rolls through phases and settles on a check

```tsx
import { … } from "@/components/thinking-loader";
```

| Name | Type | Description |
| --- | --- | --- |
| phases | `string[]` | Labels to walk through, one after another |
| interval | `number` | Time per phase, in ms |
| phase | `number` | Show a specific phase instead of advancing on a timer – e.g. from your stream events |
| loop | `boolean` | Start over after the last phase instead of holding it |
| done | `boolean` | Finished: the spinner turns into a check and the label into doneLabel |
| doneLabel | `string \| ((seconds: number) => string)` | Label once done – a string, or a function that gets the seconds since the loader started |
| size | `"sm" \| "md"` |  |
| variant | `"pill" \| "plain"` | "pill" = bordered capsule, "plain" = just the spinner and the label, e.g. inside a chat bubble |
| className | `string` |  |

#### Thinking State

<a id="thinking-state"></a>

`Pro` · Components: AI working panel with a live timer, searched sources and thinking steps that appear one by one

```tsx
import { … } from "@/components/thinking-state";
```

| Name | Type | Description |
| --- | --- | --- |
| steps | `ThinkingStep[]` | The trail, in the order the steps surface |
| sources | `ThinkingSource[]` | Pages the run found, shown under the first search step |
| done | `boolean` | Force the run to its end: the mark settles, every row lands and the clock freezes |
| onDone | `(seconds: number) => void` | Seconds on the clock, called once when the run lands |
| stepMs | `number` | How long each step stays in the active slot before the next surfaces |
| sourceLimit | `number` | Chips shown before the rest fold into "+N more" |
| label | `string` | Header copy while the run is live |
| doneLabel | `string` | Header copy once the run lands |
| defaultOpen | `boolean` | Whether the trail starts unfolded |
| className | `string` |  |

#### Voice session

<a id="voice-session"></a>

`Core` · Components: Live voice phase, input and output level meters, streaming captions, mute and stop

```tsx
import { … } from "@/components/voice-session";
```

| Name | Type | Description |
| --- | --- | --- |
| phase | `LivePhase` | What the session is doing — `live_phase`. Omit it and the component holds the phase itself, which is enough for a caller that only needs the mute toggle. |
| inputLevel | `number` | Input RMS from 0 to 1 — `live_levels.input` |
| outputLevel | `number` | Output RMS from 0 to 1 — `live_levels.output` |
| captions | `readonly VoiceCaption[]` | Transcript lines in arrival order — `live_transcript` |
| onMute | `() => void` | Sends `live_mute`; omit it and the mute control is not rendered |
| onStop | `() => void` | Sends `live_stop`; omit it and the stop control is not rendered |
| error | `string` | Message from `live_end` when the session ended on an error |
| className | `string` | Extra class on the root |

#### Writing Assistant

<a id="writing-assistant"></a>

`Pro` · Components: AI chat card with a soft gradient glow, suggestions, streaming replies and live voice dictation

```tsx
import { … } from "@/components/writing-assistant";
```

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Assistant name beside the gradient mark |
| tagline | `string` | Line under the name |
| greeting | `string` | Headline on the welcome view |
| suggestions | `string[]` | Chips under the greeting – each one sends itself as a message |
| placeholder | `string` | Placeholder in the prompt field |
| initialMessages | `WritingMessage[]` | Conversation the card opens with; an empty list shows the welcome view |
| onSend | `(message: string) => string \| void \| Promise<string \| void>` | Called with the sent message. Return (or resolve to) the reply to stream back; return nothing to use the built-in sample writer. |
| speech | `"auto" \| "simulate"` | "auto" asks the browser for a speech service, "simulate" always types a sample take |
| dictation | `string` | The sample take typed into the field when no speech service is available |
| className | `string` | Extra class on the root |

### Workspace

#### AI Workspace

<a id="ai-workspace"></a>

`Pro` · Blocks: Complete assistant app – sidebar, welcome, streaming chat and projects, built on the Chat Composer

```tsx
import { … } from "@/components/ai-workspace";
```

| Name | Type | Description |
| --- | --- | --- |
| userName | `string` | Name in the sidebar footer and the welcome heading |
| userAvatar | `string` | Avatar image for the footer; initials are drawn when it is left out |
| workspace | `string` | Letter on the workspace chip |
| assistants | `string[]` | Pinned assistants in the sidebar |
| projects | `WorkspaceProject[]` | Project library |
| chats | `WorkspaceChat[]` | Recent conversations in the sidebar |
| models | `WorkspaceModel[]` | Rows of the composer's model menu |
| starters | `string[]` | Chips under the welcome composer |
| disclaimer | `string` | Small print under the composer |
| respond | `(prompt: string, model: WorkspaceModel) => string` | Canned answer for a prompt – the default composes one from the workspace context |
| className | `string` | Extra class on the root |

#### App Directory

<a id="app-directory"></a>

`Pro` · Blocks: Browse, search and connect integrations – categories, filters and app cards with a connect flow

```tsx
import { … } from "@/components/app-directory";
```

| Name | Type | Description |
| --- | --- | --- |
| apps | `AppDirectoryApp[]` | The catalogue; defaults to the reference apps |
| categories | `AppDirectoryCategory[]` | Rail entries; defaults to the reference categories |
| title | `string` | Card heading and section label |
| subtitle | `ReactNode` | Sentence above the toolbar; the "Learn more" link follows it |
| learnMoreHref | `string \| null` | Where "Learn more" points; pass null to drop the link |
| discover | `AppDirectoryDiscover \| null` | The dashed discover tile; pass null to drop it |
| onConnect | `(app: AppDirectoryApp) => void \| Promise<void>` | Fired when a Connect press settles; wire it to mark the app connected |
| onDisconnect | `(app: AppDirectoryApp) => void \| Promise<void>` | Fired when a Disconnect press settles; wire it to clear the app's connected flag |
| className | `string` | Extra class on the root |

#### App Shell Flat

<a id="app-shell-flat"></a>

`Pro` · Screens: The App Shell laid flat – gray sidebar and an edge-to-edge page, split by a single hairline

```tsx
import { … } from "@/components/app-shell-flat";
```

| Name | Type | Description |
| --- | --- | --- |
| children | `ReactNode` | The page shown to the right of the sidebar; without it the placeholder page renders |
| active | `string` | Label of the menu item or project that is open |
| onNavigate | `(label: string) => void` | Called with the label of a menu item or project when it is clicked |
| workspace | `string` | Workspace name; its first letter becomes the logo |
| workspaces | `string[]` | Workspaces offered by the switcher |
| user | `{ name: string; avatar?: string }` | Account at the bottom; without an avatar it shows initials |
| nav | `FlatShellNavItem[]` | Menu items of the top group, each { label, icon } |
| projects | `string[]` | Project labels under the Projects heading |
| pageTitle | `string \| null` | Page heading. Omitted: "Overview" when the shell has no children, no heading when it has. Pass null to leave it out either way. |
| pageSub | `string \| null` | Page standfirst, derived the same way as pageTitle |
| empty | `{ title: string; text: string } \| null` | Placeholder shown instead of children; null removes it |
| news | `ShellNews \| null` | The announcement card above the guide; null removes it |
| guide | `ShellGuide \| null` | The onboarding progress card; null removes it |
| onSearch | `() => void` | Called when the search button in the sidebar header is clicked |
| className | `string` | Extra class on the root |

#### App Shell Inset

<a id="app-shell"></a>

`Pro` · Screens: Collapsible sidebar with workspace, menu, projects and account – the frame every screen sits in

```tsx
import { … } from "@/components/app-shell";
```

| Name | Type | Description |
| --- | --- | --- |
| children | `ReactNode` | The page shown in the inset card next to the sidebar |
| active | `string` | Label of the menu item or project that is open |
| onNavigate | `(label: string) => void` | Called with the label of a menu item or project when it is clicked |
| workspace | `string` | Workspace name; its first letter becomes the logo |
| user | `{ name: string; avatar?: string }` | Account at the bottom; without an avatar it shows initials |
| nav | `ShellNavItem[]` | Menu items, each { label, icon } |
| projects | `string[]` | Project list under the menu |
| collapsed | `boolean` | Controls the collapsed sidebar; the shell keeps its own state when omitted |
| onCollapsedChange | `(collapsed: boolean) => void` | Called when the collapse toggle or the floating reopen button is used |
| workspaces | `ShellWorkspace[]` | Workspaces listed in the switcher popover |
| onWorkspaceChange | `(name: string) => void` | Called with the name of a workspace picked in the switcher |
| onCreateWorkspace | `() => void` | Called when Create workspace is picked in the switcher |
| onAccountAction | `(action: "profile" \| "settings" \| "help" \| "sign-out") => void` | Called with the action picked in the account popover |
| className | `string` | Extra class on the root |

#### Auth panel

<a id="auth-panel"></a>

`Core` · Components: Provider sign-in rows with a browser handoff state and per-account sign-out

```tsx
import { … } from "@/components/auth-panel";
```

| Name | Type | Description |
| --- | --- | --- |
| providers | `readonly AuthProvider[]` | Providers from `get_login_providers`, in row order |
| onLogin | `(providerId: string) => void` | Called with the provider id when Sign in is pressed |
| onLogout | `(providerId: string, credentialId: string) => void` | Called with the provider and credential id when an account is signed out |
| pendingProviderId | `string` | Provider whose login is in flight; its row waits on the browser handoff |
| notice | `ReactNode` | Quiet line shown after a logout, e.g. "Still signed in via github-copilot" |
| expandedId | `string \| null` | Expanded provider when the caller owns the disclosure; omit for internal state |
| onExpandedChange | `(providerId: string \| null) => void` | Called with the next expanded provider id, or null when a row folds shut |
| className | `string` | Extra class on the root |

#### Client Context

<a id="client-context"></a>

`Pro` · Blocks: A client workspace with live numbers and a shared context timeline – switch clients, search, filter and add notes or files

```tsx
import { … } from "@/components/client-context";
```

| Name | Type | Description |
| --- | --- | --- |
| clients | `CxClient[]` | Every client in the switcher; the first one is open |
| me | `CxActor` | Author of the notes written here; without an avatar the initials show |
| timeline | `CxEntry[]` | Timeline of the open client, when it is not stored on the client |
| syncedAt | `string` | The sync stamp in the header, e.g. "3m ago" |
| onAddNote | `(clientId: string, text: string, files: CxFile[]) => void` | Called after a note is added; the entries are already in the feed |
| onCreateClient | `(name: string) => void` | Called when a client is created from the switcher |
| onOpenReport | `(clientId: string, reportId: string) => void` | Called when a report is opened from a mention or its own action |
| className | `string` | Extra class on the root |

#### CRM

<a id="crm"></a>

`Pro` · Screens: Company list with pipelines, open views as tabs and an editable data table

```tsx
import { … } from "@/components/crm";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` | Extra class on the root |
| workspace | `string` | Workspace name; its first letter becomes the logo |
| user | `{ name: string; avatar?: string }` | Account at the bottom of the sidebar |
| nav | `CrmNavItem[]` | Records listed above the pipelines; the item matching `active` is highlighted |
| active | `string` | Label of the highlighted sidebar item |
| pipelines | `CrmPipeline[]` | Pipelines listed under the sidebar label |
| workspaces | `string[]` | Other workspaces offered by the switcher |
| folder | `string` | Folder in the breadcrumb |
| viewLabel | `string` | View name in the breadcrumb |
| onNavigate | `(label: string) => void` | Called with the label of a sidebar item, workspace or account action |
| views | `CrmView[]` | Views open as tabs; defaults to the four saved views |
| defaultView | `string` | Id of the view open first |
| onSelectView | `(id: string) => void` | Called when another tab is picked |
| onNewView | `() => void` | Called by the New view button instead of opening a local view |
| onCloseView | `(id: string) => void` | Called by the menus' close action instead of closing a local view |
| columns | `CrmColumn[]` | Table columns; defaults to the company list |
| rows | `CrmRow[]` | Rows of the table |
| tagTones | `Record<string, CrmTagTone>` | Tag colour per tag text; unknown tags fall back to gray |
| title | `string` | Card heading; defaults to the open view's label |
| summary | `string` | Line under the table; defaults to a hint or the selection count |
| icon | `ReactNode` | Replaces the built-in columns glyph in the card header |
| editable | `boolean` | false keeps selection and sorting, but turns off editing and Add row |
| onRowsChange | `(rows: CrmRow[]) => void` |  |
| boardGroupBy | `string` | Column a board view groups by; defaults to the stage column |
| boardOrder | `string[]` | Order of the board columns |
| guide | `CrmGuide \| null` | Progress card at the bottom of the sidebar; null hides it |
| news | `CrmNews \| null` | Changelog card at the bottom of the sidebar; null hides it |
| onOpenGuide | `() => void` | Called when the progress card is clicked – expanding the guide is the owner's job |
| onOpenNews | `() => void` | Called by the changelog card's link |
| onToggleStar | `(starred: boolean) => void` | Called with the next favourite state |

#### Folder

<a id="folder"></a>

`Pro` · Screens: Inside one folder: breadcrumbs, file cards with previews, and an empty state

```tsx
import { … } from "@/components/folder";
```

| Name | Type | Description |
| --- | --- | --- |
| folder | `string` | Folder that is open; also the last breadcrumb |
| trail | `string[]` | Crumb labels above it, each a button |
| backLabel | `string` | Label of the back link that leaves the folder |
| files | `FolderFile[]` | Files in the folder, in display order |
| empty | `{ title: string; text: string }` | Copy for the state shown when the folder is empty |
| workspace | `string` | Workspace name; its first letter becomes the logo tile |
| projects | `string[]` | Project list under the menu |
| active | `string` | Label marked current in the sidebar; falls back to the folder |
| user | `{ name: string; initials: string }` | Account at the bottom of the sidebar |
| news | `FolderNews \| null` | "New in …" card, or null to leave it out |
| guide | `FolderGuide \| null` | Onboarding checklist, or null to leave it out |
| collapsed | `boolean` | Folds the sidebar to the icon rail; the screen keeps its own state when omitted |
| onCollapsedChange | `(collapsed: boolean) => void` | Called with the sidebar's new folded state |
| className | `string` | Extra class on the root |
| onNavigate | `(label: string) => void` | Called with the label of a crumb, menu item or project |
| onBack | `() => void` | Called when the back link is used |
| onOpenFile | `(file: FolderFile) => void` | Called with the file whose card was picked |
| onShare | `() => void` | Called when Share is picked |
| onMore | `() => void` | Called when the overflow button is picked |
| onUpload | `(files: File[]) => void` | Called with the files picked in the hidden input |
| onDismissNews | `() => void` | Called when the news card is dismissed |
| onOpenGuide | `() => void` | Called when the checklist is opened |
| onAccount | `() => void` | Called when the account is picked |
| onWorkspace | `() => void` | Called when the workspace switcher is picked |
| onSearch | `() => void` | Called when the sidebar search button is picked |

#### Folders

<a id="files"></a>

`Pro` · Screens: Folder overview with tabs, search, sort, grid/list toggle and file templates

```tsx
import { … } from "@/components/files";
```

| Name | Type | Description |
| --- | --- | --- |
| workspace | `string` | Workspace name in the switcher; its first letter becomes the logo |
| user | `{ name: string; avatar?: string }` | Account at the bottom of the sidebar |
| workspaces | `{ name: string; meta?: string }[]` | Workspaces offered by the switcher |
| nav | `{ label: string; icon?: FilesNavIcon }[]` | Menu rows above the projects |
| projects | `string[]` | Project folders under the Projects label |
| active | `string` | Row highlighted as the current page, e.g. "Folders" |
| folders | `FolderItem[]` | Folders in the overview; the component keeps its own copy when omitted |
| templates | `TemplateItem[]` | Templates in the second section; the component keeps its own copy when omitted |
| defaultView | `FilesView` | Layout the grid starts in |
| guideProgress | `number` | Progress in the getting-started card, 0–100 |
| guideCheer | `string` | Cheer line under the progress label |
| collapsed | `boolean` | Sidebar folded away; the screen keeps its own state when omitted |
| onCollapsedChange | `(collapsed: boolean) => void` | Called when the collapse toggle or the floating reopen button is used |
| onNavigate | `(label: string) => void` | Called with the label of a menu row or project |
| onOpenFolder | `(folder: FolderItem) => void` | Called when a folder card is picked |
| onOpenTemplate | `(template: TemplateItem) => void` | Called when a template card is picked |
| onCreateFolder | `(folder: FolderItem) => void` | Called with the folder Create folder appended |
| onAddTemplate | `(template: TemplateItem) => void` | Called with the template Add template appended |
| onOpenGuide | `() => void` | Called when the getting-started card is picked |
| onWorkspaceChange | `(name: string) => void` | Called with a workspace picked in the switcher |
| onCreateWorkspace | `() => void` | Called when Create workspace is picked in the switcher |
| onAccountAction | `(action: "profile" \| "settings" \| "help" \| "sign-out") => void` | Called with the action picked in the account menu |
| onBrowseChanges | `() => void` | Called when Full changelog is picked on the news card |
| className | `string` | Extra class on the root |

#### Image viewer

<a id="image-viewer"></a>

`Core` · Components: A lightbox with click-to-zoom, clamped panning, paging and a download link

```tsx
import { … } from "@/components/image-viewer";
```

| Name | Type | Description |
| --- | --- | --- |
| images | `readonly ImageViewerImage[]` | Images to page through, in order |
| index | `number` | Index to show; omit to let the viewer own it |
| open | `boolean` | Whether the lightbox is showing; omit to let the viewer own it and open on mount |
| onIndexChange | `(index: number) => void` | Called with the new index after a page, an arrow key, Home or End |
| onClose | `() => void` | Called when Escape, a scrim click or the close button asks to dismiss |
| className | `string` | Extra class on the root |

#### Integrations

<a id="integrations"></a>

`Pro` · Screens: App directory with a sticky header, categories, search and connect states

```tsx
import { … } from "@/components/integrations";
```

| Name | Type | Description |
| --- | --- | --- |
| sections | `IntegrationSection[]` | Sections and their apps; defaults to the reference directory |
| title | `string` | Page heading |
| subtitle | `string` | Line under the heading |
| searchPlaceholder | `string` | Placeholder and accessible name of the filter field |
| showCounts | `boolean` | Show a count inside each tab; the reference screen ships without them |
| connectDelayMs | `number` | How long the simulated handshake spins before the app reports connected |
| workspace | `string` | Workspace name in the sidebar; its first letter becomes the logo |
| projects | `string[]` | Project entries under the Projects label |
| user | `{ name: string; initials?: string }` | Account at the bottom of the sidebar |
| news | `IntegrationNews \| null` | Announcement card; pass null to take it out of the foot of the sidebar |
| guide | `IntegrationGuide \| null` | Progress card; pass null to take it out of the foot of the sidebar |
| onNavigate | `(label: string) => void` | Called with the label of a sidebar item, project or account action |
| onConnectionChange | `(item: IntegrationItem, connected: boolean) => void` | Called when a handshake finishes, or when a connected app is disconnected |
| onRequest | `(name: string) => void` | Called with the trimmed tool name when the request form is submitted |
| className | `string` | Extra class on the root |

#### Onboarding

<a id="onboarding"></a>

`Pro` · Screens: First-run flow of an AI workspace: workspace setup, tool connections, team invites and a first agent, with a getting-started checklist

```tsx
import { … } from "@/components/onboarding";
```

| Name | Type | Description |
| --- | --- | --- |
| onComplete | `(values: OnboardingValues) => void` | Called with every collected value when the summary's primary button is pressed |
| defaultStep | `1 \| 2 \| 3 \| 4` | Stage to open on (1–4); the stages before it read as done. Default 1 |
| workspace | `string` | Workspace name: the sidebar, the greeting, the checklist and the invites |
| user | `{ name: string; initials?: string }` | Account at the foot of the sidebar; the first name greets the user |
| tools | `OnboardingTool[]` | Tools on the tools stage |
| invites | `OnboardingInvite[]` | Teammates already on the invite list |
| templates | `OnboardingTemplate[]` | Templates on the agent stage |
| progress | `number` | Share of the sidebar's getting-started card that is done, 0–100 |
| onNavigate | `(label: string) => void` | Called with the label of a sidebar item, the help row or a summary row |
| className | `string` | Extra class on the root |

#### Project Card

<a id="project-card"></a>

`Pro` · Components: A two-line project summary that quietly unfolds on hover – a progress ring with one segment per subtask, a people filter and a status picker, all linked by hover

```tsx
import { … } from "@/components/project-card";
```

| Name | Type | Description |
| --- | --- | --- |
| project | `Project` |  |
| subtasks | `readonly ProjectSubtask[]` | One row and one ring arc each |
| people | `readonly ProjectPerson[]` | The people the filter and the row avatars draw from |
| statuses | `readonly ProjectStatus[]` | The picker's options; defaults to To do / In progress / In review / Done |
| onStatusChange | `(status: string) => void` | Called when a status is picked; the card is controlled when this is passed |
| onSubtaskToggle | `(id: string, done: boolean) => void` | Called when a row or its arc is toggled; controlled when this is passed |
| onOpen | `() => void` | The foot action, "Open" unless renamed |
| actionLabel | `string` |  |
| defaultOpen | `boolean` | Pin the card open on mount; it still unfolds on hover when false |
| open | `boolean` | Controlled open state – wins over hover and the head button |
| onOpenChange | `(open: boolean) => void` |  |
| className | `string` |  |

#### Runtime settings

<a id="runtime-settings"></a>

`Core` · Components: The nine agent-behaviour settings in one panel, with a draft and a save bar that appears only when dirty

```tsx
import { … } from "@/components/runtime-settings";
```

| Name | Type | Description |
| --- | --- | --- |
| value | `RuntimeSettingsValue` | Settings as the session last saved them; omit to let the panel own the snapshot |
| onChange | `(draft: RuntimeSettingsValue) => void` | Called with the whole draft after every edit, before anything is saved |
| onSave | `(draft: RuntimeSettingsValue) => void` | Called with the draft when Save is pressed |
| onReset | `() => void` | Called after Reset puts the draft back to the saved snapshot |
| saving | `boolean` | True while the save round-trip is in flight; Save and Reset are disabled |
| slowModeSupported | `boolean` | Whether the active provider offers the low-priority lane; false hides the switch |
| className | `string` | Extra class on the root |

#### Session browser

<a id="session-browser"></a>

`Core` · Components: A searchable session list grouped by day, with inline rename, delete confirmation and export

```tsx
import { … } from "@/components/session-browser";
```

| Name | Type | Description |
| --- | --- | --- |
| sessions | `readonly SessionRow[]` | Sessions in any order; rows are grouped and sorted by last activity |
| activeId | `string` | Id of the session currently open, marked with the ember rule |
| query | `string` | Search text, controlled; falls back to internal state when undefined |
| onQueryChange | `(query: string) => void` | Called with the next search text, on every keystroke and on clear |
| onOpen | `(session: SessionRow) => void` | Called with the session when a row is opened |
| onNew | `() => void` | Shows a new-session action beside the search field |
| onRename | `(session: SessionRow, title: string) => void` | Called with the new title when a rename commits |
| onDelete | `(session: SessionRow) => void` | Called when a delete is confirmed in the row |
| onExport | `(session: SessionRow) => void` | Called when export is chosen from the row actions |
| loading | `boolean` | Renders three skeleton rows instead of the list |
| className | `string` | Extra class on the root |

#### Session tree

<a id="session-tree"></a>

`Core` · Components: The session entry tree with parent rails, bookmark chips, an off-branch recession and a current-leaf marker

```tsx
import { … } from "@/components/session-tree";
```

| Name | Type | Description |
| --- | --- | --- |
| nodes | `readonly SessionNode[]` | Root entries, each carrying its own children |
| leafId | `string` | Entry the session currently ends on; its row carries the ember accent |
| selectedId | `string` | Controlled selected entry id; leave it out and the tree owns the selection |
| onSelect | `(node: SessionNode) => void` | An entry was chosen by click or by Enter |
| defaultCollapsed | `boolean` | Start every entry that has children collapsed |
| className | `string` | Extra class on the root |

#### Settings & Billing

<a id="settings-billing"></a>

`Pro` · Screens: Settings page with tabs: workspace, members, API keys and billing with plan, usage, payment method, plan comparison and invoices

```tsx
import { … } from "@/components/settings-billing";
```

| Name | Type | Description |
| --- | --- | --- |
| defaultTab | `SettingsTab` | Tab shown first; Billing mirrors the reference capture |
| tab | `SettingsTab` | Controlled tab |
| onTabChange | `(tab: SettingsTab) => void` | Called when a tab is chosen, by click or arrow key |
| workspace | `string` | Workspace name in the header and on invites |
| workspaces | `string[]` | Workspaces offered in the switcher |
| onWorkspaceChange | `(workspace: string) => void` | Called when another workspace is picked |
| nav | `{ label: string; icon?: ReactNode }[]` | Sidebar menu; omit for the standard five entries |
| active | `string` | Label of the menu item that is open |
| onNavigate | `(label: string) => void` | Called with the label of a menu item or project |
| projects | `string[]` | Projects listed under the menu |
| user | `{ name: string; avatar?: string }` | Account at the bottom of the sidebar |
| collapsed | `boolean` | Controlled sidebar collapse |
| onCollapsedChange | `(collapsed: boolean) => void` | Called when the sidebar is collapsed or restored |
| seatLimit | `number` | Seats included in the plan |
| members | `SettingsMember[]` | Rows in the members list |
| invites | `SettingsInvite[]` | Invites that have not been accepted yet |
| apiKeys | `ApiKey[]` | Rows in the API keys list |
| invoices | `Invoice[]` | Rows in the invoice table |
| usage | `UsageSummary` | Plan, meters, limits and the footer call to action |
| plans | `PlanTier[]` | Plans shown in the comparison |
| defaultPeriod | `BillingPeriod` | Billing period shown first |
| payment | `PaymentDetails` | Payment method and invoice address |
| renewsOn | `string` | Date the current plan renews |
| onSave | `(values: WorkspaceDraft) => void` | Called after the General form is saved |
| onInvite | `(invite: { email: string; role: MemberRole }) => void` | Called when an invite is sent |
| onCreateKey | `(name: string) => void` | Called when a key is created |
| onRevokeKey | `(id: string) => void` | Called when a key is revoked |
| onAction | `(action: string, detail?: string) => void` | Called with any billing action: change-plan, cancel-plan, switch-plan, upgrade, download |
| className | `string` | Extra class on the root |

#### Setup Guide

<a id="setup-guide"></a>

`Pro` · Components: Onboarding panel with a progress bar and collapsible task groups that strike through when done

```tsx
import { … } from "@/components/setup-guide";
```

| Name | Type | Description |
| --- | --- | --- |
| groups | `SetupGroup[]` | Groups in running order; the first unfinished group opens on mount |
| title | `string` | Heading on the card |
| onToggle | `(taskId: string, done: boolean, doneIds: string[]) => void` | A task was ticked or unticked, with every finished id after the change |
| onEdit | `() => void` | Shows an Edit action in the header |
| onClose | `() => void` | Shows a close button in the header |
| className | `string` | Extra class on the card |

#### Task Board

<a id="task-board"></a>

`Pro` · Blocks: Kanban board with drag and drop, quick add, a detail panel, search, label filters and a compact view

```tsx
import { … } from "@/components/task-board";
```

| Name | Type | Description |
| --- | --- | --- |
| tasks | `BoardTask[]` | Every card, in board order – the order inside a column follows this array |
| columns | `BoardColumn[]` | Columns left to right |
| labels | `BoardLabel[]` | Labels used on cards, in the filter menu and in the panel (default none) |
| people | `BoardPerson[]` | Assignees (default none) |
| crumbs | `string[]` | Breadcrumb above the board (default the reference trail) |
| onMove | `(id: string, column: string, index: number) => void` | Called after a drop with the new column and the index inside it |
| onUpdate | `(id: string, patch: Partial<BoardTask>) => void` | Called after any edit in the detail panel |
| onCreate | `(task: BoardTask) => void` | Called when quick add makes a card |
| onDelete | `(id: string) => void` | Called when the detail panel deletes a card |
| className | `string` | Extra class on the root, merged after "ui-tb" |

#### Tips Panel

<a id="tips-panel"></a>

`Free` · Components: Grid of short tips with one action each – taken tips turn into a done state

```tsx
import { … } from "@/components/tips-panel";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` |  |
| tips | `Tip[]` |  |
| onClose | `() => void` | Shows the Close button in the footer |
| closeLabel | `string` |  |
| className | `string` |  |

### Data display

#### Analytics

<a id="analytics"></a>

`Pro` · Screens: Revenue dashboard: key figures, revenue by channel, breakdown, top products and weekly trends

```tsx
import { … } from "@/components/analytics";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` | Extra class on the root |
| workspace | `string` | Workspace name in the sidebar, and the news kicker |
| workspaces | `string[]` | Workspaces the switcher offers |
| user | `{ name: string; avatar?: string }` | Account at the bottom; initials are drawn from the name |
| active | `string` | Label of the open page, which carries aria-current |
| nav | `AnalyticsNavGroup[]` | Sidebar rows, in groups |
| onNavigate | `(label: string) => void` | Called with the label of anything that navigates |
| stats | `AnalyticsStat[]` | The four cards above the charts |
| revenue | `AnalyticsChart` | Main chart, drawn taller than the two beside the products |
| sessions | `AnalyticsChart` | Sessions over time, bottom row |
| orderValue | `AnalyticsChart` | Average order value, bottom row |
| breakdown | `AnalyticsBreakdownRow[]` | Revenue mix under the main chart |
| products | `AnalyticsProduct[]` | Ranked products beside the bottom charts |
| news | `{ kicker?: string; title: string; action: string }` | Changelog card in the sidebar foot; dismissed by its close button |
| guide | `{ title: string; progress: number; cheer: string }` | Progress card under the changelog |
| period | `string` | Period shown in the header before the menu is used |
| periods | `string[]` | Periods the header menu offers |
| onPeriodChange | `(period: string) => void` | Called with the period picked from the header menu |

#### Breakdown Chart

<a id="breakdown-chart"></a>

`Pro` · Components: Stacked bar chart with measure, slice and segment pickers, a hover breakdown and a linked table

```tsx
import { … } from "@/components/breakdown-chart";
```

| Name | Type | Description |
| --- | --- | --- |
| records | `BreakdownRecord[]` | Flat records – one per task, ticket or order |
| dimensions | `Dimension[]` | Dimensions offered in the Slice and Segment pickers |
| measures | `Measure[]` | Measures offered in the Measure picker |
| title | `string` | Heading at the top of the card |
| defaultMeasure | `string` | Measure shown first |
| defaultSlice | `string` | Dimension along the bars |
| defaultSegment | `string` | Dimension that stacks the bars – "none" draws single blocks |
| className | `string` |  |

#### Change Summary

<a id="change-summary"></a>

`Free` · Components: What moved since last time – one metric per row with a colored trend

```tsx
import { … } from "@/components/change-summary";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` |  |
| period | `string` | Small text on the right of the heading, e.g. "This week" |
| icon | `ReactNode` |  |
| changes | `MetricChange[]` |  |
| className | `string` |  |

#### Compact Breakdown

<a id="compact-breakdown"></a>

`Pro` · Components: A total split into its parts in one small card – numbers roll, the bar glides and the ranked rows trade places when the period changes

```tsx
import { … } from "@/components/compact-breakdown";
```

| Name | Type | Description |
| --- | --- | --- |
| periods | `BreakdownPeriod[]` | One entry per period: its parts, and how the total moved into it |
| period | `string` | Controlled period id; leave out to let the card hold its own |
| defaultPeriod | `string` | Period shown first when uncontrolled |
| onPeriodChange | `(id: string) => void` |  |
| title | `string` |  |
| caption | `string` | Name of the total under the big number |
| formatValue | `(value: number) => string` | How every figure is written – money by default |
| periodLabel | `string` | Accessible name of the period switch |
| footer | `ReactNode` | Replaces the automatic "Largest: …" line; pass null to drop the foot entirely |
| className | `string` |  |

#### Data Table

<a id="data-table"></a>

`Pro` · Components: Spreadsheet-style table: select cells and ranges, edit in place, copy and paste, undo and sort

```tsx
import { … } from "@/components/data-table";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Card heading and the grid's accessible name |
| icon | `ReactNode` | Replaces the built-in stack mark in the header |
| columns | `DataColumn[]` |  |
| rows | `DataRow[]` |  |
| tagTones | `Record<string, TagTone>` | Tag colour per tag text; unknown tags fall back to gray |
| editable | `boolean` | false keeps selection and copying, but turns off editing, paste, delete and Add row |
| onRowsChange | `(rows: DataRow[]) => void` |  |
| onSelectionChange | `(ids: string[]) => void` | Checked row ids |
| className | `string` |  |
| ref | `Ref<HTMLElement>` |  |

#### Evals

<a id="evals"></a>

`Pro` · Screens: Prompt evaluation dashboard: pass rate by version, reviewable prompt changes and test cases you can re-run

```tsx
import { … } from "@/components/evals";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Prompt under test, shown in the header |
| version | `string` | Version the chip shows and the output column is headed with |
| versions | `string[]` | Versions offered by the chip's menu, newest first – defaults to the chart's own labels |
| model | `string` | Model that produced the answers, set in monospace next to the version |
| lastRun | `string` | Meta line in the header – "Last run 2 hours ago" |
| stats | `EvalsStat[]` | The four figures above the chart, left to right |
| series | `EvalsVersionPoint[]` | One point per version for the pass-rate chart, oldest first |
| prompt | `EvalsPrompt` | The prompt, its editor, and the changes waiting for review |
| cases | `EvalsCase[]` | The test cases, in table order |
| news | `EvalsNewsItem[]` | Release notes stacked in the sidebar |
| guide | `{ title: string; sub: string; cheer: string; done: number; onOpen?: () => void }` | The getting-started widget at the bottom of the sidebar |
| defaultFilter | `EvalsFilter` | Filter the table opens with |
| defaultSelected | `string` | Case that opens selected – the reference selects the failing one |
| workspace | `string` | Workspace name in the sidebar |
| user | `{ name: string; initials?: string }` | Account at the bottom of the sidebar |
| onNavigate | `(label: string) => void` | Called with the label of a sidebar item |
| onRun | `(ids: string[]) => void` | Called with every case id when the whole suite starts |
| onCaseRun | `(id: string) => void` | Called with one case id when that row is re-run |
| onVersionChange | `(version: string) => void` | Called when another version is picked from the chip's menu |
| onSuggestionDecision | `(index: number, decision: "accepted" \| "rejected") => void` | Called with the segment index and what was decided for it |
| className | `string` | Extra class on the root |

#### Experiment Card

<a id="experiment-card"></a>

`Pro` · Components: An A/B test in two lines that quietly unfolds on hover – variants linked to a tiny chart, a metric switch with rolling numbers, and a winner you pick with a click

```tsx
import { … } from "@/components/experiment-card";
```

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Name of the experiment, e.g. "Signup button copy" |
| variants | `ExperimentVariant[]` | The variants – two or more; the first without an explicit control is the baseline |
| metrics | `ExperimentMetric[]` | The metric switch; the first one is selected and drives the head chart |
| onPickWinner | `(variant: ExperimentVariant, metric: ExperimentMetric) => void` | Called from the commit button once a row has been picked |
| status | `{ label: string; tone?: ExperimentTone }` | Tag under the name – the dot is drawn by the styles |
| note | `string` | Short text next to the status, e.g. "Day 9 of 14" |
| metric | `string` | Controlled metric id |
| defaultMetric | `string` | Starting metric when uncontrolled |
| onMetricChange | `(id: string) => void` |  |
| winner | `string \| null` | Controlled id of the picked variant |
| defaultWinner | `string \| null` | Starting pick when uncontrolled |
| onWinnerChange | `(id: string) => void` |  |
| open | `boolean` | Controlled disclosure state |
| defaultOpen | `boolean` | Open on mount and stay open until the toggle folds it |
| onOpenChange | `(open: boolean) => void` |  |
| pickLabel | `string` | Instruction in the tray before a row is picked |
| commitLabel | `string` | Label on the commit button that appears after a pick |
| className | `string` | Extra class on the root |

#### Invoice & Credit Note

<a id="invoice-credit"></a>

`Pro` · Blocks: An invoice and its credit note stacked like paper – switch between them, pick lines to credit, adjust amounts and issue

```tsx
import { … } from "@/components/invoice-credit";
```

| Name | Type | Description |
| --- | --- | --- |
| seller | `InvoiceParty` | From block on the invoice |
| buyer | `InvoiceParty` | To block on the invoice |
| invoiceNo | `string` | Invoice number, shown under the terms |
| creditNo | `string` | Credit note number |
| invoiceDate | `string` | Issue date of the invoice, reused as the date of the credit note |
| dueDate | `string` | Payment due date |
| period | `string` | Service period both sheets cover |
| lines | `InvoiceLine[]` | Invoice lines – lines sharing a group are listed under that heading |
| currency | `string` | Currency symbol |
| currencyCode | `string` | Currency code shown after the amount applied to the invoice |
| payHref | `string` | Where "Pay online" points |
| defaultView | `Doc` | Sheet shown first |
| onViewChange | `(view: Doc) => void` | Called whenever the visible sheet changes |
| onDownload | `(view: Doc) => void` | Called by the PDF button with the sheet it would export |
| onIssue | `(lines: CreditLine[], total: number) => void` | Called when the credit note is issued, with the credited amount per line and the total incl. tax |
| className | `string` | Extra class on the root |

#### KPI Board

<a id="kpi-board"></a>

`Pro` · Blocks: The top of a dashboard – three trend cards, an overview chart that compares this period with the last, and a focus card; hover shows any day's value and every number rolls when the range changes

```tsx
import { … } from "@/components/kpi-board";
```

| Name | Type | Description |
| --- | --- | --- |
| stats | `KpiStat[]` | The trend cards, normally three |
| overview | `KpiOverview` | The wide comparison card |
| focus | `KpiFocus` | The narrow card on the right |
| range | `KpiRange` | The range picker in the bar |
| labels | `string[]` | Axis and tooltip labels, oldest first – the last one is usually "Today" |
| title | `string` | Heading on the left of the bar |
| compareLabel | `string` | Words after every change |
| periods | `{ current: string; previous: string }` | Names of the two lines in the tooltip and the focus legend |
| className | `string` | Extra class on the root |

#### KPI Chart

<a id="kpi-chart"></a>

`Pro` · Components: Metric card with a multi-line chart and a tooltip that follows the pointer

```tsx
import { … } from "@/components/kpi-chart";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Card heading, e.g. "Revenue". |
| labels | `string[]` | Axis labels in order – one per point. |
| series | `KpiSeries[]` | One or more lines, each with a value for every label. |
| formatValue | `(value: number) => string` | Formats axis ticks, the headline number, the delta and every tooltip value. |
| value | `number` | Headline number. Defaults to the sum of every series' last point. |
| delta | `number` | Change chip beside the headline. Omitted hides it; its sign picks the trend. |
| formatDelta | `(value: number) => string` | Formats the change chip, sign included. Defaults to `+`/`−` over `formatValue`. |
| dates | `string[]` | Longer per-point labels for the tooltip headline, e.g. "Mon, Mar 3". |
| footer | `string` | Caption below the rule at the foot of the card. |
| tickCount | `number` | Levels on the y axis, top down to zero. Defaults to 3. |
| defaultIndex | `number` | Day the cursor sits on before the pointer arrives. Defaults to the first. |
| ariaLabel | `string` | Replaces the plot's screen-reader instructions. |
| className | `string` |  |

#### Metrics Dashboard

<a id="metrics-dashboard"></a>

`Pro` · Blocks: Sales overview – KPI cards pick the metric, one chart switches between dotted line and bars, with top products and channels

```tsx
import { … } from "@/components/metrics-dashboard";
```

| Name | Type | Description |
| --- | --- | --- |
| metrics | `MdMetric[]` | The four KPI cards. The first is in focus on mount. |
| range | `MdRange` | The period switch |
| title | `string` | Title in the bar on top. Defaults to "Sales". |
| site | `string` | Site or workspace under the title. Defaults to "Northwind Store". |
| defaultMetric | `string` | Metric in focus to start on. Defaults to the first card. |
| defaultChart | `MdChart` | View to start on. Defaults to the line. |
| defaultCompare | `boolean` | Starts with the previous period overlaid |
| onExport | `(range: string, metric: string) => void` | Called when Export is pressed; the button confirms locally either way. |
| className | `string` | Extra class on the root |

#### Usage Meter

<a id="usage-meter"></a>

`Pro` · Components: Plan usage and AI credits – a stacked credits meter by category, daily sparkline, limits and a button that speaks up near the limit

```tsx
import { … } from "@/components/usage-meter";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Card title – the workspace or product the plan belongs to |
| plan | `string` | Plan line beside the reset, e.g. "Pro plan" |
| resetAt | `Date \| string \| number` | When the credits reset; drives "Resets in 9 days" |
| total | `number` | Credits included in the plan – the full width of the bar |
| categories | `UsageMeterCategory[]` | What the credits went into, in bar and legend order |
| limits | `UsageMeterLimit[]` | Thin meters under the legend; leave out for none |
| daily | `UsageMeterDay[]` | Days for the sparkline, oldest first; null values are days still to come |
| periods | `UsageMeterPeriod[]` | Options of the period switch; no switch when left out |
| period | `string` | Controlled period id |
| defaultPeriod | `string` | Period shown on first render when uncontrolled |
| onPeriodChange | `(id: string) => void` |  |
| onAction | `(state: UsageState) => void` | Called with the current state when the button is pressed |
| unit | `string` | Word counted in the bar and the read-outs |
| actionLabel | `string` | Button text while there is room |
| actionNearLimitLabel | `string` | Button text once the plan is close to spent |
| warnAt | `number` | Share of the total (0–1) from which the meter and the limits warn |
| className | `string` | Extra class on the root |

### Controls

#### Billing Schedule

<a id="billing-schedule"></a>

`Pro` · Components: Build a billing phase – start date, duration, products with repeats and timing, discount, minimum and live totals

```tsx
import { … } from "@/components/billing-schedule";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Heading above the phase summary |
| currency | `string` | Currency symbol in front of every amount |
| catalog | `CatalogItem[]` | Products offered by the Add product menu |
| value | `ScheduleValue` | Controlled schedule; omit to let the builder keep its own |
| defaultPhase | `string` | Phase name the builder starts with when uncontrolled |
| defaultStart | `string` | Phase start, ISO date |
| defaultDuration | `DurationId` | How long the phase runs |
| defaultLines | `ScheduleLine[]` | Lines the phase starts with |
| onChange | `(value: ScheduleValue) => void` | Called with the whole schedule on the first render and on every change |
| className | `string` | Extra class on the root |

#### Button

<a id="button"></a>

`Free` · Components: Primary, secondary, ghost and destructive buttons with icons, sizes and a shimmering loading state

```tsx
import { … } from "@/components/button";
```

| Name | Type | Description |
| --- | --- | --- |
| variant | `"primary" \| "secondary" \| "ghost" \| "destructive"` | primary: dark and filled · secondary: white with an outline · ghost: text only · destructive: red, for deleting |
| size | `"sm" \| "md" \| "lg"` |  |
| loading | `boolean` | Shows a shimmer over the label and blocks clicks |
| icon | `ReactNode` | Icon before the label, e.g. an inline SVG |
| iconRight | `ReactNode` | Icon after the label |

#### Combobox

<a id="combobox"></a>

`Pro` · Components: Pick one or many from a searchable, grouped list – chips with avatars, highlighted matches, create-on-the-fly and full keyboard support

```tsx
import { … } from "@/components/combobox";
```

| Name | Type | Description |
| --- | --- | --- |
| options | `ComboboxGroup[] \| ComboboxOption[]` | Groups, or a flat list – bare options join the run of options around them |
| label | `string` | Label above the field – it also names the list for screen readers |
| placeholder | `string` | Shown while nothing is picked |
| emptyText | `string` | Shown when the query matches nothing and nothing can be created |
| maxVisibleChips | `number` | Most chips to show, on top of the width the field can actually hold |
| creatable | `boolean` | Offer a row that creates an option from the typed text |
| onCreate | `(text: string) => ComboboxOption \| void` | Builds the option for a new entry – without it the text becomes both value and label |
| createLabel | `(text: string) => string` | Copy for the create row |
| defaultOpen | `boolean` | Render the list on the first paint |
| className | `string` |  |
| multiple | `false \| true` | Pick one – picking closes the list |
| value | `string \| string[]` | The picked value (controlled) |
| defaultValue | `string \| string[]` | The picked value when uncontrolled |
| onChange | `((value: string, option: ComboboxOption \| undefined) => void) \| ((value: string[], options: ComboboxOption[]) => void)` |  |

#### Command Menu

<a id="command-menu"></a>

`Pro` · Components: Search and run anything from one field – tool actions with logos and ⌘1–⌘5, everyday commands with icons

```tsx
import { … } from "@/components/command-menu";
```

| Name | Type | Description |
| --- | --- | --- |
| groups | `CommandGroup[]` | Sections in the order they are listed – defaults to the tool suggestions below |
| placeholder | `string` | Text in the empty field |
| open | `boolean` | Controlled open state – the menu renders nothing while closed |
| defaultOpen | `boolean` | Starts open when uncontrolled – on by default so a menu renders standalone |
| onOpenChange | `(open: boolean) => void` | Called when the menu opens or closes, including Esc on an empty field |
| onRun | `(command: CommandItem, query: string) => void` | Called with the row that was run and whatever was typed at the time |
| ranLabel | `(command: CommandItem) => string` | Head of the check line in the tray after a run |
| modifierKey | `string` | The modifier name on the shortcut chips – pass ⌘ on Apple platforms |
| hotkey | `boolean` | Bind Ctrl/⌘ K on the window to focus the field, or open the menu when it is closed |
| autoFocus | `boolean` | Focus the field as soon as the menu opens |
| className | `string` | Extra class on the root |

#### Date Range Picker

<a id="date-range-picker"></a>

`Pro` · Components: Presets and two calendars with a hover preview, comparison with the previous period or year, full keyboard control

```tsx
import { … } from "@/components/date-range-picker";
```

| Name | Type | Description |
| --- | --- | --- |
| value | `DateRange` | Controlled range. Leave undefined to let the picker hold it |
| defaultValue | `DateRange` | Range it opens on when uncontrolled – defaults to the last 30 days |
| onChange | `(range: DateRange, compare: DateRange \| null, mode: CompareMode) => void` | Fired on Apply with the range, the comparison span it implies and the mode |
| presets | `DatePreset[]` | Rows of the preset column – defaults to the nine the picker ships with |
| compare | `boolean` | Show the "Compare" segmented control and its band |
| defaultCompare | `CompareMode` | Comparison selected on first render – defaults to off |
| weekStartsOn | `0 \| 1` | 0 starts the week on Sunday, 1 on Monday (the default) |
| min | `Date` | Earliest selectable day |
| max | `Date` | Latest selectable day – defaults to the reference day, so the future stays closed |
| today | `Date` | Reference day for the presets and "today" – handy for tests and screenshots |
| defaultOpen | `boolean` | Render with the dialog already open |
| className | `string` | Extra class on the root |

#### Dropzone

<a id="dropzone"></a>

`Pro` · Components: Drag files in and watch them upload – fanning documents, colored type badges, progress with time left, errors with retry

```tsx
import { … } from "@/components/dropzone";
```

| Name | Type | Description |
| --- | --- | --- |
| accept | `string[]` | Extensions to allow, e.g. [".pdf", ".png"]. Omit to accept anything |
| maxSize | `number` | Largest allowed file in bytes |
| onUpload | `(file: File, onProgress: (fraction: number) => void) => Promise<void>` | Uploads a file and reports progress; omit to simulate the transfer on a timer |
| onChange | `(items: UploadItem[]) => void` | Called with the visible rows whenever they change |
| hint | `string` | Line under the title; defaults to the accept list and max size |
| autoplay | `boolean` | Seed the demo batch on mount – four sample files, one failing and one rejected |
| className | `string` |  |

#### Filter Menu

<a id="filter-menu"></a>

`Free` · Components: Grouped filters with removable chips, collapsible checkbox groups, Clear all and full keyboard control

```tsx
import { … } from "@/components/filter-menu";
```

| Name | Type | Description |
| --- | --- | --- |
| groups | `FilterGroup[]` |  |
| value | `FilterValue` | Controlled value |
| defaultValue | `FilterValue` | Starting value when uncontrolled |
| onChange | `(value: FilterValue) => void` |  |
| defaultOpen | `string[]` | Groups that start open – by default the first one |
| title | `string` |  |
| hints | `boolean` | Show the keyboard hints at the bottom |
| className | `string` |  |

#### Integration Picker

<a id="integration-picker"></a>

`Pro` · Components: Integrations page of a command menu – search, a list of services and the picked one with its connection on two tiles

```tsx
import { … } from "@/components/integration-picker";
```

| Name | Type | Description |
| --- | --- | --- |
| services | `IntegrationService[]` | Services to list – ten sample ones when left out |
| value | `string` | Id of the picked service, when you keep the pick yourself |
| defaultValue | `string` | Id of the picked service on the first render |
| onChange | `(id: string) => void` | Called when another service is picked |
| onConnect | `(service: IntegrationService) => void` | Called after a service was switched on |
| onDisconnect | `(service: IntegrationService) => void` | Called after a service was switched off |
| onExplore | `(service: IntegrationService) => void` | Called by "Explore integration" for the picked service |
| onBack | `() => void` | Called by the back arrow, and by Esc when the search is empty |
| appName | `string` | Your product's name in the title, e.g. "affectUI + Linear" |
| appIcon | `ReactNode` | Your product's mark on the black tile; the affect mark is drawn when this is left out |
| animate | `boolean` | Keeps the spreading ring and the turned arrows on |
| paused | `boolean` | Freezes the spreading ring |
| className | `string` | Extra class on the block |

#### Integration Settings

<a id="integration-settings"></a>

`Pro` · Components: Settings card for a connected service – on/off switch, API key, validated site address, time zone and a save bar

```tsx
import { … } from "@/components/integration-settings";
```

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Name of the connected service, shown next to its mark |
| logo | `ReactNode` | Mark in the white tile; the Shopify mark is drawn when left out |
| count | `number` | Number of records the connection has pulled, shown next to the name |
| meta | `string` | Line under the name, e.g. "Connected on March 4, 2026 at 09:12" |
| value | `Partial<IntegrationValues>` | The settings value; leave it out and the component keeps its own copy |
| onChange | `(next: IntegrationValues) => void` | Called with the complete next value on every edit |
| onSave | `(next: IntegrationValues) => void \| Promise<void>` | Called by Save with the value on screen; resolving marks it saved, rejecting keeps the bar open |
| onError | `(error: unknown) => void` | Called when the save rejects, so the failure can be shown above the card |
| createKey | `() => string \| Promise<string>` | Creates the replacement key; a random demo key when left out |
| siteHint | `string` | Helper line under the address field |
| timeZones | `string[]` | Choices offered in the time zone listbox |
| className | `string` |  |

#### OTP Input

<a id="otp-input"></a>

`Free` · Components: The verification code field done right – a gliding focus ring, paste and SMS autofill, a calm shake on errors and a morph into Verified

```tsx
import { … } from "@/components/otp-input";
```

| Name | Type | Description |
| --- | --- | --- |
| length | `number` | Number of boxes |
| separator | `boolean \| number` | A small dash between the boxes – `true` puts it in the middle, a number after that many boxes |
| numeric | `boolean` | Digits only (numeric keyboard on phones); `false` allows letters too, shown in capitals |
| value | `string` | The code – makes it controlled |
| defaultValue | `string` | Starting code when uncontrolled |
| onChange | `(code: string) => void` |  |
| onComplete | `(code: string) => void` | Called once the last box is filled – typed, pasted or autofilled |
| status | `OtpStatus` |  |
| errorMessage | `ReactNode` | Shown below the boxes while `status` is "error" |
| clearOnError | `boolean` | Clears the boxes shortly after an error, ready for the next try |
| successLabel | `string` | Text in the pill after a successful check |
| onResend | `() => void` | Shows "Resend code" below the boxes once the countdown is over |
| resendIn | `number` | Seconds until the code can be resent |
| align | `"start" \| "center"` | Center the boxes and the lines below them |
| disabled | `boolean` |  |
| autoFocus | `boolean` |  |
| label | `string` | Accessible name of the field |
| className | `string` |  |

#### Profile Menu

<a id="profile-menu"></a>

`Free` · Components: Account card with the signed-in user, menu actions and profile setup progress

```tsx
import { … } from "@/components/profile-menu";
```

| Name | Type | Description |
| --- | --- | --- |
| name | `string` |  |
| email | `string` |  |
| avatar | `ReactNode` | Replaces the default avatar |
| items | `ProfileMenuItem[]` |  |
| setup | `ProfileSetup` | Profile setup progress under the actions – leave empty to hide |
| className | `string` |  |

#### Prompt Library

<a id="prompt-library"></a>

`Pro` · Components: Saved prompt templates with variables – type straight into the sentence, watch the finished prompt assemble below, and use it once every variable is filled

```tsx
import { … } from "@/components/prompt-library";
```

| Name | Type | Description |
| --- | --- | --- |
| templates | `PromptTemplate[]` | The saved templates |
| value | `string` | Id of the chosen template (controlled) |
| defaultValue | `string` | Id chosen at first when uncontrolled – the first template by default |
| onSelect | `(id: string, template: PromptTemplate) => void` | Called when another template is chosen |
| onUse | `(prompt: string, template: PromptTemplate, values: Record<string, string>) => void` | Called with the assembled prompt when Use is pressed – every variable is filled by then |
| onCopy | `(prompt: string) => void` | Called after the prompt was handed to the clipboard |
| title | `string` | Heading above the list |
| searchPlaceholder | `string` | Placeholder and accessible name of the search field |
| listLabel | `string` | Name of the list for screen readers |
| previewLabel | `string` | Small uppercase label over the assembled prompt |
| copyLabel | `string` | Text of the copy button |
| useLabel | `string` | Text of the use button |
| emptyText | `string` | Shown when the search matches nothing |
| className | `string` | Extra class on the root |

#### Segmented Control

<a id="segmented-control"></a>

`Free` · Components: Switch between two to six options – a raised pill or underline that glides, stretches a little and can be dragged across, with icons, counts and badges

```tsx
import { … } from "@/components/segmented-control";
```

| Name | Type | Description |
| --- | --- | --- |
| options | `SegmentOption<T>[]` |  |
| value | `T` | Controlled value |
| defaultValue | `T` | Starting value when uncontrolled – defaults to the first enabled option |
| onChange | `(value: T) => void` |  |
| size | `"sm" \| "md" \| "lg"` |  |
| variant | `"tray" \| "underline"` | "tray" = gray track with a raised pill, "underline" = text tabs with a sliding line |
| fullWidth | `boolean` | Fill the container with equal segments |
| kind | `"radio" \| "tabs"` | "radio" (a radiogroup, the default) or "tabs" (a tablist that switches panels) |
| disabled | `boolean` |  |
| aria-label | `string` |  |
| aria-labelledby | `string` |  |
| className | `string` |  |

#### Stepper Form

<a id="stepper-form"></a>

`Pro` · Components: A multi-step flow for onboarding and setup – steps that fill and check off, sliding steps, a card that morphs to each step, inline validation and a success state

```tsx
import { … } from "@/components/stepper-form";
```

| Name | Type | Description |
| --- | --- | --- |
| steps | `Step<V>[]` | The steps in order – ids keep Back and Edit in place |
| initialValues | `V` | Values shared by every step |
| onSubmit | `(values: V) => void \| Promise<void>` | The work behind the last step's button – a promise keeps the busy label until it settles |
| onComplete | `(values: V) => void \| Promise<void>` | Runs once onSubmit has settled, e.g. to close a dialog or move on; the success view follows it |
| initialStep | `number` | Index of the first step shown |
| step | `number` | Controlled step index – pair with onStepChange |
| onStepChange | `(step: number) => void` | Called whenever the step changes |
| submitLabel | `string` | Label of the button on the last step |
| submittingLabel | `string` | Label while onSubmit and onComplete run |
| success | `(values: V, reset: () => void) => ReactNode` | Replaces the steps once done – StepperSuccess gives the popping check, a heading and a line |
| className | `string` | Extra class on the root |

### Feedback

#### Connection banner

<a id="connection-banner"></a>

`Core` · Components: Transport health: starting, reconnecting with a countdown, exited with a code, and a history-gap note

```tsx
import { … } from "@/components/connection-banner";
```

| Name | Type | Description |
| --- | --- | --- |
| state | `ConnectionState` | Transport state reported by the bridge |
| message | `string` | Detail from bridge_status, shown under the state word |
| code | `number \| string` | Exit or error code reported alongside the state |
| retryInSeconds | `number` | Seconds until the next automatic reconnect attempt |
| historyGap | `boolean` | True when the client joined a stream that only carries live messages |
| onRestart | `() => void` | Called when the user asks for a fresh bridge process |
| onRetryNow | `() => void` | Called when the user skips the remaining backoff |
| onReload | `() => void` | Called when the user refetches the transcript after a gap |
| className | `string` | Extra class on the root |

#### Decision Inbox

<a id="decision-inbox"></a>

`Free` · Components: Open decisions with two quick answers each – answered ones confirm and fold away

```tsx
import { … } from "@/components/decision-inbox";
```

| Name | Type | Description |
| --- | --- | --- |
| decisions | `InboxDecision[]` |  |
| onDecide | `(decision: InboxDecision, answer: "primary" \| "secondary") => void` | Called with the decision and the chosen answer |
| className | `string` |  |

#### Error card

<a id="error-card"></a>

`Core` · Components: A failed turn with provider metadata, HTTP status, retryability and a scheduled-retry state

```tsx
import { … } from "@/components/error-card";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Which step failed, e.g. "Turn failed" |
| message | `string` | The provider's own words, rendered as the headline |
| provider | `string` | Provider that answered, shown in the metadata line |
| model | `string` | Model the request named, shown in the metadata line |
| httpStatus | `number` | HTTP status of the failure, rendered as a number and never inferred from the message |
| retryable | `boolean` | Whether another attempt could land; Retry appears only when true |
| attempt | `number` | Attempt already spent, from auto_retry_start |
| maxAttempts | `number` | Ceiling the bridge will stop at, from auto_retry_start |
| retrying | `boolean` | A retry is in flight; the label becomes a spinner and the button is disabled |
| dismissed | `boolean` | Fold the card to its receipt from outside; omit to let the card own the fold |
| onRetry | `() => void` | Retry handler, called by Retry or Retry now |
| onDismiss | `(dismissed: boolean) => void` | Called with the fold state the card asks for: true on Dismiss, false on Undo |
| isLatest | `boolean` | Whether this is the newest failure; only the newest one takes role="alert" |
| className | `string` | Extra class on the root |

#### Notification Stack

<a id="notification-stack"></a>

`Free` · Components: Notice cards stacked behind each other – dismiss the front one to reveal the next

```tsx
import { … } from "@/components/notification-stack";
```

| Name | Type | Description |
| --- | --- | --- |
| notices | `Notice[]` |  |
| onDismiss | `(notice: Notice) => void` | Called after a notice was dismissed |
| className | `string` |  |

#### Progress Tracker

<a id="progress-tracker"></a>

`Free` · Components: Onboarding checklist with an animated progress bar, ticks that draw themselves and auto play

```tsx
import { … } from "@/components/progress-tracker";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` |  |
| steps | `ProgressStep[]` |  |
| autoPlay | `boolean` | Ticks the open steps one after another, then starts over – stops as soon as someone interacts |
| interval | `number` | Pause between two automatic steps, in ms |
| onChange | `(steps: ProgressStep[]) => void` |  |
| className | `string` |  |

#### Status strip

<a id="status-strip"></a>

`Core` · Components: Keyed status slots in one row, folding the overflow into a popover and collapsing to nothing when empty

```tsx
import { … } from "@/components/status-strip";
```

| Name | Type | Description |
| --- | --- | --- |
| slots | `readonly StatusSlot[]` | Slots in bridge order; a slot with no text is clearing |
| maxVisible | `number` | Chips held in the row before the rest fold into a count |
| className | `string` | Extra class on the root |

#### Toaster

<a id="toaster"></a>

`Pro` · Components: Calm toasts from anywhere – a stack that fans out on hover, promise toasts that morph from spinner to check, swipe to dismiss

```tsx
import { … } from "@/components/toaster";
```

| Name | Type | Description |
| --- | --- | --- |
| position | `ToastPosition` | Corner or edge the stack sits in; cards enter and leave through that edge |
| inline | `boolean` | Anchors the stack to the nearest positioned ancestor instead of the viewport |
| duration | `number` | Default time on screen in ms – a toast can override it |
| visibleToasts | `number` | Cards kept at once; older ones drop off the back |
| expand | `boolean` | Keeps the stack fanned out instead of waiting for hover or focus |
| offset | `number` | Distance from the edges in px – leave it out to use the stylesheet's 24px, or 20px inline |
| gap | `number` | Space between cards when the stack is fanned out, in px |
| hotkey | `string \| null` | Key or code that moves focus to the newest toast – null turns it off |
| closeButton | `boolean` | Small dismiss button that appears on hover and focus, always visible on touch |
| label | `string` | Name of the region for screen readers; the hotkey is appended |
| className | `string` | Extra class on the stack element |
| children | `ReactNode` | The host app – rendered untouched, never wrapped in the fixed shell |

#### Widget strip

<a id="widget-strip"></a>

`Core` · Components: Keyed extension widgets above or below the composer, with textual severity and a leave animation

```tsx
import { … } from "@/components/widget-strip";
```

| Name | Type | Description |
| --- | --- | --- |
| widgets | `readonly WidgetEntry[]` | Widgets pushed by extensions, in paint order |
| onDismiss | `(key: string) => void` | A strip's dismiss control was pressed; the host drops the widget and the strip leaves |
| maxLines | `number` | Lines shown before the body folds; the rest sit behind "+N more" |
| className | `string` | Extra class on the root |

### Marketing

#### Agent Gallery

<a id="agent-gallery"></a>

`Pro` · Blocks: Slim gradient panels with one open product screen in the middle – pick a panel and it glides open

```tsx
import { … } from "@/components/agent-gallery";
```

| Name | Type | Description |
| --- | --- | --- |
| heading | `string` | Section heading; also the carousel's accessible name |
| description | `string` | Line under the heading |
| panels | `AgentGalleryPanel[]` | The agents, left to right |
| index | `number` | Index of the open panel, when the caller owns the state |
| defaultIndex | `number` | Index of the open panel when uncontrolled – defaults to the first |
| onIndexChange | `(index: number) => void` | Called with the index of the panel the visitor picked |
| className | `string` | Extra class on the root |

#### Announcement pill

<a id="announcement-pill"></a>

`Core` · Components: A launch pill with a label chip, a message and an optional dismiss

```tsx
import { … } from "@/components/announcement-pill";
```

| Name | Type | Description |
| --- | --- | --- |
| label | `string` | Chip text, set in small caps: "Baru", "New", "Beta" |
| children | `ReactNode` | The notice itself |
| onDismiss | `() => void` | Called once the leave animation has finished; without it no dismiss button renders |
| href | `string` | Makes the whole pill a link |
| dismissLabel | `string` | Accessible name for the dismiss button |
| className | `string` | Extra class on the root |

#### Browser frame

<a id="browser-frame"></a>

`Core` · Components: Browser chrome with dots and an address bar over a fixed 16 by 10 viewport

```tsx
import { … } from "@/components/browser-frame";
```

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | Address shown in the bar; omit it and the pill keeps its shape with a muted placeholder |
| trafficDots | `boolean` | Three dots at the left of the bar |
| children | `ReactNode` | The page inside the viewport; clipped to the 16 by 10 box |
| className | `string` | Extra class on the root, for the page that places the frame |

#### Channel inbox

<a id="channel-inbox"></a>

`Core` · Components: A compact inbox preview listing conversations across channels with unread and status marks

```tsx
import { … } from "@/components/channel-inbox";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Window title; the list is labelled by it |
| meta | `ReactNode` | Right side of the header; defaults to the open count |
| items | `readonly PreviewConversation[]` | Conversations, in display order |
| className | `string` | Extra class on the root |

#### Chat window

<a id="chat-window"></a>

`Core` · Components: A titled window chrome with traffic dots and a status slot, wrapping any preview

```tsx
import { … } from "@/components/chat-window";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Title in the header bar; it also names the frame for assistive technology |
| trafficDots | `boolean` | Draw the three traffic dots before the title |
| meta | `ReactNode` | Right-aligned node in the header, such as an open-count |
| status | `{ /** Short word that carries the meaning: "Terhubung", "Menunggu" */ label: string; /** Colour family; the label above still states the status on its own */ tone: "neutral" \| "accent" \| "success" \| "warning" \| "danger"; }` | Status badge in the header; the label is always visible, so the tone is never the only signal |
| children | `ReactNode` | Body content; the frame sets no height and lets this decide it |
| className | `string` |  |

#### Comparison matrix

<a id="comparison-matrix"></a>

`Core` · Components: Three products compared feature by feature, with the recommended column raised

```tsx
import { … } from "@/components/comparison-matrix";
```

| Name | Type | Description |
| --- | --- | --- |
| columns | `readonly MatrixColumn[]` | Columns left to right; the raised one is picked by `raisedIndex` |
| rows | `readonly MatrixRow[]` | Features top to bottom |
| caption | `string` | Names the products under comparison; read by assistive tech, never drawn |
| raisedIndex | `number` | Zero-based column to raise; leave unset to keep all three level |
| className | `string` | Extra class on the root |

#### CS inbox

<a id="cs-inbox"></a>

`Core` · Components: The full customer-service inbox: conversation list, thread and a takeover bar

```tsx
import { … } from "@/components/cs-inbox";
```

| Name | Type | Description |
| --- | --- | --- |
| conversations | `InboxConversation[]` | Conversations in list order |
| defaultSelectedId | `string` | Row open on first paint; the first visible row is used when omitted |
| onSelect | `(id: string) => void` | Fires with the conversation id when a row is picked |
| onTakeover | `(id: string) => void` | Fires with the conversation id when the thread is taken over |
| className | `string` | Extra class on the root |

#### CTA band

<a id="cta-band"></a>

`Core` · Blocks: A closing band with a watermark mark, a headline, a lead and two CTAs

```tsx
import { … } from "@/components/cta-band";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | The closing line, set as the band heading |
| lead | `ReactNode` | One or two sentences under the heading, held to 28rem so the line stays readable |
| actions | `ReactNode` | The buttons of the action row. Direct `<a>` and `<button>` children are styled as band buttons, the ember primary by default; mark the secondary with `data-tone="quiet"` |
| watermark | `ReactNode` | A decorative mark drawn behind the content, anchored to the bottom edge; it is never announced and never clickable |
| className | `string` |  |

#### FAQ accordion

<a id="faq-accordion"></a>

`Core` · Components: Questions that fold open one at a time, with a plus that turns and a single-open rule

```tsx
import { … } from "@/components/faq-accordion";
```

| Name | Type | Description |
| --- | --- | --- |
| items | `readonly FaqEntry[]` | Questions in reading order; the index is the identity |
| single | `boolean` | Keep at most one panel open; turning it on closes all but the last opened |
| defaultOpen | `number` | Index of the panel that starts open; omit for a fully folded list |
| className | `string` | Extra class on the root |

#### Feature grid

<a id="feature-grid"></a>

`Core` · Blocks: A two-column grid of feature cards, each with a heading, copy and a visual slot

```tsx
import { … } from "@/components/feature-grid";
```

| Name | Type | Description |
| --- | --- | --- |
| items | `readonly FeatureCard[]` | Cards in reading order; the grid reveals them in this order |
| columns | `2 \| 3` | Cards per row once the viewport clears the medium breakpoint |
| className | `string` | Extra class on the root |

#### Hero band

<a id="hero-band"></a>

`Core` · Blocks: The opening band of a landing page: launch pill, headline with an inline glyph, lead and two CTAs

```tsx
import { … } from "@/components/hero-band";
```

| Name | Type | Description |
| --- | --- | --- |
| pill | `ReactNode` | Announcement slot above the headline, e.g. an announcement pill |
| title | `ReactNode` | The headline sentence; wrapped in an `h1` unless `children` supplies the heading |
| lead | `ReactNode` | Paragraph under the headline, set at 1.125rem and capped at 36rem |
| subLead | `ReactNode` | Second, quieter paragraph, capped at 38rem |
| actions | `ReactNode` | The call-to-action row; the first child draws as the primary button, the rest as outlines |
| glyph | `ReactNode` | Inline mark set inside the headline sentence, drawn at 0.92em square |
| children | `ReactNode` | A caller-owned heading block; replaces the built-in `h1` and keeps the enter stagger |
| className | `string` | Extra class on the band; set the `--ui-hrb-*` knobs here to retheme it |

#### Highlight band

<a id="highlight-band"></a>

`Core` · Components: A one line emphasised band that sets a highlight apart from the prose around it

```tsx
import { … } from "@/components/highlight-band";
```

| Name | Type | Description |
| --- | --- | --- |
| children | `ReactNode` | The line the band carries; it wraps onto a second row rather than clipping |
| tone | `"accent" \| "success" \| "warning"` | Ground the band is painted with; each tone ships an ink checked against it |
| label | `string` | Small caption above the band, in the muted ink; omit it and the band stands alone |
| align | `"center" \| "left"` | Centred in the host column, or flush to its left edge |
| className | `string` | Extra class on the root |

#### Legal page

<a id="legal-page"></a>

`Core` · Blocks: A legal document page with a document switcher, a sticky contents list and numbered sections

```tsx
import { … } from "@/components/legal-page";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Document title, rendered as the page heading |
| lead | `string` | One or two sentences under the title |
| updated | `string` | Date the document last changed; the line reads "Terakhir diperbarui" |
| documents | `readonly LegalDocumentLink[]` | Sibling documents in the switcher; the active one carries aria-current |
| sections | `readonly LegalSection[]` | Sections in reading order; numbering and the contents list both follow this order |
| footnote | `ReactNode` | Closing note under the article, e.g. a contact line and a version |
| className | `string` | Extra class on the root |

#### Logo Marquee

<a id="logo-marquee"></a>

`Free` · Blocks: The endless “Trusted by” strip – a seamless loop that eases to a stop on hover, scrubs with inertia and lifts the hovered logo to colour

```tsx
import { … } from "@/components/logo-marquee";
```

| Name | Type | Description |
| --- | --- | --- |
| logos | `MarqueeLogo[]` |  |
| speed | `number` | Pixels per second, independent of the strip's width |
| direction | `"left" \| "right"` | Which way the first row runs; a second row runs the other way |
| rows | `1 \| 2` | 1, or 2 for a second row in the opposite direction (the logos are split between the rows) |
| gap | `number` | Space between logos in px (smaller on narrow containers) |
| pauseOnHover | `boolean` | Ease to a stop while the pointer is over the strip or it has keyboard focus |
| grayscale | `boolean` | Muted, colourless logos that lift to full colour on hover |
| labels | `"none" \| "below" \| "beside"` | Show the brand name under each mark or beside it, like a wordmark |
| label | `string` | Accessible name of the strip |
| className | `string` |  |

#### Mock thread

<a id="mock-thread"></a>

`Core` · Components: A chat bubble stack with channel avatars, an AI tag, a typing bubble and a source note

```tsx
import { … } from "@/components/mock-thread";
```

| Name | Type | Description |
| --- | --- | --- |
| messages | `readonly ChatBubble[]` | Bubbles in reading order |
| typing | `boolean` | Shows the three-dot reply row after the last bubble |
| typingLabel | `string` | Spoken label for the typing row |
| note | `ReactNode` | A centred pill under the thread, e.g. the handoff note |
| source | `{ label: string; quote: string }` | The catalogue entry an answer cited: a pill and a short quote |
| avatars | `{ in?: ReactNode; out?: ReactNode }` | Avatar content per side; an incoming row falls back to the bubble's `initials` |
| className | `string` | Extra class on the root |

#### Numbered points

<a id="numbered-points"></a>

`Core` · Blocks: A commercial argument: a heading and lead beside rows that carry square step numbers

```tsx
import { … } from "@/components/numbered-points";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `ReactNode` | The argument's heading, held to a sixteen character measure |
| lead | `ReactNode` | Supporting sentence under the heading, held to the reading measure |
| points | `readonly NumberedPoint[]` | Rows, numbered from `start` in the order given |
| start | `number` | First number in the list, so a set that continues another starts where it left off |
| className | `string` | Extra class on the root |

#### Phone mock

<a id="phone-mock"></a>

`Core` · Components: A phone frame with status bar, app bar, scrolling thread and a composer

```tsx
import { … } from "@/components/phone-mock";
```

| Name | Type | Description |
| --- | --- | --- |
| statusTime | `string` | Status bar clock; defaults to the measured `9:41` |
| appBar | `{ /** Conversation or business name, 13px semibold */ title: string; /** Second line under the title, 10px muted */ subtitle?: string; /** Initials for the round avatar; a person glyph stands in when absent */ avatar?: string; /** Draw the back chevron; defaults to true */ back?: boolean; /** Optional pill on the right, e.g. `AI` */ tag?: string; }` | The in-app bar above the thread |
| composer | `\| { /** Placeholder in the field */ placeholder?: string; /** Accessible name for the field */ label?: string; /** Controlled draft; omit to let the frame own it */ value?: string; /** Draft change, fired on every keystroke */ onChange?: (value: string) => void; /** Send the trimmed draft; without it the send glyph is decorative */ onSend?: (value: string) => void; /** Dim and lock the field */ disabled?: boolean; } \| false` | Composer field at the foot of the screen; `false` removes it |
| messages | `readonly PhoneThreadMessage[]` | Bubbles in the scrolling body, oldest first |
| children | `ReactNode` | Extra content above the bubbles, inside the scroll area (a day divider, a note) |
| className | `string` | Extra class on the frame |

#### Portfolio marquee

<a id="portfolio-marquee"></a>

`Core` · Components: Two rows of work previews scrolling in opposite directions, pausing on hover

```tsx
import { … } from "@/components/portfolio-marquee";
```

| Name | Type | Description |
| --- | --- | --- |
| rows | `2 \| 1` | Two counter-running bands, or one |
| items | `WorkItem[]` | The work, rendered twice per band so the loop has no gap at the wrap |
| speed | `number` | Travel speed in pixels per second; the duration is measured from the track width |
| pauseOnHover | `boolean` | Holds a band still while the pointer or keyboard focus is inside it |
| renderItem | `(item: WorkItem) => ReactNode` | Replaces the default cell; the wrapper still owns the cell width and the gap |
| className | `string` | Extra class on the root, for a host that needs another gap or band height |

#### Pricing Plans

<a id="pricing-plans"></a>

`Pro` · Blocks: Pricing section with a monthly / yearly switch, three plan cards and collapsible details

```tsx
import { … } from "@/components/pricing-plans";
```

| Name | Type | Description |
| --- | --- | --- |
| plans | `Plan[]` | The cards, in order – the reference demo ships three |
| billing | `PlanPeriod` | Controlled billing period; pair it with onBillingChange |
| defaultBilling | `PlanPeriod` | Billing period shown first when billing is not controlled |
| onBillingChange | `(billing: PlanPeriod) => void` | Called when the switch moves, whether or not billing is controlled |
| onSelect | `(plan: Plan, billing: PlanPeriod) => void` | Called with the plan whose button was pressed |
| title | `string` | Section heading |
| subtitle | `string` | Line under the heading |
| currency | `string` | Symbol in front of the prices |
| className | `string` | Extra class on the section |

#### Pricing tiers

<a id="pricing-tiers"></a>

`Core` · Blocks: Four plan cards with a monthly or yearly switch, discount badge, ribbon badges and per-feature help

```tsx
import { … } from "@/components/pricing-tiers";
```

| Name | Type | Description |
| --- | --- | --- |
| plans | `TierPlan[]` | The cards, in order |
| eyebrow | `ReactNode` | Small label above the heading |
| title | `ReactNode` | Section heading |
| lead | `ReactNode` | Supporting sentence under the heading |
| note | `ReactNode` | The line under the switch, explaining the cheapest tier |
| footnote | `ReactNode` | A centred line under the grid |
| period | `"monthly" \| "yearly"` | Controlled period; pair it with onPeriodChange |
| defaultPeriod | `"monthly" \| "yearly"` | Period shown first when period is not controlled |
| onPeriodChange | `(period: "monthly" \| "yearly") => void` | Called when the switch moves, whether or not period is controlled |
| periods | `[string, string]` | The two switch labels, in order |
| discountLabel | `string` | Text of the chip on the second period, e.g. "-16.7%" |
| discountBadge | `boolean` | Draws the chip while the second period is active |
| ctaSize | `"md" \| "lg"` | Button height: 44px, or 64px for a page whose buttons are the main action |
| backdrop | `boolean` | Paints the tinted band behind the grid |
| onSelect | `(plan: TierPlan, period: "monthly" \| "yearly") => void` | Called with the plan whose button was pressed |
| className | `string` | Extra class on the section |

#### Process steps

<a id="process-steps"></a>

`Core` · Components: A numbered process as a line of steps with connectors, horizontal or stacked

```tsx
import { … } from "@/components/process-steps";
```

| Name | Type | Description |
| --- | --- | --- |
| steps | `readonly ProcessStep[]` | The process, in order |
| orientation | `"horizontal" \| "vertical"` | Layout from 640px up; below that the steps stack whichever way this is set |
| current | `number` | Index of the step reached last; it and every earlier step take the accent, and a negative index leaves every step ahead |
| className | `string` | Extra class on the root |

#### Section intro

<a id="section-intro"></a>

`Core` · Components: The eyebrow, heading and lead paragraph that opens a marketing section, centred or left

```tsx
import { … } from "@/components/section-intro";
```

| Name | Type | Description |
| --- | --- | --- |
| eyebrow | `ReactNode` | Small label above the heading, set in the accent |
| title | `ReactNode` | The heading itself |
| lead | `ReactNode` | Supporting sentence under the heading, held to the reading measure |
| as | `"h2" \| "h3"` | Heading level, so a section nested in a section keeps the outline honest |
| align | `"center" \| "left"` | Centred, or flush to the left edge of the host column |
| children | `ReactNode` | Slot under the lead, for a switch or a pair of actions |
| className | `string` | Extra class on the root |

#### Service row

<a id="service-row"></a>

`Core` · Blocks: A service explained full width: a tag chip, a heading, capability tags and a CTA beside a shot

```tsx
import { … } from "@/components/service-row";
```

| Name | Type | Description |
| --- | --- | --- |
| chip | `string` | Category the row is about, set in the chip |
| title | `string` | Row heading |
| tags | `string[]` | Capability tags under the heading |
| cta | `{ label: string; href: string }` | Link at the end of the copy column |
| shot | `ReactNode` | The visual beside the copy; omit it and the copy takes the full width, centred |
| flip | `boolean` | Puts the shot on the left from lg up; below lg the copy always comes first |
| className | `string` | Extra class merged onto the row |

#### Site footer

<a id="site-footer"></a>

`Core` · Components: Slim site footer with a brand mark, wrap-friendly link rows and a copyright line

```tsx
import { … } from "@/components/site-footer";
```

| Name | Type | Description |
| --- | --- | --- |
| brand | `ReactNode` | Brand slot; a mark and wordmark are drawn when omitted |
| links | `FooterLink[]` | Flat link row; not rendered when `groups` carries a column set |
| groups | `FooterGroup[]` | Labelled columns, replacing the flat row |
| note | `string` | Copyright line |
| className | `string` | Extra class on the root |

#### Site header

<a id="site-header"></a>

`Core` · Components: Sticky marketing header with centre nav, one dropdown group, a login link and a gradient CTA

```tsx
import { … } from "@/components/site-header";
```

| Name | Type | Description |
| --- | --- | --- |
| brand | `ReactNode` | Brand slot, usually an anchor around a mark and wordmark; a Namur mark is drawn when omitted |
| links | `readonly HeaderNavItem[]` | Plain links: the first leads, the rest trail the groups |
| groups | `readonly HeaderNavGroup[]` | Dropdown groups, drawn between the leading link and the rest |
| login | `{ label: string; href: string }` | Quiet link at the right of the bar |
| cta | `{ label: string; href: string }` | Gradient call to action at the right of the bar |
| onNavigate | `(item: HeaderNavItem) => void` | Called with the item a visitor activated, before the href navigates |
| className | `string` | Extra class on the root |

#### Stock card

<a id="stock-card"></a>

`Core` · Components: A catalogue entry that an answer cited, with stock meta and the quoted reply

```tsx
import { … } from "@/components/stock-card";
```

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Window title in the header |
| status | `string` | Connection badge label, drawn in the success tone |
| item | `StockItem` | The catalogue entry the answer cited |
| cite | `StockCitation` | The citing answer; omit it and the card ends after the product row |
| className | `string` | Extra class on the root |

#### Testimonial Wall

<a id="testimonial-wall"></a>

`Free` · Blocks: The landing-page wall of quotes – columns that scroll endlessly in opposite directions, ease to a stop on hover and scrub with inertia

```tsx
import { … } from "@/components/testimonial-wall";
```

| Name | Type | Description |
| --- | --- | --- |
| items | `Testimonial[]` |  |
| columns | `1 \| 2 \| 3` | Most columns on a wide container – narrower containers use fewer (2 below 740px, 1 below 480px) |
| speed | `number` | Pixels per second of the first column; the others run a little slower and faster |
| pauseOnHover | `boolean` | Ease a column to a stop while the pointer is over it or a card in it has keyboard focus |
| label | `string` | Accessible name of the wall |
| className | `string` | Extra class on the wrapper – set the height with --ui-tw-height (600px by default) |

#### Use case switcher

<a id="use-case-switcher"></a>

`Core` · Blocks: Chips that switch the headline, copy and CTA beside a phone preview

```tsx
import { … } from "@/components/use-case-switcher";
```

| Name | Type | Description |
| --- | --- | --- |
| useCases | `readonly UseCase[]` | The flows on offer, in the order they appear |
| defaultId | `string` | Which flow starts selected; falls back to the first one |
| onChange | `(useCase: UseCase) => void` | Called with the flow that was picked, as the panel swaps |
| preview | `ReactNode` | The phone or mock that sits beside the copy; it is never re-mounted |
| title | `string` | Section heading, measured to about 22 characters a line |
| caption | `string` | Small note under the heading, read at half ink |
| cta | `ReactNode` | The action under the panel, usually one link or button |
| className | `string` | Extra class on the root |

### Artwork & motion

#### Agent Team

<a id="agent-team"></a>

`Free` · Illustrations: A prompt types itself and branches out into three agents, each with a role and overlapping tool logos

```tsx
import { … } from "@/components/agent-team";
```

| Name | Type | Description |
| --- | --- | --- |
| prompt | `string` | Text that types itself into the prompt |
| members | `[AgentTeamMember, AgentTeamMember, AgentTeamMember]` | Exactly three agents, left to right |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Blur Crossfade

<a id="blur-crossfade"></a>

`Pro` · Motion: Swaps content with a soft blur while the box glides smoothly to the size of what comes next

```tsx
import { … } from "@/components/blur-crossfade";
```

| Name | Type | Description |
| --- | --- | --- |
| id | `string \| number` | Key of the content on screen – changing it starts the swap |
| children | `ReactNode` | The content for the current id |
| duration | `number` | Length of the swap, and of the size glide, in ms |
| blur | `number` | Blur in px at the far end of each fade |
| morph | `"height" \| "both" \| "none"` | Which sides glide to the new size: "both" follows the width too, "none" leaves the box put |
| as | `"div" \| "span"` | Root element – "span" inside a button or any other inline content |
| className | `string` | Extra class on the box |

#### Cover Flow

<a id="cover-flow"></a>

`Free` · Illustrations: Browse covers in 3D – drag, flick or scrub the row, it springs to the nearest cover; images drift in their frames over a soft reflection

```tsx
import { … } from "@/components/cover-flow";
```

| Name | Type | Description |
| --- | --- | --- |
| items | `CoverFlowItem[]` |  |
| index | `number` | Controlled front cover |
| defaultIndex | `number` | Starting cover when uncontrolled – defaults to the middle one |
| onIndexChange | `(index: number) => void` |  |
| onSelect | `(item: CoverFlowItem, index: number) => void` | Clicking (or pressing Enter on) the cover in front |
| itemWidth | `number` | Cover size in px – scales down on narrow containers |
| itemHeight | `number` |  |
| angle | `number` | How far the side covers turn away, in degrees |
| reflection | `boolean` | Mirror the covers on the floor |
| caption | `boolean` | Title and subtitle of the front cover |
| renderCaption | `(item: CoverFlowItem, index: number) => ReactNode` | Replaces the default caption (title and subtitle) |
| controls | `boolean` | Previous / next buttons next to the caption |
| ticks | `boolean` | A row of small position ticks under the caption |
| sound | `boolean` | A soft click each time a new cover reaches the front |
| aria-label | `string` |  |
| className | `string` |  |

#### DACH Region

<a id="region-dach"></a>

`Free` · Illustrations: DACH map with fading neighbours and a pastel band along the border, switchable to the US, China, India, Brazil or Japan

```tsx
import { … } from "@/components/region-dach";
```

| Name | Type | Description |
| --- | --- | --- |
| region | `Region` | Shown region (controlled) |
| defaultRegion | `Region` | Region shown first when `region` is not set |
| onRegionChange | `(region: Region) => void` | Called when the viewer picks a region in the menu |
| showSwitcher | `boolean` | Show the region menu in the top-left corner |
| className | `string` |  |
| label | `string \| ((region: Region) => string)` | Accessible description of the map; a function receives the current region |

#### Empty Calendar

<a id="empty-calendar"></a>

`Free` · Illustrations: Stack of calendar cards marked empty, fanning out on hover

```tsx
import { … } from "@/components/empty-calendar";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Enrichment Orbit

<a id="enrichment-orbit"></a>

`Free` · Illustrations: Grok tile inside two rings with comets and data nodes orbiting around it

```tsx
import { … } from "@/components/enrichment-orbit";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Frost Cloud

<a id="frost-cloud"></a>

`Free` · Illustrations: A frosted white cloud with eyes cut out of it, on a red-orange or blue sky – it floats, turns to look around, blinks, follows the pointer and bounces with a wink when clicked

```tsx
import { … } from "@/components/frost-cloud";
```

| Name | Type | Description |
| --- | --- | --- |
| background | `boolean` | Fill the whole illustration with the sky gradient; false leaves the cloud on a transparent background |
| color | `"blue" \| "orange"` | "blue": a blue-to-cyan sky · "orange": a red-to-orange sky |
| followPointer | `boolean` | The eyes follow the pointer while it's over the illustration |
| className | `string` |  |
| label | `string` | Accessible description of the illustration |

#### Ghosted Chat

<a id="ghosted-chat"></a>

`Free` · Illustrations: Unanswered chat messages marked as read, with a thumbs-down reply on hover

```tsx
import { … } from "@/components/ghosted-chat";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Glass Folder

<a id="glass-folder"></a>

`Pro` · Illustrations: Glassy blue folder with documents behind a frosted pocket that tips open on hover

```tsx
import { … } from "@/components/glass-folder";
```

| Name | Type | Description |
| --- | --- | --- |
| label | `string` | Accessible description of the illustration |
| className | `string` |  |

#### Glow Cloud

<a id="glow-cloud"></a>

`Free` · Illustrations: A glowing cloud with eyes in blue or red-orange – it floats, turns to look around, blinks, follows the pointer and bounces with a wink when clicked

```tsx
import { … } from "@/components/glow-cloud";
```

| Name | Type | Description |
| --- | --- | --- |
| background | `boolean` | Fill the whole illustration with the sky gradient; false leaves the cloud on a transparent background |
| color | `"blue" \| "orange"` | "blue": a blue-to-cyan sky · "orange": a red-to-orange sky |
| followPointer | `boolean` | The eyes follow the pointer while it's over the illustration |
| className | `string` |  |
| label | `string` | Accessible description of the illustration |

#### Glow Keyboard

<a id="glow-keyboard"></a>

`Pro` · Illustrations: AI chat input that types itself over a glass keyboard – every key press sends a wave up the gradient floor

```tsx
import { … } from "@/components/glow-keyboard";
```

| Name | Type | Description |
| --- | --- | --- |
| prompts | `string[]` | Prompts the scene types by itself, one after another; each is sent with Enter |
| placeholder | `string` | Placeholder and accessible name of the composer, e.g. "Ask AI anything..." |
| onSubmit | `(text: string) => void` | Called with the text each time a prompt is sent, by the scene or by the reader |
| autoType | `boolean` | Let the scene type on its own; false leaves the field empty, waiting for a reader |
| label | `string` | Accessible name of the whole illustration |
| className | `string` |  |

#### Gradient Floor

<a id="gradient-floor"></a>

`Pro` · Motion: A blurred colour gradient that glows up from the bottom edge – two layers that drift and morph

```tsx
import { … } from "@/components/gradient-floor";
```

| Name | Type | Description |
| --- | --- | --- |
| children | `ReactNode` | Content that sits above the glow; the root needs a height, usually on `className` |
| colors | `GradientFloorColors` | The crest's three stops – defaults to the reference's orange, pink and blue |
| speed | `number` | Seconds per drift loop; 0 holds the shape still |
| className | `string` | Extra class on the root, e.g. for height or rounded corners |

#### Gradient Text

<a id="gradient-text"></a>

`Pro` · Motion: Letters cut from a liquid, ever-flowing gradient – the color sweeps across the word the first time it's seen

```tsx
import { … } from "@/components/gradient-text";
```

| Name | Type | Description |
| --- | --- | --- |
| children | `string` | The word to fill – plain text, because the gradient layer renders the same characters |
| colors | `GradientPalette` | Palette override; the sheet's own palette (and its dark-mode pair) applies when omitted |
| speed | `number` | Seconds per flow loop |
| sweep | `boolean` | Wipe the colour in from the left the first time the word is seen |
| threshold | `number` | Share of the word that must be on screen before the wipe starts, 0–1 |
| className | `string` | Extra class on the root span |

#### Grid Background

<a id="grid-background"></a>

`Free` · Motion: A fine line grid that drifts slowly behind your content and fades out towards the edges

```tsx
import { … } from "@/components/grid-background";
```

| Name | Type | Description |
| --- | --- | --- |
| children | `ReactNode` | Content rendered above the grid |
| size | `number` | Cell size in px |
| color | `string` | Line color – defaults to a faint black, or a faint white in dark mode |
| speed | `number` | Seconds per cell; 0 keeps the grid still |
| direction | `GridDirection` | Drift direction; "diagonal" runs from top right to bottom left |
| reveal | `boolean` | Uncover the grid with a growing circle when it first comes into view |
| fade | `number` | Radius of the edge fade, in % of the distance to the corners |
| className | `string` |  |

#### Integration Beam

<a id="integration-beam"></a>

`Free` · Illustrations: Your product between the tools it connects – light pulses flow along curved beams, hover to focus a tool, click to pause it

```tsx
import { … } from "@/components/integration-beam";
```

| Name | Type | Description |
| --- | --- | --- |
| left | `BeamTool[]` | Tools that send data in (left, or above on narrow widths) – three look best |
| right | `BeamTool[]` | Tools that receive data (right, or below on narrow widths) – three look best |
| center | `BeamCenter` | The product in the middle |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Integration Flow

<a id="integration-flow"></a>

`Pro` · Illustrations: Integration pills rotating along a dashed arc, each beaming its data into a central analysis hub

```tsx
import { … } from "@/components/integration-flow";
```

| Name | Type | Description |
| --- | --- | --- |
| items | `FlowItem[]` | Integrations on the arc — five fill it, and the ring holds up to six |
| hubTitle | `string` | Headline of the hub card |
| hubSub | `string` | Second line of the hub card |
| hubIcon | `ReactNode` | Mark inside the hub badge, drawn in the 118.639 x 118.639 ring |
| label | `string` | Accessible description of the whole scene |
| interval | `number` | Milliseconds per cycle: slide, beam, rest |
| step | `number` | Pin the ring to a step instead of rotating it |
| className | `string` |  |

#### Integration Grid

<a id="integration-grid"></a>

`Free` · Illustrations: Honeycomb-like wall of integration logos around a bright centre tile with your product mark, fading out toward the edges

```tsx
import { … } from "@/components/integration-grid";
```

| Name | Type | Description |
| --- | --- | --- |
| logos | `IntegrationGridLogo[]` | Up to 22 logos, filled row by row around the centre tile – defaults to a set of well-known tools |
| mark | `ReactNode` | Content of the centre tile – defaults to a neutral product mark |
| columns | `5 \| 7 \| 9` | Tiles in the middle row – 9 by default; the rows above and below get two fewer. Use 7 or 5 for a tighter grid |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Layer Stack

<a id="layer-stack"></a>

`Free` · Illustrations: Isometric stack of five layers with a list beside it – the chosen entry lifts its layer out in color

```tsx
import { … } from "@/components/layer-stack";
```

| Name | Type | Description |
| --- | --- | --- |
| items | `LayerStackItem[]` | Up to five entries, top layer first |
| defaultIndex | `number` | Entry to start on |
| interval | `number` | Time per entry while it plays on its own, in ms |
| onChange | `(index: number) => void` | Called when an entry is picked by the user |
| className | `string` |  |

#### Lead Sourcing

<a id="lead-sourcing"></a>

`Free` · Illustrations: ChatGPT tile linked to Gmail and Grok, with a shine running along the connection

```tsx
import { … } from "@/components/lead-sourcing";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Logo Cluster

<a id="logo-cluster"></a>

`Free` · Illustrations: Your mark on a white disc in the middle – company logos bounce out of it and settle around it

```tsx
import { … } from "@/components/logo-cluster";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Model Wheel

<a id="model-wheel"></a>

`Free` · Illustrations: AI model names on a turning drum – the rows bend away at the edges and each model lands on a soft gray fill

```tsx
import { … } from "@/components/model-wheel";
```

| Name | Type | Description |
| --- | --- | --- |
| models | `WheelModel[]` | Models on the wheel – brand marks as a single SVG path; at least 7 keep the drum full |
| hold | `number` | Milliseconds a model stays selected before the wheel turns on |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Number Ticker

<a id="number-ticker"></a>

`Free` · Motion: Odometer-style numbers – every digit rolls to its new value and counts in from zero when it scrolls into view

```tsx
import { … } from "@/components/number-ticker";
```

| Name | Type | Description |
| --- | --- | --- |
| value | `number` | The number to show |
| format | `Intl.NumberFormatOptions` | Intl.NumberFormat options, e.g. { style: "currency", currency: "USD" } |
| locale | `string` | Locale for formatting, e.g. "en-US" – defaults to the browser's |
| duration | `number` | Length of a roll in ms |
| delay | `number` | Wait before the first count-in, in ms |
| className | `string` |  |

#### Outreach Branches

<a id="outreach-branches"></a>

`Pro` · Illustrations: Lines branching out to Gmail, Slack and Notion with colored pulses flowing down

```tsx
import { … } from "@/components/outreach-branches";
```

| Name | Type | Description |
| --- | --- | --- |
| label | `string` | Accessible description of the illustration, read in place of the drawing. |
| className | `string` | Extra class merged onto the root, for a demo to size or place it. |

#### Project Flow

<a id="project-flow"></a>

`Pro` · Illustrations: Animated scene of a client task branching into subtasks, notes and assigned roles

```tsx
import { … } from "@/components/project-flow";
```

| Name | Type | Description |
| --- | --- | --- |
| theme | `"light" \| "dark"` | Card theme; the sheet carries both, keyed off the root's `data-theme` |
| label | `string` | Accessible description of the scene |
| team | `string` | Name on every team pill |
| assignedLabel | `string` | Lead-in above the assignees on each card |
| task | `ProjectFlowCard` | The main task card at the top of the flow |
| subtaskList | `ProjectFlowSubtaskList` | The summary card that sits on the subtask stack |
| subtask | `ProjectFlowCard` | The card the hand drops onto the board |
| client | `ProjectFlowClient` | Client strip along the top edge |
| notes | `ProjectFlowNotes` | Notes card on the right |
| roles | `ProjectFlowRole[]` | Role cards down the right; the reference shows two |
| rolesLabel | `string` | Label on the rounded badge above the role cards |
| className | `string` | Extra class on the root — the scene fills its width |

#### Shimmer Loader

<a id="shimmer-loader"></a>

`Free` · Motion: Skeleton blocks that share one soft light sweep, plus shimmering text for “Thinking…” states

```tsx
import { … } from "@/components/shimmer-loader";
```

| Name | Type | Description |
| --- | --- | --- |
| width | `number \| string` | Width – a number is px, a string any CSS length; defaults to 100% |
| height | `number \| string` | Height – a number is px, a string any CSS length; defaults to 12px |
| radius | `number \| string` | Corner radius; defaults to 6px |
| circle | `boolean` | Round shape, e.g. for avatars – uses width for both sides |
| className | `string` |  |
| style | `CSSProperties` |  |

#### Side Folder

<a id="side-folder"></a>

`Free` · Illustrations: Glassy blue folder on its side, documents sliding out to the right as the pocket swings open on hover

```tsx
import { … } from "@/components/side-folder";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Tab Overload

<a id="tab-overload"></a>

`Free` · Illustrations: Overlapping browser windows where the highlight follows the hovered tab

```tsx
import { … } from "@/components/tab-overload";
```

| Name | Type | Description |
| --- | --- | --- |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Team Invite

<a id="team-invite"></a>

`Free` · Illustrations: Connected teammates – a cursor drags a new one into the empty slot, the line turns solid and they go online

```tsx
import { … } from "@/components/team-invite";
```

| Name | Type | Description |
| --- | --- | --- |
| avatars | `[TeamInviteAvatar, TeamInviteAvatar, TeamInviteAvatar]` | The two teammates that are already connected, then the one being invited |
| className | `string` |  |
| label | `string` | Accessible description of the scene |

#### Text Reveal

<a id="text-reveal"></a>

`Free` · Motion: Text that arrives word by word or letter by letter – each piece rises out of a soft blur as it scrolls into view

```tsx
import { … } from "@/components/text-reveal";
```

| Name | Type | Description |
| --- | --- | --- |
| text | `string` | The text to reveal |
| by | `"word" \| "char"` | Reveal word by word or letter by letter |
| stagger | `number` | Time between two pieces, in ms |
| delay | `number` | Wait before the first piece, in ms |
| duration | `number` | Time each piece takes to arrive, in ms |
| as | `"p" \| "h1" \| "h2" \| "h3" \| "span"` | Element to render |
| once | `boolean` | Reveal only the first time; otherwise it plays again each time it enters the view |
| className | `string` |  |

#### Tilt Card

<a id="tilt-card"></a>

`Pro` · Motion: A card that tilts in 3D towards the pointer, with a soft glare that follows it and a smooth spring back

```tsx
import { … } from "@/components/tilt-card";
```

| Name | Type | Description |
| --- | --- | --- |
| children | `ReactNode` | The card's content – it fills the tilting surface |
| maxTilt | `number` | Maximum tilt in degrees at the very edge of the card |
| glare | `boolean` | Show a soft glare that follows the pointer |
| scale | `number` | Scale while the pointer is over the card |
| perspective | `number` | Perspective distance in px – smaller is more dramatic |
| className | `string` | Extra class on the wrapper; set --ui-tlt-radius to match your card's corners |

#### Voice Orb

<a id="voice-orb"></a>

`Pro` · Illustrations: The face of a voice assistant – a sphere of dots that breathes, catches sound, collapses into a spinning ring while thinking and ripples when it speaks

```tsx
import { … } from "@/components/voice-orb";
```

| Name | Type | Description |
| --- | --- | --- |
| state | `VoiceOrbState` | What the assistant is doing — the orb melts from one shape into the next |
| level | `number` | Loudness from 0 to 1 while listening or speaking; omitted, it improvises a natural level |
| size | `number` | Edge length of the canvas in px |
| dots | `number` | Dots in the sphere — raise it along with the size |
| label | `boolean \| Partial<Record<VoiceOrbState, string>>` | The line under the orb: `false` hides it, an object relabels single states |
| onPress | `() => void` | Makes the orb the button that starts and stops listening |
| interactive | `boolean` | Dots give way to the pointer |
| className | `string` |  |
| style | `CSSProperties` | Inline styles on the root — set `--ui-vo-accent` here to recolour the lit dots |

#### World Map Continental

<a id="world-map"></a>

`Pro` · Illustrations: World map with one highlighted continent and a pastel band along its coastline, switchable between all six

```tsx
import { … } from "@/components/world-map";
```

| Name | Type | Description |
| --- | --- | --- |
| continent | `Continent` | The continent to light up, when the parent owns the choice |
| defaultContinent | `Continent` | Continent highlighted on first render, when `continent` is not given |
| onContinentChange | `(continent: Continent) => void` | Called with the continent the viewer picks in the corner menu |
| showSwitcher | `boolean` | Show the continent menu in the top-left corner of the map |
| label | `string \| ((continent: Continent) => string)` | Accessible name for the drawing; by default it names the highlighted continent |
| className | `string` |  |
