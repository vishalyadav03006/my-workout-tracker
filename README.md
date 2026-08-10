# My Workout Tracker

A simple, offline-first workout exercise tracker. No login, no backend, no
paid APIs — everything is saved permanently in your browser's `localStorage`.

## Folder structure

```
workout-tracker/
├── index.html          Main app shell (all screens)
├── manifest.json        PWA manifest (name, icons, colors)
├── sw.js                 Service worker (offline caching)
├── css/
│   └── styles.css        All styling (dark gym theme)
├── js/
│   ├── exercises.js      Default exercise library (7 muscle groups)
│   ├── storage.js        localStorage persistence, PR calculation, export/import
│   └── app.js             App logic: navigation, rendering, event handling
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Features included

- Home dashboard: today's exercises/sets, weekly summary, recent workouts
- Exercise library grouped by Chest / Back / Shoulders / Biceps / Triceps /
  Legs / Abs, plus custom exercises you add yourself
- Full workout flow: pick muscle group → pick exercise → log sets (weight,
  reps, optional RPE, completed checkbox) → add more exercises → save
- Workout history by date, tap into any workout to see full detail
- Per-exercise progress screen showing your last & previous performance and
  all-time personal bests
- Automatic PR detection (heaviest weight, most reps at a weight, highest
  session volume) with a "New personal record!" toast and PR badges
- Edit or delete: individual sets, whole exercises, or whole workouts —
  each destructive action asks for confirmation first
- Exercise search (within a muscle group, and across the whole library)
- Export your data to a `.json` file, import it back, or clear everything
- Installable PWA with offline support (service worker + manifest)

All data lives only in your browser. Nothing is sent to any server.

## How to run it locally

You just need any local static file server (browsers block some features,
like the service worker, when opening `index.html` directly via `file://`).

**Option A — Python (already installed on most systems):**
```bash
cd workout-tracker
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

**Option B — Node.js:**
```bash
cd workout-tracker
npx serve .
```

**Option C — VS Code:**
Install the "Live Server" extension, right-click `index.html`, and choose
"Open with Live Server".

## How to deploy it to GitHub Pages

1. Create a new GitHub repository and push this entire `workout-tracker`
   folder's contents to it (the files should sit at the repo root, or in a
   `/docs` folder — either works).
2. In the repository, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Choose the branch (e.g. `main`) and the folder (`/ (root)` or `/docs`),
   then click **Save**.
5. GitHub will give you a URL like
   `https://your-username.github.io/your-repo-name/`. It can take a minute
   or two to go live.
6. Open that URL — the app (including offline support) will work exactly
   as it does locally.

No build step is required — it's plain HTML/CSS/JS.

## How to install it as an Android app (PWA)

1. Open your deployed site (GitHub Pages URL, or your local server address
   if testing on the same device) in **Chrome on Android**.
2. Use the app for a moment — Chrome shows an install prompt automatically
   once it detects the site is installable, or:
3. Tap the **install icon** (a down-arrow) that appears in the app's top
   bar, or open Chrome's **⋮ menu → Install app / Add to Home screen**.
4. Confirm the install. The app icon will appear on your home screen and
   launches full-screen, like a native app — including offline.

If you don't see an install option, make sure you're loading the site over
`https://` (GitHub Pages gives you this automatically) — Chrome requires a
secure origin (or `localhost`) to offer PWA installation.

## Notes on your data

- Everything is stored in your browser's `localStorage`, scoped to the
  domain you load the app from. Clearing your browser's site data, or
  switching browsers/devices, will not carry your data over automatically —
  use **Export Data** beforehand and **Import Data** on the new browser/
  device to move it.
- Use the **Export Data** button in the Exercises tab regularly as a backup.
