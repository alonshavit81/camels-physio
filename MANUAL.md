# Camels Physio — Owner's Manual

*For Shahar, who runs the app for the physio team. Part 1 is for everyday use and can be shared with Maya and Neta. Part 2 is for whoever maintains the code (you, or a developer you hand it to).*

- Live app: **https://alonshavit81.github.io/camels-physio/**
- Source code: https://github.com/alonshavit81/camels-physio
- Last updated: 20 September 2026

---

## Part 1 — Using the app

### 1. What it is, in one minute

Camels Physio is a small web app for the three physiotherapists (Shahar, Maya, Neta). It keeps:

- the **team calendar** (trainings and games) and each physio's **work days**,
- **player profiles** (fitness, body type, past injuries, range of motion, strengthening),
- one **session** per training/game/work day with the players' attendance and any **injury reports**,
- **injury statistics** (totals, most injured players, body parts).

Three facts explain everything else:

1. **There is no server.** Each phone keeps its own copy of the data, inside the browser. Nothing is uploaded anywhere.
2. **Phones sync by exchanging a file.** After training one physio exports a backup file and posts it in the WhatsApp group. Before the next training everyone imports the newest file. The app *merges* files, it never overwrites blindly.
3. **The app is a web page.** It lives at the address above and is installed on each phone by adding it to the Home Screen. New versions arrive by themselves the next time the app is fully closed and reopened; nobody has to install anything, and an update never touches the data on the phones.

Words like *session*, *merge* and *backup file* are explained in the glossary at the end (§14).

### 2. Installing on a phone (once per phone)

1. Open **Safari** (not Chrome, not the browser inside WhatsApp) and go to https://alonshavit81.github.io/camels-physio/ If you tapped the link inside WhatsApp, tap the ⋯ or Share icon and choose **Open in Safari** first.
2. Tap **Share** (the square with the arrow) → **Add to Home Screen** → **Add**.
3. Open the new "Physio" icon. Pick your name and tap **Continue**. The phone remembers you.

From now on always use the Home Screen icon. On iPhone the Home Screen app and Safari tabs keep **separate** data, so switching between them looks like data vanishing.

Android phones install the same way with Chrome (menu → *Add to Home screen*); there the icon and the Chrome browser share the same data.

**The very first day (no file in the group yet)**

1. Shahar installs the app, picks *Shahar*, opens **Calendar** and, in *Team Events* mode, taps the month's training and game days.
2. Maya and Neta install the app and tap their work days in *My Attendance* mode.
3. Shahar taps 🏁 → **Share JSON to WhatsApp**. That first file is the starting point for everyone; from then on the daily routine (§4) applies.

Until the first import, the red bar says "No import yet". That is expected.

### 3. Who can do what

| | Shahar (Manager) | Maya / Neta (Physio) |
|---|---|---|
| Set trainings and games on the calendar | ✅ | ❌ (view only) |
| Mark own work days | ✅ | ✅ |
| Create this month's sessions (the **Apply Monthly Attendance** button) | ✅ | ✅ |
| Mark attendance, report injuries, edit profiles | ✅ | ✅ |
| Add / delete extra players | ✅ | ✅ (the original 14 cannot be deleted) |
| Export / import backup files | ✅ | ✅ |

You switch user by tapping the name in the red bar under the header. There is no password: anyone holding the phone can pick any name. It is a convenience, not a lock.

