# Manual testing

The automated suite covers the tracking logic. It cannot tell you whether the
extension loads, whether the popup opens, or whether the charts look right.
This checklist covers the rest.

Budget about 15 minutes for the core pass. The two time-dependent checks at the
end can be left running in the background.

---

## Setup

```bash
npm install
npm run build
```

**Chrome:** open `chrome://extensions` → enable **Developer mode** (top right)
→ **Load unpacked** → select the `dist` folder.

**Brave:** open `brave://extensions` → enable **Developer mode** (bottom left)
→ **Load unpacked** → select the `dist` folder.

Select `dist`, not the project root. The root has no `manifest.json`.

> Use a normal browser window, not a private/incognito one — extensions are
> disabled there by default, and idle detection behaves differently.

---

## 1. It loads

| Check | Expected |
|---|---|
| The extension appears in the list | Name **TimeScope**, version 1.0.0 |
| No red **Errors** button on the card | No manifest or load errors |
| Permissions shown on the card | Only: read browsing history*, and nothing about page content |
| The dashboard opens in a new tab automatically | First install only |
| The toolbar shows the donut icon | Recognizable at toolbar size |

\* Chrome describes the `tabs` permission as "read your browsing history". That
wording is Chrome's, not the extension's — it is what `tabs` is labelled as.
The extension stores only domains. See the Privacy section of the README.

**Check the service worker started:** on the extension card, click
**service worker** (under *Inspect views*). A DevTools window opens.

> **Leave this DevTools window open for the whole test pass.** The Console tab
> should stay empty. Any red error here is a real bug.

---

## 2. Tracking counts the right things

This is the core of the product. Do these in order.

### 2.1 It counts the tab in front of you

1. Open a new tab, go to `github.com`. Leave it focused for **~1 minute**.
2. Click the toolbar icon.

**Expected:** the popup shows **Currently · GitHub** with a timer near 1m,
and Today's total is roughly the same.

### 2.2 It stops counting background tabs

1. Open a second tab to `youtube.com`. Stay there **~1 minute**.
2. Open the popup.

**Expected:** Currently shows **YouTube**. Top websites lists **both** GitHub
and YouTube at roughly a minute each.

**The important part:** GitHub is still open in the other tab, but its time
stopped when you switched away. It should *not* have grown to 2 minutes.

### 2.3 It stops when the browser loses focus

1. Note YouTube's time in the popup.
2. Close the popup. Click another application (Finder, your editor) so the
   browser is no longer in front. Wait **~1 minute**.
3. Click back into the browser and open the popup.

**Expected:** YouTube's time has **not** increased by a minute. It may have
gained a second or two at the edges; a full minute of growth is a bug.

### 2.4 It stops when you are idle

1. Focus a tab on any site.
2. **Do not touch the keyboard or mouse for 90 seconds.** Do not move the
   mouse at all — the idle threshold is 60 seconds of no input.
3. Move the mouse and open the popup.

**Expected:** roughly 60 seconds was credited, not 90. The final idle period is
backdated out.

While idle, the popup shows **Away from the computer** instead of a site.

### 2.5 The same site in two tabs is one session

1. Open `youtube.com` in two separate tabs.
2. Switch between the two tabs several times over **~2 minutes**.
3. Open the dashboard → **Sessions**.

**Expected:** YouTube shows **one** continuous session of ~2 minutes, not two
sessions and not 4 minutes of total time. Switching between tabs on the same
site must not restart or double-count.

### 2.6 Rapid switching does not corrupt anything

1. Open three tabs on three different sites.
2. Switch between them quickly — a dozen switches over ~20 seconds.
3. Open the dashboard → **Sessions**.

**Expected:** no negative durations, no overlapping time ranges, no session
listed twice. Very brief flick-throughs (under a second) are discarded rather
than recorded as noise.

### 2.7 Internal pages are not tracked

1. Sit on `chrome://extensions` (or `brave://settings`) for ~30 seconds.
2. Open the popup.

**Expected:** the popup says **Nothing to track**, and no `chrome://` entry
ever appears in the website list.

---

## 3. The dashboard

Open it from the popup's **Open dashboard** button.

### Overview

| Check | Expected |
|---|---|
| Greeting | Time-appropriate, calm, no motivational language |
| Total browser time | Matches roughly what you accumulated above |
| Time by category | GitHub under Development, YouTube under Entertainment |
| Top websites | Ranked by time, with favicons and bars |
| Browser activity | Bars in the hours you were actually browsing |
| Hover a bar in Browser activity | Tooltip with the hour and duration |
| Range selector | Today / Yesterday / Last 7 days all switch cleanly |
| Last 7 days | Shows the daily trend chart with an average line |

Numbers should never read `NaN`, `undefined`, `Infinity` or `-1m`.

### Websites

- The full list appears, ranked, with category labels and percentages.
- Clicking a row opens that site's detail page.

### Website detail

- Today's total, session count, average session, longest session.
- Average and longest are consistent with the sessions listed below.
- The 7-day sparkline renders (mostly empty on a fresh install — that is fine,
  it should not look broken).
- The back link returns to Websites.

### Sessions

- Sessions grouped by site, each with a total and a session count.
- Individual sessions show a start–end time range and a duration.
- The arrows step to previous days. The forward arrow is disabled on today.
- An empty past day shows **No sessions recorded**, not a broken panel.

