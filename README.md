# TimeScope

**See where your browser time actually goes.**

TimeScope is a browser extension that measures how long you actively spend on
each website, then shows you the answer in a dashboard that reads like a
proper analytics tool rather than a nag screen.

It records that you spent 2h 14m on YouTube and 1h 36m on GitHub. It does not
tell you how to feel about that.

Everything stays on your machine. There is no account, no server, and no
network request of any kind.

---

## Contents

- [The problem it solves](#the-problem-it-solves)
- [Features](#features)
- [Installing](#installing)
- [Privacy](#privacy)
- [Permissions](#permissions)
- [How tracking works](#how-tracking-works)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Design notes](#design-notes)
- [What V1 deliberately leaves out](#what-v1-deliberately-leaves-out)

---

## The problem it solves

Most people have a rough sense that they spend "too long online" and no idea
where the time actually goes. Browser history tells you *what* you visited, not
*how long* you stayed. Phone screen-time tools cover the phone and ignore the
desktop browser, which is where most knowledge work happens.

TimeScope answers two questions:

> Where did my browser time go today?

> How has my browser usage changed over the last few days?

That is the whole product. It is an instrument, not a coach.

### Who it is for

- **Developers and knowledge workers** who want an honest picture of a working
  day without handing their browsing history to a SaaS dashboard.
- **Anyone uncomfortable with cloud trackers.** The data physically cannot
  leave the machine, because the extension has no code that sends anything.

---

## Features

### Accurate active-time tracking

Time counts only when a site is genuinely in front of you. TimeScope stops the
clock when you switch tabs, switch windows, minimize the browser, move to
another application, lock the screen, or walk away from the keyboard.

A background tab accrues nothing, however long it stays open.

### Sessions, not just totals

Every continuous stretch of attention is recorded as its own session, so you
can see that three hours on YouTube was one long evening rather than forty
interruptions — or the reverse.

```
YouTube
2h 14m total · 4 sessions

14:31 – 15:42     1h 11m
12:04 – 12:17       13m
10:32 – 10:51       19m
09:14 – 09:45       31m
```

### Categories

Sites are grouped into Development, Work, Learning, AI, News, Social,
Entertainment, Shopping and Other, using a local lookup table. No AI, no
external API, no calls home. Any site can be reassigned in Settings.

Categories are organizational labels. TimeScope never claims a category is
productive or wasteful.

### A real dashboard

- **Overview** — total time, category breakdown, top sites, activity by hour
- **Websites** — the full ranked list, and a detail page per site
- **Sessions** — every session of a chosen day, grouped by site
- **Settings** — pause tracking, exclusions, categories, export, delete

With Today, Yesterday and Last 7 days ranges throughout.

### Yours to take or delete

Export everything as JSON or CSV, or delete all recorded history, at any time,
in one click.

---

## Installing

TimeScope is not on the Chrome Web Store. Load it as an unpacked extension.

### 1. Build it

```bash
npm install
npm run build
```

This produces a `dist/` directory — that is the extension.

### 2. Load it

**Chrome**

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist` folder

**Brave**

1. Open `brave://extensions`
2. Turn on **Developer mode** (bottom left)
3. Click **Load unpacked**
4. Select the `dist` folder

Any Chromium browser with Manifest V3 support works the same way — Edge uses
`edge://extensions`, Vivaldi uses `vivaldi://extensions`.

The dashboard opens automatically the first time. After that, click the
toolbar icon for the popup, or **Open dashboard** for the full view.

> **Note:** pick the `dist` folder, not the project root. The project root has
> no `manifest.json` — it is generated into `dist` at build time.

---

## Privacy

This is the part worth reading carefully, because privacy claims are cheap.

**What is stored**, entirely in `chrome.storage.local` on your device:

| Field | Example |
|---|---|
| Domain | `github.com` |
| Category | `development` |
| Session start / end | epoch milliseconds |
| Duration | `1140000` |

**What is never stored, anywhere:** full URLs, paths, query strings, page
titles, page contents, form data, passwords, cookies, search queries, or
browsing history beyond the aggregate above.

A visit to `https://github.com/you/private-repo?token=abc#section` is recorded
as the string `github.com` and a pair of timestamps. The rest is discarded
before anything is written.

### The extension makes no network requests

Not "we promise not to" — there is no networking code in the shipped bundle.
You can verify it yourself:

```bash
npm run build
grep -rE '\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource)\s*\(' dist/
```

This returns nothing. There is no backend, no telemetry, no analytics SDK, no
crash reporter, and no remote font or script. The extension works fully
offline because it has nothing to be online for.

Favicons come from Chrome's own local favicon cache via the `favicon`
permission, so no third-party favicon service ever sees the list of sites you
visit. Sites the browser has no cached icon for fall back to a generated
monogram tile.

### Data retention

Raw session detail is kept for 30 days; daily totals for a year. Older data is
pruned automatically once a day. Nothing grows without bound.

---

## Permissions

Five permissions, each load-bearing. The extension requests no host
permissions and injects no content scripts.

| Permission | Why it is needed |
|---|---|
| `tabs` | Read the active tab's URL to derive its domain. Without it `tabs.query` returns no URL and there is nothing to measure. |
| `storage` | Save settings and daily records locally. |
| `alarms` | The one-minute heartbeat and midnight rollover. Alarms survive service-worker suspension; `setInterval` does not. |
| `idle` | Notice that you have stepped away, so an untouched tab does not accrue phantom hours. |
| `favicon` | Render site icons from the browser's local cache instead of calling an external favicon service. |

**Deliberately not requested:** `history`, `bookmarks`, `cookies`,
`webRequest`, `scripting`, `<all_urls>`, or any host permission. TimeScope
cannot read page content, because it never asked to.

---

## How tracking works

### One question, asked on every event

Browser events do not carry meaning — a tab id only says *something changed*.
So every event (tab activated, tab updated, window focus changed, idle state
changed, settings changed, worker restarted) funnels into a single function
that asks the browser what is true right now and answers one question:

> What, if anything, should be counted at this moment?

```
trackingEnabled?  no  → IDLE (paused)
idle or locked?   yes → IDLE (user away)
window focused?   no  → IDLE (browser not in front)
URL trackable?    no  → IDLE (internal page)
domain excluded?  yes → IDLE (excluded)
otherwise             → ACTIVE(domain)
```

The tracker then moves to that state. There are no per-event branches and no
scattered booleans, so every transition is deterministic.

### Two invariants that make double counting impossible

1. **At most one session is open at any time.** Two tabs on `youtube.com`
   resolve to the same target, so switching between them is a no-op — not a
   second session.
2. **Transitioning to the domain already open does nothing.** Rapid tab
   switching cannot fragment or duplicate time.

### Idle detection

After 60 seconds of no keyboard or mouse activity, Chrome reports the user as
idle and the clock stops. The threshold is configurable (30s to 5 minutes).

60 seconds is the default because it is long enough that reading a long article
or watching a video without touching the mouse is not mistaken for absence, and
short enough that leaving the desk stops the clock promptly.

One subtlety: the idle event arrives *after* the full threshold has already
elapsed, so the session end is backdated by exactly that much. Walking away
from a playing video stops your recorded time at the moment you actually
stopped, not a minute later.

### Surviving the service-worker lifecycle

Manifest V3 suspends service workers aggressively — after roughly thirty
seconds without events. Reading a single long article generates no tab or
window events at all, so the worker running the tracker is killed and revived
repeatedly in the middle of perfectly ordinary browsing.

**A suspended worker is not a stopped session.** TimeScope treats the two
differently, and the distinction is the whole trick.

The open session is mirrored to storage on every transition and refreshed by a
one-minute heartbeat alarm. When a new worker generation starts, it looks at how
stale that snapshot is:

| Snapshot age | Interpretation | Action |
|---|---|---|
| Within ~2½ min | The worker was merely suspended. The heartbeat proves the session was alive a moment ago. | **Adopt** the session unchanged — it never stopped. |
| Older | Something unaccounted for happened: the machine slept, the browser quit, alarms stopped firing. | Credit only up to the last confirmed heartbeat; discard the unverified tail. |

Adopting means the session continues with its original start time, so a revival
costs nothing. The subsequent reconcile then either leaves it running (you are
still on the same site) or closes it at the present moment (you moved on), which
is also what prevents a duplicate session on restart.

The stale path deliberately **under-counts rather than inventing time**: after a
laptop wakes from a week of sleep, the extension credits the minute it could
verify and nothing more.

### Midnight

Sessions never span calendar days. An interval running 23:58 → 00:07 is split
at local midnight into two minutes on one day and seven on the next, with each
part landing in the right day's totals, hourly buckets and session list.

A dedicated alarm fires just after midnight so the split happens even if you
never touch the browser. All day arithmetic uses calendar components rather
than adding 86,400,000 milliseconds, so days that are 23 or 25 hours long
across a daylight-saving change still map to exactly one date.

### Domain normalization

One function turns a URL into a tracked identity.

| URL | Recorded as |
|---|---|
| `https://www.youtube.com/watch?v=123` | `youtube.com` |
| `https://m.youtube.com/shorts/abc` | `youtube.com` |
| `https://github.com/user/repo/issues` | `github.com` |
| `https://gemini.google.com/app` | `gemini.google.com` |
| `http://localhost:3000/` | `localhost:3000` |
| `chrome://extensions` | *not tracked* |

Two decisions worth stating:

**Meaningful subdomains are kept.** `gemini.google.com` and `docs.google.com`
are different products, and collapsing them to `google.com` would need a
bundled Public Suffix List to produce a result most people would find worse.
Only cosmetic prefixes (`www.`, `m.`, `mobile.`, `amp.`) are stripped.

**Loopback hosts keep their port.** `localhost:3000` and `localhost:5173` are
usually unrelated projects, so merging them would make the analytics
misleading. Public hosts drop the port. Developers who would rather see none of
it can exclude `localhost` in Settings, which covers every port at once.

Browser-internal pages (`chrome://`, `brave://`, `edge://`, `about:`, `file://`,
extension pages, `devtools://`, `view-source:`) are never tracked.

---

## Architecture

```
src/
├── background/        service worker: the only code that touches chrome.* events
│   ├── index.ts         event listeners, registered synchronously at top level
│   └── tracker.ts       coordinates the state machine, storage and the browser
│
├── tracking/          pure logic, no browser dependencies, fully unit-tested
│   ├── session-manager.ts    the state machine
│   ├── domain-normalizer.ts  URL → tracked domain
│   └── time-calculator.ts    midnight splitting, hourly bucketing
│
├── storage/           the only module that reads or writes stored data
│   ├── repository.ts    the public API every surface calls
│   ├── schema.ts        keys, defaults, and validation of untrusted records
│   ├── area.ts          narrow port over chrome.storage.local
│   └── migrations.ts    schema evolution
│
├── categories/        catalog, resolver, validated color palette
├── dashboard/         the full UI: pages, components, charts, hash router
├── popup/             the toolbar popup
├── shared/            branding, manifest definition, theme, UI primitives
├── utils/             dates, formatting, exclusion matching
└── types/             every persisted and in-flight shape
```

### Layering

The valuable property is that **tracking logic knows nothing about the
browser**, and **UI knows nothing about storage**.

- `tracking/` is pure functions and one class. It takes timestamps as
  arguments rather than calling `Date.now()`, which is why scenarios like
  midnight, worker restart and rapid switching can be tested exactly, with no
  mocked clock.
- `background/tracker.ts` is the only place those two worlds meet.
- Every read and write goes through `TrackingRepository`. No component calls
  `chrome.storage` directly, so validation, caching and retention live in one
  place — and swapping in IndexedDB later means changing one file.

### Storage layout

```
meta              schema version, install time, last prune date
settings          user preferences
tracker:state     snapshot of the in-flight session, for crash recovery
day:2026-09-22    one record per local calendar day
```

One key per day makes the common read — "show me today" — a single storage hit,
while keeping each written value small. A day's totals, hourly buckets and
sessions live in one record, so they are always written atomically and can
never disagree with each other.

Every record read from storage is validated on the way out. A corrupted or
truncated day degrades to an empty day rather than throwing inside a chart.

### Performance

The extension is event-driven. It does not poll.

- **One recurring timer**, the one-minute heartbeat, which returns immediately
  and writes nothing when no session is open.
- **Storage writes happen on transitions**, not on a schedule. Reading this
  README for ten minutes produces one write, not six hundred.
- **No content scripts**, so no per-page cost on any site you visit.
- **No network requests**, so no radio wake-ups and no battery cost.

---

## Development

```bash
npm install        # install dependencies
npm run dev        # rebuild into dist/ on every change
npm run build      # typecheck, then production build
npm run test       # run the test suite
npm run test:watch # run tests on change
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

`npm run dev` watches and rebuilds. Reload the extension from
`chrome://extensions` to pick up changes to the service worker; dashboard and
popup changes need only a refresh.

### Stack

| Choice | Reason |
|---|---|
| Manifest V3 | Required by Chrome; Brave and Edge follow. |
| TypeScript | The tracker is a state machine over persisted records — exactly the code where types prevent real bugs. |
| React 19 | The dashboard is genuinely stateful. The popup is small enough that React is a convenience rather than a necessity. |
| Vite | Multi-entry builds (dashboard, popup, service worker) with no configuration fight. |
| Tailwind | Layout and spacing only. Every color resolves to a CSS custom property, so theming is one attribute on `<html>`. |
| **No chart library** | A donut, horizontal bars and two bar charts are about 150 lines of SVG. Recharts would add a d3 dependency tree for less control over how the result looks. |
| **No router** | Four destinations. The hash router is 30 lines and lets `options_page` deep-link to `dashboard.html#/settings`. |
| **No state manager** | There is no client state worth centralizing. Data lives in storage; hooks read it and re-render on change. |

Every dependency is there for a reason, and the runtime dependency list is two
entries: `react` and `react-dom`.

### Renaming the extension

Edit `src/shared/branding.ts`. The manifest is generated from it at build time
and every surface imports it.

---

## Testing

```bash
npm run test
```

100 tests covering the logic that is expensive to get wrong.

**Tracking state machine** — tab switching, window blur and focus, idle,
returning after an absence, rapid switching, the same site open in several
tabs, clock moving backwards.

**Service-worker lifecycle** — restart with a session in flight, restart with
nothing in flight, no duplicate session on recovery, live state re-derived from
the browser afterwards, browser restart preserving earlier sessions.

**Time mathematics** — midnight splitting, multi-day sessions, hourly bucket
distribution, conservation of total duration, no negative durations.

**Domain normalization** — subdomains, cosmetic prefixes, loopback ports,
browser-internal schemes, malformed input.

**Storage** — corrupted records, invalid settings, retention pruning, export
shape, and an explicit assertion that no raw URL ever reaches storage.

The tracker tests run against an in-memory fake of the `chrome` API and an
in-memory storage area, so a full scenario — "open YouTube, switch to GitHub,
blur the window, go idle, restart the worker" — runs in milliseconds with no
browser involved.

### Manual testing

Automated tests cannot verify that the extension loads, that the popup opens,
or that the charts look right. See [MANUAL-TESTING.md](MANUAL-TESTING.md) for a
checklist to run after loading the unpacked build.

---

## Design notes

The UI aims to feel like an instrument: calm, dense with information, quiet
about it.

**Color is used sparingly and on purpose.** The category palette is eight hues
plus a neutral for "Other". They were not chosen by eye — they were validated
with a contrast and colour-vision-deficiency checker against both the light and
dark surfaces, clearing the lightness band, chroma floor, normal-vision
separation floor and 3:1 contrast in both modes. Every place a category colour
appears, its name appears next to it in text, so colour never carries meaning
on its own.

**Borders, not shadows.** At this information density, shadows read as clutter
and borders read as structure.

**Type does the work.** Five sizes, three weights, tabular figures everywhere a
duration appears so columns line up and numbers do not jitter as they tick.

**Motion is almost absent.** One entrance animation per view change. Nothing
moves continuously, and `prefers-reduced-motion` disables even that.

**Accessibility is structural, not a pass at the end.** Semantic HTML,
keyboard-operable controls, a visible focus ring that is never removed, labels
tied to their inputs, the native `<dialog>` element for confirmation so focus
trapping is correct, and text contrast verified at 4.5:1 against both surfaces.

---

## What V1 deliberately leaves out

No productivity score, no rankings, no goals, no time limits, no site blocking,
no focus mode, no streaks, no distraction detection, no AI categorization, no
accounts, no sync, no notifications.

Some of these may be worth building later. None of them are needed to answer
"where did my browser time go?", and each one would pull the product toward
judging the user instead of informing them.

The architecture leaves room for them. `Settings.categories` already supports
user-defined categories; the storage layer already separates raw sessions from
daily aggregates; the repository is a seam for swapping in IndexedDB. None of
that is built yet, because V1 does not need it.

---

## License

MIT.