- **Substitute physio**: the app knows only the three names. The substitute picks the name of the physio they are replacing (on that physio's phone, or on their own phone after installing (§2) and importing the newest file) and writes "covered by …" in the session notes. They export with 🏁 at the end like everyone else.
- **Any phone will do**: the data is in the file, not in the phone. A new or borrowed phone is ready after install + import.

### 4. The daily routine

In the app, a *session* is the page for one training, game or work day: who was there and which injuries were reported.

**Before training — 🏃 Start Training**

1. In the WhatsApp group tap the newest backup file (its name starts with `camels-physio_` and ends in `.json`; it opens as a preview) → Share icon → **Save to Files** → *On My iPhone* → **Save**.
2. In the app tap 🏃 (top right of the red header) → **Choose File**. The Files picker opens: go to *On My iPhone* (or *Recents*) and tap the file. The sheet also shows a few reminders (tape, priorities); just read them.
3. Read the summary: how many records were new, updated, or already the same. "Already up to date" is a normal, good result.

**During training**

- When the app is launched it opens directly on today's session if one exists (any type); on a training or game day it creates the session first if needed. If it opens on the Calendar instead, the day is not on the calendar yet: tap the day (Shahar for a training or game, anyone for a work day), tap **Apply Monthly Attendance** and open the session from the **Sessions** tab.
- When you open a session on the day (or the day after), the roster starts with everyone **Present**; tap **Absent** or **Injured** only for the exceptions. Older and future sessions open with everyone unmarked (**–**), so a forgotten roll call is never invented; for those, tap **Mark unmarked as present** at the top of the roster and then fix the exceptions.
- Tap **+ Injury** next to a player to report an injury (body part, side, severity, status, notes). It appears immediately in the player's profile and in the statistics.
- Notes at the top of the session are saved automatically.

**After training — 🏁 End Training**

1. Tap 🏁 (top right). The app first creates any missing sessions for this month, then shows a few reminders and the export button.
2. Tap **Share JSON to WhatsApp** and send the file to the group. In the Home Screen app that is the only button. **Download JSON** appears only when sharing is unavailable, or when the app is opened in a Safari tab (there the file lands in Files › Downloads). In the Home Screen app a download opens a preview instead: tap the Share icon there and choose **Save to Files**.
3. If only one phone was used, one export is enough. If two physios entered data on two phones, each exports their own file; at the next training each imports the other's file, and the app merges the two. Order does not matter.

**The app reminds you**

- The red bar shows the last import, e.g. "Import: Neta · 2 days ago" ("No import yet" on a fresh phone). Tap it to import.
- A small dot on 🏁 means this phone has changes that nobody else has yet.
- A blue "You may be behind" notice appears when the phone has activity newer than its last import or export. *Import now* opens the import sheet; *Not now* hides it for the day.

### 5. The three tabs

**Calendar** — one month at a time.
- *Team Events* mode: Shahar taps a day to cycle Training → Game → clear. Others can look.
- *My Attendance* mode: tap the days you worked. Your coloured dot appears (Shahar blue, Maya green, Neta purple).
- A small grey dot in the corner of a day means that day already has a session.
- The card at the bottom counts each physio's work days this month.
- **Apply Monthly Attendance**: despite the name, it simply creates the sessions of the month shown, one for every training, game or work day that does not have one yet. It also removes sessions that were taken off the calendar, but only if they are empty. It is safe to run as often as you like; 🏁 runs it for the current month.

**Players** — the roster sorted by jersey number.
- Search by name or number. Tap a player for the profile: name, number, fitness level, body structure, body type (Athletic / Flexible / Strong / Compact), past injuries, range of motion, strengthening exercises. Press **Save changes**.
- The **Injury log** under the form is filled automatically from session reports. You can also add an injury here (for example one that happened outside a session), change its status, or delete it.
- **Add player** creates an extra player. Extra players can be deleted; the original 14 cannot.

**Sessions** — every session, newest first, with an injury overview on top.
- "Not on calendar" on a session means its day is no longer a training, game or marked work day. An empty session like that disappears at the next **Apply Monthly Attendance**. A session that holds data is kept: if it really did not happen, open it, set every player back to **–** (not marked), delete its injuries and empty the notes; the next **Apply Monthly Attendance** then removes it.

### 6. Rules of the merge (so surprises make sense)

- Every record carries the time and user of its last edit. When the same record was edited on two phones, **the newest edit wins**. Records that exist only on one side are simply added.
- Deletions are remembered too: an injury deleted on one phone stays deleted after the files are merged, even if the other phone still had it, unless the other phone edited that same injury after the deletion (then the newer edit wins and it comes back; delete it again). The same goes for deleted extra players.
- Attendance is merged **per player**, so Maya marking #4 on one phone and Neta marking #7 on another both survive.
- Session types (training/game/work day) always follow the calendar; the calendar itself follows the newest edit.
- The automatic "Present" marks the app writes for everyone do not count as real edits: any mark a person tapped, even earlier, wins over them.
- Importing the same file twice changes nothing. Importing an old file changes nothing either, except adding records the phone never had.

If something looks wrong after an import, the fix is almost always: edit it again (your edit is now the newest) and export.

### 7. Backups and data safety

- **The backup files in the WhatsApp group are the only copies of the data.** Do not delete them. Shahar: once a week, save the newest one to iCloud Drive (or Google Drive) as well.
- **Lost or new phone**: install the app (§2), pick your name, import the newest file. Only what was typed after the last export is lost.
- Safari deletes a website's data after 7 days without use. The Home Screen app is exempt, which is one more reason to install it that way.
- Private Browsing is not safe: the data may vanish when the tab is closed, sometimes without any warning. When the browser blocks storage outright, an amber banner says "This device is not saving data". Either way, export before closing.
- If the app ever says "The data saved on this phone could not be read, so the app started fresh", import the newest file from the group. The unreadable data is kept aside on the phone for a developer to inspect.
- Nothing is uploaded anywhere. Player and injury data stay on the physios' phones and in the group's files. Treat the files as medical information: keep the WhatsApp group private.

### 8. Troubleshooting

| What you see | Why | What to do |
|---|---|---|
| The `.json` file is greyed out in the Files picker | The file was only previewed in WhatsApp and never saved, or iOS does not recognise its type | Save it to Files first (Share → Save to Files). If it is still grey, in Files long-press it → Rename → change `.json` to `.txt`; the app accepts it. |
| "This file is not valid JSON." | The file was edited or cut off in transfer | Ask for the file to be re-sent (or export again) and pick that one. |
| "This file is not a Camels Physio backup." | Wrong file (a photo, a PDF, some other app's JSON) | Pick the newest `camels-physio_….json` from the group. |
| "This backup was made by a newer app version … Please update the app" | The other phone has a newer app | Close the app fully (swipe it away in the app switcher) and reopen it while online; it loads the newest version on a fresh launch. If it still refuses, wait ten minutes and reopen once more. |
| Share sheet does not show WhatsApp | iOS lists apps by recent use | Scroll the app row or tap *More* and enable WhatsApp. |
| Download opens a preview with no way back | Home Screen app quirk on iOS | In the preview, tap the Share icon → **Save to Files** (then send it from Files). Next time use **Share JSON to WhatsApp**; if stuck, swipe up to close the app and reopen it. |
| "Only Shahar can set team events" | Team events are the manager's job | Switch to Shahar on the phone that sets the calendar. |
| My data disappeared | Opened in Safari instead of the Home Screen icon, or the other way round; or the link was opened inside WhatsApp's browser | Use the Home Screen icon. If it is truly gone, import the newest file. |
| The red bar says "No import yet" and there is no file in the group | Nobody has exported yet | Follow "The very first day" (§2); tap 🏁 to make the first file. |
| The Sessions tab says "No sessions yet" | No sessions created for this month | Set the days on the Calendar, then tap **Apply Monthly Attendance**. |
| I entered data before importing today's file | Nothing is wrong | Import now anyway; the app merges and keeps your entries (§6). |
| A player I deleted is back | Another phone edited that player's profile after you deleted the player; the newer edit won | Delete the player again after importing, then export. |
| I want to remove one of the original 14 | They have no Delete button; the app restores them on every phone | Leave the profile and note "left the team" in the name or notes. A proper "retire player" option is on the roadmap (§13). |
| Wrong attendance after an import | Both phones marked the same player differently; the newest tap won | Tap the right value and export. |
| Two copies of the same extra player | Two phones added the same player separately | Delete one copy, preferably the one without injuries (deleting a player deletes that player's injuries too), tap 🏁 and export; after the next import the copy is gone from every phone. |

### 9. Making it stick — tips for the team

- **Agree on one exporter per training** and say who it is in the group. Everyone imports before touching anything.
- Keep the group's files tidy: the newest file is always the right one; the name contains the date, time and who exported.
- **Start of the month**: Shahar sets all the month's trainings and games on the Calendar, then taps 🏁 once: this creates the sessions and posts the backup file. Every phone has the month's sessions after its next import. (If you set next month in advance, open that month in the Calendar and tap **Apply Monthly Attendance** before exporting; 🏁 only creates sessions for the current month.)
- Mark attendance during warm-up: with everyone present by default it takes ten seconds.
- Report injuries in the session, not from memory later. The date, the session and the reporter are recorded automatically.
- Once a month, open Sessions and glance at the injury overview together.

---

## Part 2 — Owning and changing the app

*You do not need this part to run the app. Read only these bits yourself: the last bullet of §10 (handing the app to a new owner), §13 (ideas you can choose from) and §14 (glossary). Everything else, hand to a developer together with the link to the source code. Today the app is published from Alon's GitHub account; if that account ever disappears, the address stops working, but the data on the phones and in the WhatsApp files is untouched.*

### 10. Deployment and updates

- Source lives in the GitHub repository. Every push to the `main` branch runs `.github/workflows/deploy.yml`: install, run the tests, build, publish to GitHub Pages. Phones get the new version the next time they cold-start the app (swipe it away in the app switcher and reopen it while online). There is no service worker; GitHub Pages caches pages for about 10 minutes, so a deploy is visible on the phones within roughly that time.
- Local work needs Node.js 22.12 or newer (the deploy workflow uses Node 22):

  ```bash
  git clone https://github.com/alonshavit81/camels-physio.git
  cd camels-physio
  npm install
  npm run dev        # http://127.0.0.1:5173  (add /.dev/phone.html for a 390×844 phone frame)
  npm test           # unit tests (250)
  npm run build      # type-check + static build in dist/
  ```

- Hosting is free GitHub Pages on a public repository (Pages on a private repository needs a paid plan). The built site is fully static with relative paths, so it can be dropped on any other static host (Netlify, Vercel, a folder on a web server) without changes.
- If a deploy fails with "Get Pages site failed … Not Found", Pages was switched off in the repository settings. Re-enable and re-run:

  ```bash
  gh api -X POST repos/alonshavit81/camels-physio/pages -f build_type=workflow
  gh run rerun "$(gh run list --workflow deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
  ```

- To hand the app to someone else (Shahar can do the first step himself; the new owner needs a free GitHub account): transfer the repository in GitHub settings, then make sure Pages is enabled on the new repository (Settings → Pages → Source: GitHub Actions; if the first deploy fails with "Get Pages site failed", run the `gh api` command above with the new owner). Then update the owner in every URL and `gh` command in `README.md` and this manual. The published address becomes `https://<new-owner>.github.io/camels-physio/` and the old one stops working. Announce the new address in the group and ask everyone to export first, delete the old icon, add the new address to the Home Screen (§2) and import the newest backup file: the new address starts with empty storage, so without the import it looks like all data vanished.

### 11. Architecture

**Stack**: Vite 8, React 19, TypeScript (strict), Tailwind CSS 4, Zustand (state, persisted to `localStorage`), React Router 8 (hash routing), date-fns, lucide-react icons, Vitest.

**Principles**

- *Local-first, no backend.* All state is one JSON blob in `localStorage` under the key `camels-physio` (plus `camels-physio.corrupt` for an unreadable copy and `camels-physio:calendar-mode` for the calendar's last mode).
- *Built to merge.* Every record has `updatedAt` (ISO UTC) and `updatedBy`, except sessions, which merge field by field: notes and each attendance entry carry their own stamp, `physios` is a union, and `type` is recomputed from the calendar. Deletions are tombstones (`deleted: true`, event `kind: 'none'`, work day `worked: false`, attendance `status: 'unset'`) so they beat stale copies.
- *Deterministic ids* wherever two phones could create "the same" thing: the 14 seeded players (`p-<name-slug>`), sessions (`s-<date>`, one per day), team events (keyed by date), work days (`<user>_<date>`). Injuries and extra players get UUIDs.
- *Generated data never beats real edits.* Blank notes and automatic "present" marks carry a far-past timestamp.
- *The calendar is the source of truth* for session types and which physios worked.

**Folder map**

```
src/lib/        pure logic, unit-tested except the two small browser helpers (storage.ts, cn.ts)
  types.ts        every type + option lists (users, body types, body parts, severities…)
  ids.ts          id builders: uuid (with fallbacks), s-<date>, <user>_<date>
  merge.ts        mergeState(): per-record newest-wins, per-player attendance, unions, seed repair
  apply.ts        applyMonthlyAttendance(): sessions from the calendar, idempotent, prune-only-empty
  backup.ts       parse/validate imported files, build exports, schema migrations
  backupFile.ts   Web Share / download / file reading around iOS Safari quirks
  storage.ts      localStorage wrapper that never throws; flags the device as "not saving"
  sync.ts         "am I behind?", "open on today's session", "default to present" rules
  dates.ts        local date keys (yyyy-MM-dd), month grids, relative times
  seedPlayers.ts  the 14 players and their ids
  users.ts        the three users, colours, permissions
  base64.ts, cn.ts  small helpers (UTF-8 safe base64, class-name join)
src/store/      Zustand store (all actions), selectors/hooks, toast store
src/components/ layout (header, bottom nav, banners), UI primitives (modal, buttons, fields…)
src/features/   calendar, players, sessions, injuries (shared form), sync (the two modals), auth
```

**Data model (what is in a backup file)**

```
{ app: "camels-physio", schemaVersion: 1, exportedAt, exportedBy,
  data: { schemaVersion: 1, players, teamEvents, workDays, sessions, injuries } }
```

Each collection is a map id → record. A session holds `type`, `physios`, `notes` and `playerAttendance` (player id → status + stamp). An injury references its player and, optionally, the session it was reported in; the player's "Injury log" and the statistics are derived from this one collection, which is what keeps them in sync.

Per-device state that is saved on the phone but never exported: the selected user, last import/export, the "unexported changes" flag, and the day the reminder was dismissed.

**Tests**: `npm test` runs about 250 unit tests over merge, apply, backup parsing, dates, the store and the sync rules. UI is verified by hand in a browser; there is no written checklist yet (the "iPhone notes" in `README.md` list the quirks worth re-checking).

### 12. How to change common things

All paths are under `src/`. After any change: `npm test`, `npm run build`, commit, push.

- **Rename a user**: `name` in `USERS` (`lib/users.ts`). If it is the manager, also update the three sentences that spell the name: `TEAM_EVENT_PERMISSION_MESSAGE` in `lib/users.ts`, the view-only hint in `features/calendar/ModeToggle.tsx` and the footnote in `features/auth/UserSwitcher.tsx`. Never change the *id* (`shahar`, `maya`, `neta`): ids are written into every record and every phone.
- **Change a user's colour**: the `--color-user-<id>` token in `index.css` (keep the hex in `USERS.color` in step, though only the token is rendered).
- **Change the manager**: `MANAGER_ID` in `lib/users.ts`, swap the `role` labels in `USERS`, and update the same three sentences as above.
- **Add a physio**: add the id to `USER_IDS` in `lib/types.ts`, an entry in `USERS` (`lib/users.ts`, with `dotClass: 'bg-user-<id>'`), a `--color-user-<id>` token in `index.css`, a line in `WORKED_CLASS` in `features/calendar/DayCell.tsx`, and a zero in `workDaysPerUser` (`store/selectors.ts`). The type checker catches all of these except `workDaysPerUser`, which is cast with `as` and silently shows "NaN days" if forgotten. Old backups stay valid.
- **Change the roster**: extra players are added in the app. To add a seeded player, add a line to `lib/seedPlayers.ts` (phones add missing seeds on start). Never rename a player there: the id is derived from the name, so a renamed seed shows up as a second, new player on every phone. Fix spellings in the app's profile form instead. Removing a line does *not* remove the player from phones that already have it, and seeded players cannot be deleted in the app; see the roadmap for a proper "retire player" feature.
- **Body parts, severities, statuses, body types**: the lists at the top of `lib/types.ts`. Adding values is safe; removing a value that exists in old files makes the parser fall back to a default (`Other`, `Medium`, `Active`).
- **Texts of the two checklists**: `features/sync/StartTrainingModal.tsx` and `EndTrainingModal.tsx`.
- **Colours / theme**: the `@theme` block in `index.css` (`--color-brand-*`); for a new brand colour also update `theme-color` in `index.html`, `theme_color` in `public/manifest.webmanifest`, and regenerate the icons with `scripts/make-icons.py`.
- **Week starting on Monday**: set `WEEK_STARTS_ON` to 1 in `lib/dates.ts` and rotate `WEEKDAY_LABELS` in the same file to start with 'Mon' (the grid columns and the header row are computed separately).
- **Changing the data format**: bump `SCHEMA_VERSION` in `lib/types.ts`, add a migration step to `MIGRATIONS` in `lib/backup.ts` (it upgrades both saved data and imported files), and keep `parseBackupText` accepting the old shape. Phones running an older app refuse files from a newer schema with a clear message, so update all three phones together.

### 13. Roadmap — ideas for later, with honest trade-offs

Small, safe, high value:

- **Retire a player** (an "inactive" flag): hides them from the roster and stats without deleting history. Needed once the squad changes.
- **Season archive**: hide sessions older than a chosen date; keeps lists short after a few seasons (storage is not the issue, scrolling is).
- **Injury report export** (CSV or PDF of injuries per player/period) for the coach or the club doctor.
- **Per-player attendance history** on the profile (sessions present/absent/injured).
- **Notes templates** for sessions (e.g. taping list) and injury follow-up dates.

Medium effort:

- **Photos or short videos on injuries**: needs care because backups would grow quickly; store images separately or keep them per phone.
- **Multiple teams / age groups**: one app, several rosters and calendars. The merge rules carry over unchanged, but the ids do not: sessions (`s-<date>`) and team events (keyed by date) allow only one per day, so a team id must be folded into those ids, the backup envelope, the store and every selector, plus a team switcher in the UI.
- **Simple analytics**: injuries per body part per month, days lost, re-injury rate.

Structural changes (only if the file exchange becomes a burden):

- **Tiny cloud backend** (Supabase or Firebase, free tier): phones sync automatically whenever online; the file exchange becomes an emergency backup. The merge logic already built is exactly what such a sync needs, so it is an upgrade, not a rewrite. The cost is an account to manage and the fact that medical data about named players leaves the phones, which needs proper access control and the club's consent. Today's design is the most private option.
- **Google Sheet as database** via an Apps Script endpoint: managers like it, but a shared secret is all that protects the data.
- **Native wrapper (Capacitor)**: lets the app open `.json` files straight from WhatsApp and fixes the iOS download quirks, at the price of App Store / TestFlight distribution.

Not worth doing: QR-code sync (a season of data is far too big), peer-to-peer over WebRTC (needs a signalling server anyway), web share target (unsupported on iOS).

### 14. Glossary

- **Backup file**: the `.json` file exported by 🏁 and imported by 🏃; contains all team data, nothing device-specific.
- **Merge**: combining a file with the phone's data record by record; newest edit wins.
- **Session**: one training, game or work day with its attendance and injuries. Created from the calendar by Apply Monthly Attendance.
- **Seeded players**: the original 14, present on every phone, cannot be deleted.
- **Tombstone** (developer term): a deleted record kept as "deleted" so the deletion can travel to other phones.
- **Home Screen app**: the app opened from its icon rather than in a Safari tab.

---

*Questions or ideas: open an issue in the GitHub repository, or keep a list in the WhatsApp group and hand it to whoever maintains the code.*