---

## 4. Settings

### Pause tracking

1. Settings → toggle **Track browser time** off.
2. Browse somewhere for ~30 seconds. Open the popup.

**Expected:** popup says **Tracking paused**; no new time recorded.

3. Toggle it back on and confirm tracking resumes.

### Exclusions

1. Add `youtube.com` to excluded websites.
2. Visit YouTube for ~30 seconds. Open the popup.

**Expected:** popup says **This site is excluded**; YouTube's total stops
growing. Previously recorded time is kept, not deleted.

3. Remove the exclusion afterwards.

Also worth trying: paste a full URL like `https://www.reddit.com/r/all` into
the field. It should normalize to `reddit.com`.

### Categories

1. Reassign a site — put YouTube under **Learning**.
2. Go back to Overview.

**Expected:** the category breakdown updates immediately; YouTube's time has
moved from Entertainment to Learning.

### Theme

Switch **System / Light / Dark**.

| Check | Expected |
|---|---|
| Dark mode | Applies instantly, no white flash |
| Text legibility | Secondary and muted text readable in both modes |
| Charts | Bars and category colours remain distinguishable in both |
| System | Follows your OS setting; changing the OS theme updates it live |
| Reopening the dashboard | Your choice persisted |

### Export

1. Click **Export JSON**. Open the downloaded file.

**Expected:** it contains `domain`, `category`, timestamps and durations —
and **no full URLs, query strings or page titles**. Search the file for
`https://`; there should be no match in the recorded data.

2. Click **Export CSV**. It should open cleanly in a spreadsheet, one row per
   session.

### Delete all data

1. Click **Delete all data**.

**Expected:** a confirmation dialog appears, clearly worded. **Escape** and
**Cancel** both dismiss it without deleting.

2. Confirm with **Delete everything**.

**Expected:** all recorded history is gone; the dashboard shows empty states,
not broken charts. Your settings, exclusions and categories are **kept**.

---

## 5. Empty states

Easiest to check right after deleting all data.

| Where | Expected |
|---|---|
| Overview | "No browser activity yet" — no `NaN`, no empty chart frames |
| Sessions | "No sessions recorded" |
| Websites | Empty state, not a blank panel |
| Popup | "No browser activity yet today" |

---

## 6. Robustness

### Service-worker restart

Manifest V3 suspends workers constantly, so this must be right.

1. Browse a site for ~2 minutes so a session is in flight.
2. `chrome://extensions` → click the **reload** (circular arrow) icon on the
   TimeScope card. This kills and restarts the service worker.
3. Open the dashboard.

**Expected:** the time recorded before the reload is intact. No duplicated
session in the Sessions view. Tracking continues normally afterwards.

The in-flight session should survive intact: a reload is a worker restart, and
a restart within a couple of minutes of the last heartbeat is treated as
continuous rather than as a stopped session.

### Quiet reading is recorded

This is the check that catches the most subtle class of bug. The worker is
suspended after ~30 seconds without events, so a page you simply *read*
generates no events at all.

1. Open a long article and **read it for 5 minutes without switching tabs**.
   Scroll normally; do not switch tabs or windows.
2. Switch to another tab, then open the popup.

**Expected:** the article's site shows ~5 minutes. If it shows under a minute,
time is being lost across worker suspensions.

### Browser restart

1. Note today's total.
2. Quit the browser completely. Reopen it.
3. Open the popup.

**Expected:** today's total is preserved and a new session starts on whatever
site you land on.

### No console errors

Check both:
- The service worker DevTools window you opened in step 1.
- The dashboard's own console (right-click → Inspect on the dashboard tab).

Both should be free of red errors through the whole pass.

---

## 7. Responsiveness

Narrow the dashboard window progressively down to about 700px wide.

**Expected:** the sidebar becomes a horizontal tab strip; panels stack; no
horizontal scrollbar; no text clipped or overlapping; charts reflow rather
than overflow.

---

## 8. Time-dependent checks

These need patience rather than attention. Run them when convenient.

### Idle over a long absence

Leave the browser focused on a video site and walk away for **30+ minutes**
without locking the screen.

**Expected:** roughly one minute is credited, not thirty. This is the check
that separates real active-time tracking from counting tab-open time.

### Midnight rollover

Leave the browser open and focused on a site across midnight.

**Expected the next day:** the session is split — time before midnight belongs
to the previous day, time after to the new one. Neither day double-counts, and
"Today" resets to the new day's total.

You can reach the previous day via **Sessions** → back arrow.

---

## 9. Brave

Run at minimum sections 1, 2.1–2.3 and 3 again in Brave.

Brave ships Chromium's extension APIs, so behaviour should be identical. Two
things worth confirming specifically:

- **Favicons** still render. Brave is stricter about some resource loading; if
  an icon is missing, the monogram fallback should appear rather than a broken
  image.
- **Idle detection** works — confirm with the 90-second test in 2.4.

---

## Reporting a problem

Useful details:

- Browser and version (`chrome://version` / `brave://version`)
- Which numbered check failed, and what you saw instead
- Any red error from the service-worker console
- Whether it reproduces after reloading the extension

Timing checks are the most likely to produce a false alarm — an unnoticed mouse
nudge resets the idle timer, and a background OS notification can pull focus.
If a timing test fails, run it once more before concluding it is broken.
