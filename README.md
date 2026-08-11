# My Workout Tracker

A simple, offline-first workout exercise tracker. No login, no backend, no
paid APIs — everything is saved permanently in your browser's `localStorage`.

## Folder structure

```
workout-tracker/
├── .nojekyll             Tells GitHub Pages to skip Jekyll processing
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

All asset paths (`css/`, `js/`, `icons/`, `manifest.json`, `sw.js`) are
referenced with explicit relative (`./...`) paths — no leading slashes
anywhere — so the app works identically whether it's hosted at a domain
root or at a GitHub Pages project subpath like
`https://username.github.io/repo-name/`. This has been verified by serving
the app from a simulated subpath and confirming the CSS/JS load and every
button works with zero console errors.

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

### If your deployed site shows unstyled HTML and buttons don't work

This almost always means the browser requested `css/styles.css` or
`js/app.js` and got a 404 (or an old/broken cached copy), not a bug in the
page itself. Check these in order:

1. **Files must sit at the published root, not nested in an extra folder.**
   The single most common mistake: if you drag-and-dropped this whole
   `workout-tracker` folder into your repo, GitHub will publish it at
   `your-repo/workout-tracker/index.html`, not `your-repo/index.html`. Open
   your repo on GitHub.com and confirm `index.html`, `css/`, `js/`, and
   `manifest.json` are visible **directly at the root** of the branch/folder
   you picked in Settings → Pages (or directly inside `/docs` if that's
   what you selected) — not one level deeper.
2. **Open DevTools → Network tab on the live site** and reload. Look at the
   requests for `styles.css`, `app.js`, `exercises.js`, `storage.js`. If any
   show a red `404`, that confirms a path/deployment issue — click the
   request and check the exact URL it tried, then compare it to where the
   file actually lives in your repo.
3. **`.nojekyll` must be committed at the repo root.** It's included in this
   project already — make sure it actually got pushed (`git status`/`git add
   -A` sometimes skips dotfiles if you're not careful, or a `.gitignore`
   excludes it). Without it, GitHub Pages runs your site through Jekyll,
   which can behave unexpectedly with plain static sites.
4. **Hard-refresh / clear the service worker.** If you deployed a broken
   version earlier, your browser's service worker may still be showing you
   the old cached shell. In DevTools → Application → Service Workers, click
   "Unregister", then hard-reload (Ctrl/Cmd+Shift+R). This project's service
   worker now uses a network-first strategy specifically so this shouldn't
   happen going forward, but it can still affect a browser tab that had the
   *old* broken service worker installed before this fix.
5. **Case sensitivity.** GitHub Pages is served from a case-sensitive
   filesystem. If you ever rename or re-upload files, double-check the case
   matches exactly what `index.html` references (`css/styles.css`, all
   lowercase) — this repo's filenames and references already match, so this
   only matters if you modify things later.
6. **Give it a minute after pushing.** GitHub Pages builds asynchronously;
   changes can take 1–2 minutes to go live, occasionally longer.

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
