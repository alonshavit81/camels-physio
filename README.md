# Camels Physio

Mobile-first web app for the team's physiotherapists: work-day attendance and team calendar, player profiles, per-session player attendance and injury reports. No backend: every phone keeps its own data in the browser (`localStorage`), and the physios stay in sync by sharing JSON backup files in their WhatsApp group.

## Daily workflow

1. Open the app and pick who you are (Shahar · Manager, Maya · Physio, Neta · Physio). The phone remembers you.
2. **🏃 Start Training** (top right): import the latest backup from the WhatsApp group. Save the file to Files first, then choose it. The file is *merged* into the phone: records that exist only in the file are added, and when the same record was edited on both phones the newest edit wins. Nothing is overwritten blindly.
3. Work as usual:
   - **Calendar**: *Team Events* mode (only Shahar can tap: Training → Game → clear) and *My Attendance* mode (tap the days you worked, your coloured dot appears). The stats card counts each physio's work days. **Apply Monthly Attendance** creates one editable session for every training, game or work day of the month and opens the Sessions tab.
   - **Players**: the roster with profile fields (name, number, fitness level, body structure, body type, past injuries, range of motion, strengthening exercises) plus an *Injury log* that is filled automatically from session reports.
   - **Sessions**: every generated session. Inside a session mark each player Present / Absent / Injured and report injuries. An injury reported here appears instantly in the player's profile and in the injury statistics.
4. **🏁 End Training**: export the backup. On iPhone prefer **Share JSON to WhatsApp** (opens the share sheet straight into the group); **Download JSON** saves to Files › Downloads.

## iPhone notes

- Add the app to the Home Screen (Share → *Add to Home Screen*). The Home Screen app and Safari tabs have **separate** storage, so pick one and stick to it. Home Screen apps are also exempt from Safari's 7-day storage cleanup.
- Links opened *inside* WhatsApp use an in-app browser with its own empty storage. Open the app from the Home Screen or Safari instead.
- In the Home Screen app use *Share* rather than *Download*: iOS can open downloaded files in a preview that is hard to leave.
- If the phone is in Private Browsing or storage is blocked, a yellow banner warns that data is not being saved. Export after each session.
- Backups are UTF-8 JSON; Hebrew text is safe.

## Development

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # vitest: merge / apply / backup / date helpers
npm run build      # type-check (strict) + static bundle in dist/
npm run preview    # serve dist/
```

While `npm run dev` is running, open `http://127.0.0.1:5173/.dev/phone.html` to preview the app inside a 390×844 iPhone-sized frame.

`dist/` is fully static with relative asset paths and hash routing, so it works from any static host or sub-folder (GitHub Pages, Netlify, a shared folder…).

Stack: Vite 8, React 19, TypeScript 6 (strict), Tailwind CSS 4, Zustand (persist → localStorage), React Router 8 (hash router), date-fns, lucide-react, Vitest.

## How syncing works (for maintainers)

- Every record carries `updatedAt` (ISO UTC) and `updatedBy`. Deletions are tombstones (`deleted: true`, `kind: 'none'`, `worked: false`, `status: 'unset'`) so a deletion beats a stale copy from another phone.
- IDs are deterministic wherever two phones could create "the same" thing independently: seeded players `p-<name-slug>`, sessions `s-<date>` (one per date), team events keyed by date, work days `<user>_<date>`. Injuries and manually added players get UUIDs.
- `src/lib/merge.ts` merges per record (newest wins), per attendance entry inside a session, unions the physios, and recomputes each session's type from the merged calendar. `src/lib/apply.ts` generates/refreshes sessions from the calendar idempotently and only prunes sessions that hold no data. `src/lib/backup.ts` validates every imported record and rejects files from a newer schema version.
- Backup envelope: `{ app: "camels-physio", schemaVersion: 1, exportedAt, exportedBy, data: { players, teamEvents, workDays, sessions, injuries } }`. The current-user selection is per device and never exported.
