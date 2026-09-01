# Firebase quota optimization handoff

Last updated: 2026-06-05

## Status

Quota optimization pass is done for the main high-read Firestore paths listed in
the previous checklist.

Updated file:

- `functions/firestoreBackend.js`

Checked with:

```powershell
cd functions
npm run lint
node scripts\find-remaining-actions.js
```

## What was optimized

### `getLeaderboard()`

Before:

- Read all `users`
- Filtered users and sorted in Node.js

Now:

- Queries `users` with `where("role", "==", "user")`
- Orders by `score desc`
- Limits to 10
- Falls back to the old full scan only if Firestore reports a missing index

### `getUsersByTambon(params, actor)`

Before:

- Read all `users`
- Filtered role/tambon in Node.js

Now:

- Queries `users` by role
- Adds tambon filter when needed
- Orders by score
- Falls back to the old full scan only if the required index is missing

### `submitLog(data)`

Before:

- `learningLogs` stored username/tambon only
- Pending log review had to read all users to find names

Now:

- New `learningLogs` documents include denormalized:
  - `fullName`
  - `profileImage`
  - normalized `tambon`

### `getPendingLogs(params, actor)`

Before:

- Read pending logs
- Read the entire `users` collection
- Joined names/tambon in Node.js

Now:

- Reads pending logs only
- Filters tambon at query level when possible
- Uses denormalized names from `learningLogs`
- For older logs missing names, reads only the specific user documents needed
- Falls back to safer in-memory filtering only if an index is missing

### `getUserLogs(params)`

Before:

- Read all logs for a user
- Sorted and paginated in Node.js

Now:

- Uses Firestore count aggregation for total pages
- Uses ordered query with `offset()` and `limit()` to keep the existing frontend
  `page` API working
- Falls back to the old in-memory sort/pagination only if an index is missing

## Indexes that may be needed

Firebase may ask for composite indexes after deploy. If an endpoint logs a
missing-index error, create the index from the Firebase Console link in the
error message.

Likely indexes:

- Collection `users`: `role ASC`, `score DESC`
- Collection `users`: `role ASC`, `tambon ASC`, `score DESC`
- Collection `learningLogs`: `username ASC`, `createdAt DESC`
- Collection `learningLogs`: `status ASC`, `createdAt DESC`
- Collection `learningLogs`: `status ASC`, `tambon ASC`, `createdAt DESC`

The code currently catches missing-index errors and falls back so the app should
keep working while indexes are being created.

## Action migration status

`functions/scripts/find-remaining-actions.js` now reads `FIRESTORE_ACTIONS`
directly from `functions/firestoreBackend.js`, so it should not drift when
handlers are added.

Latest result:

- GAS actions found: 64
- Migrated in Firestore handler: 62
- Remaining GAS actions: 2

Remaining:

- `generateCert`
- `getMigrationActivitiesData`

## Notes for the next developer

- Do not add the Firestore client SDK to the frontend unless the architecture is
  intentionally changed. The current design routes browser calls through
  Firebase Functions.
- Keep Firestore rules locked down while the Admin SDK is the only Firestore
  access path.
- Prefer denormalized fields for list pages that need display names, tambon
  names, or product names. It avoids expensive joins in Cloud Functions.
