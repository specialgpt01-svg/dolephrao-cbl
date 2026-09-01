# Firebase / Firestore handoff notes

Last updated: 2026-06-05

Latest deploy verified: 2026-06-05, Hosting + Functions.

This project has been moved to Firebase project `cblmodel-6819a`.

Live app:

- Hosting URL: https://cblmodel-6819a.web.app
- Browser API path: `/api`
- Cloud Function: `api`
- Function region: `asia-southeast1`
- Firestore database: `(default)`, Native mode, `asia-southeast1`

## Current architecture

- Firebase Hosting serves the static frontend from `public/`:
  - `public/index.html`
  - `public/market.html`
  - `public/style.css`
  - `public/app.js`
- `app.js` calls `/api` when running on Firebase Hosting.
- `firebase.json` rewrites `/api` and `/api/**` to the Firebase Function named
  `api`.
- `functions/index.js` receives API requests.
- `functions/firestoreBackend.js` handles migrated actions with Firestore.
- Unhandled actions still fall back to the legacy Google Apps Script Web App.

The browser does not access Firestore directly. It calls Firebase Functions, and
Functions use the Firebase Admin SDK.

## Frontend API behavior

`app.js` chooses the API URL like this:

```js
const API_URL =
  window.LOFT_API_URL ||
  (location.protocol === "file:" ? LEGACY_APPS_SCRIPT_API_URL : "/api");
```

Meaning:

- Firebase Hosting: calls `/api`
- Local `file://` open: calls the legacy Apps Script URL
- Override still possible with `window.LOFT_API_URL`

## Firestore migration status

Core seed migration has already been run.

Seeded data from the first migration:

- `sources`: 13 documents
- `users`: 48 documents
- Admin profile for phone/user `1`

Additional migrations and handlers were added after the first pass. Current
action coverage should be checked with:

```powershell
cd functions
node scripts\find-remaining-actions.js
```

Latest known result:

- GAS actions found: 64
- Firestore action handlers: 65
- Migrated GAS actions: 62
- Remaining GAS actions: 2

Remaining GAS actions:

- `generateCert`
- `getMigrationActivitiesData`

## Important behavior notes

- Existing users imported from GAS do not have Firestore `passwordHash`, because
  the legacy API does not expose passwords. Login for those users can still fall
  back to GAS. New users registered through Firebase are stored in Firestore
  with a SHA-256 password hash.
- `generateCert` still needs GAS unless it is rebuilt in Firebase, because it is
  tied to PDF/certificate generation.
- `getMigrationActivitiesData` is a migration/helper endpoint and may not be
  needed by the live app.
- Firestore rules can stay locked down because browser clients do not talk to
  Firestore directly.

## Quota optimization status

See `docs/QUOTA.md` for details.

Completed optimization pass:

- `getLeaderboard`
- `getUsersByTambon`
- `submitLog`
- `getPendingLogs`
- `getUserLogs`

The code now avoids the most expensive full collection reads for those paths and
falls back only if a required Firestore index is missing.

Likely composite indexes:

- `users`: `role ASC`, `score DESC`
- `users`: `role ASC`, `tambon ASC`, `score DESC`
- `learningLogs`: `username ASC`, `createdAt DESC`
- `learningLogs`: `status ASC`, `createdAt DESC`
- `learningLogs`: `status ASC`, `tambon ASC`, `createdAt DESC`

## Migration commands

Install dependencies:

```powershell
cd functions
npm install
```

Run core migration:

```powershell
cd functions
npm run migrate:core
```

Run activity/coupon/check-in migration if needed:

```powershell
cd functions
npm run migrate:activities
```

## Test commands

Syntax check:

```powershell
cd functions
npm run lint
```

Compare GAS actions against Firestore handlers:

```powershell
cd functions
node scripts\find-remaining-actions.js
```

Local emulator:

```powershell
firebase emulators:start --only hosting,functions
```

Open:

```text
http://127.0.0.1:5000
```

## Deploy commands

From the project root:

```powershell
firebase deploy --only hosting
firebase deploy --only functions --force
firebase deploy --only hosting,functions --force
```

## Files added or changed for Firebase

Project root:

- `.firebaserc`
- `firebase.json`
- `.gitignore`
- `.clasp.json`
- `README.md`
- `docs/`
- `public/`
- `legacy/`

Frontend:

- `public/index.html`
- `public/market.html`
- `public/style.css`
- `public/app.js`

Functions:

- `functions/index.js`
- `functions/firestoreBackend.js`
- `functions/package.json`
- `functions/package-lock.json`
- `functions/.env.example`
- `functions/scripts/migrate-core.js`
- `functions/scripts/migrate-activities.js`
- `functions/scripts/find-remaining-actions.js`

Legacy files still present:

- `legacy/gas/Code.js`
- `legacy/gas/code.gs`
- `legacy/gas/appsscript.json`
- `.clasp.json`

`.clasp.json` now points `rootDir` to `legacy/gas`, so Apps Script files stay
separate from Firebase frontend and Functions code.

## Suggested next steps

1. Deploy and smoke test the optimized Functions.
2. Create any Firestore composite indexes requested by Firebase logs.
3. Decide whether to rebuild `generateCert` on Firebase or keep that one action
   on GAS.
4. Confirm whether `getMigrationActivitiesData` is still needed.
