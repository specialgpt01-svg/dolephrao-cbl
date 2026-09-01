# Refactor Plan for Next AI

Last updated: 2026-06-05

This plan is for continuing the code separation after the first project-level
split has already been completed.

Current structure:

- `public/` - Firebase Hosting frontend
- `functions/` - Firebase Functions API and Firestore backend
- `legacy/gas/` - original Google Apps Script fallback/certificate code
- `docs/` - handoff notes and migration documents

Live app:

- https://cblmodel-6819a.web.app

Firebase project:

- `cblmodel-6819a`

## Current Migration Status

Firestore is the main database for migrated features.

Known remaining GAS actions:

- `generateCert`
- `getMigrationActivitiesData`

Certificate PDF generation intentionally still uses GAS/Google Drive to avoid
Firebase Storage usage.

Do not remove `legacy/gas/` unless certificate generation has been rebuilt and
verified on Firebase.

## Refactor Goal

Separate large frontend and backend files into clearer modules without changing
behavior.

Primary files that are still too large:

- `public/app.js`
- `functions/firestoreBackend.js`

The next work should be incremental. Move one group of functions at a time,
then test before continuing.

## Frontend Refactor Order

Start with `public/app.js`. This is the safest and most useful next split.

### Phase 1: Create frontend module folders

Create:

- `public/js/`
- `public/js/core/`
- `public/js/admin/`
- `public/js/user/`

Keep `public/app.js` as the bootstrap file during the transition.

Recommended target files:

- `public/js/core/api.js`
- `public/js/core/auth.js`
- `public/js/core/ui.js`
- `public/js/admin/sources.js`
- `public/js/admin/quizzes.js`
- `public/js/admin/users.js`
- `public/js/user/learning.js`
- `public/js/user/profile.js`
- `public/js/user/certificates.js`
- `public/js/user/coupons.js`

### Phase 2: Extract API helpers first

Move API-related helpers from `public/app.js` into:

- `public/js/core/api.js`

Likely functions/constants:

- `LEGACY_APPS_SCRIPT_API_URL`
- `API_URL`
- `apiGet`
- `apiPost`
- `withAuthData`
- `withAuthParams`
- shared response/error handling helpers, if any

Important:

- Keep browser global access compatible.
- If functions are currently called from inline HTML handlers, expose them on
  `window`.
- Do not switch to ES modules unless every script load and inline handler is
  checked. A simple non-module script split is safer for this codebase.

Suggested script order in `public/index.html`:

```html
<script src="js/core/api.js"></script>
<script src="js/core/ui.js"></script>
<script src="js/core/auth.js"></script>
<script src="js/admin/sources.js"></script>
<script src="js/admin/quizzes.js"></script>
<script src="app.js"></script>
```

### Phase 3: Extract auth

Move login/register/logout/session functions into:

- `public/js/core/auth.js`

Likely functions:

- register submit handler
- login submit handler
- logout
- localStorage user/admin helpers
- auth/session initialization helpers

Must verify after this phase:

- Login with phone `1` and password `1`
- Logout
- Register page still opens
- Admin menu still appears for admin user

### Phase 4: Extract admin learning-source system

Move source/base/quiz management into:

- `public/js/admin/sources.js`
- `public/js/admin/quizzes.js`

This is the current active feature area.

Likely responsibilities for `sources.js`:

- load admin sources
- render source list
- save/delete source
- load/render bases
- save/delete/reorder bases
- hide auto-generated technical fields in the UI

Likely responsibilities for `quizzes.js`:

- load quiz list by source/base
- Google-Form-like quiz editor
- add/remove question rows
- choose answer beside choices
- save all questions once
- delete/reorder quiz questions if still used

Must verify after this phase:

- Admin source list loads
- `SRC1150` bases load
- `SRC1150 / BAS0013` quizzes load
- Add several quiz questions, then save once
- Correct answer can be selected beside choices
- Auto-generated IDs stay hidden in UI

### Phase 5: Extract user learning flow

Move learner-facing source/base/quiz flow into:

- `public/js/user/learning.js`

Likely responsibilities:

- map/source list
- source detail
- base selection
- quiz start
- answer selection
- score calculation
- submit quiz result

Must verify:

- User can open a learning source
- Base content loads
- Quiz loads
- Submit quiz result works
- Certificate button behavior remains unchanged

### Phase 6: Extract profile/cert/coupon features

Move:

- profile functions to `public/js/user/profile.js`
- certificate UI/history functions to `public/js/user/certificates.js`
- coupon/points functions to `public/js/user/coupons.js`

Important:

- Certificate generation still calls GAS through Firebase fallback.
- Do not migrate certificate files into Firebase Storage unless the owner asks.

## Backend Refactor Order

After frontend is stable, split `functions/firestoreBackend.js`.

Recommended target structure:

- `functions/backend/firestore.js`
- `functions/backend/utils.js`
- `functions/backend/auth.js`
- `functions/backend/sources.js`
- `functions/backend/quizzes.js`
- `functions/backend/users.js`
- `functions/backend/logs.js`
- `functions/backend/coupons.js`
- `functions/backend/certificates.js`
- `functions/backend/activities.js`
- `functions/backend/index.js`

Keep the public API contract unchanged:

- `functions/index.js` should still call `handleFirestore(req, action, data, fallback)`
- response shapes must remain the same
- action names must remain the same

Backend extraction order:

1. Move pure helpers/constants to `backend/utils.js`
2. Move Firestore db/admin initialization to `backend/firestore.js`
3. Move auth handlers: `login`, `register`
4. Move source/base/quiz handlers
5. Move user/profile/log/coupon/certificate handlers
6. Move remaining activity/admin dashboard handlers

Do not change Firestore collection names during this refactor.

## Testing Checklist

Run after each phase:

```powershell
node --check public\app.js
cd functions
npm run lint
node scripts\find-remaining-actions.js
```

After frontend script splitting, also syntax-check each new file:

```powershell
node --check public\js\core\api.js
node --check public\js\core\auth.js
node --check public\js\admin\sources.js
node --check public\js\admin\quizzes.js
```

Smoke test live or local API:

```powershell
$body = @{action='login'; data=@{phone='1'; password='1'}} | ConvertTo-Json -Depth 5 -Compress
Invoke-RestMethod -Uri 'https://cblmodel-6819a.web.app/api' -Method Post -Body $body -ContentType 'application/json'
```

Check source/base/quiz data:

```powershell
$body = @{action='getAdminBasesBySource'; data=@{phone='1'; username='1'; sourceId='SRC1150'}} | ConvertTo-Json -Depth 5 -Compress
Invoke-RestMethod -Uri 'https://cblmodel-6819a.web.app/api' -Method Post -Body $body -ContentType 'application/json'

$body = @{action='getAdminQuizBySource'; data=@{phone='1'; username='1'; sourceId='SRC1150'; baseId='BAS0013'}} | ConvertTo-Json -Depth 5 -Compress
Invoke-RestMethod -Uri 'https://cblmodel-6819a.web.app/api' -Method Post -Body $body -ContentType 'application/json'
```

Expected known results:

- Login `1 / 1` returns `status: "success"`
- `SRC1150` has 2 bases
- `SRC1150 / BAS0013` has 5 quiz questions

Deploy Hosting after frontend changes:

```powershell
firebase deploy --only hosting
```

Deploy Functions only after backend changes:

```powershell
firebase deploy --only functions --force
```

## Important Rules

- Do not rewrite the UI from scratch.
- Do not change action names.
- Do not change response shapes unless all callers are updated and tested.
- Do not remove GAS fallback yet.
- Do not move certificate files to Firebase Storage.
- Do not change Firestore collection names.
- Keep changes small and test after each file extraction.
- Preserve existing global function names that are called from inline HTML.
- If a moved function is called by `onclick` or another inline handler, assign it
  to `window.functionName`.

## Suggested Next Concrete Task

Start with Phase 2:

1. Create `public/js/core/api.js`
2. Move only API constants/helpers from `public/app.js`
3. Add the new script before `app.js` in `public/index.html`
4. Run syntax checks
5. Smoke test login and admin source loading
6. Deploy Hosting

This gives the most benefit with the lowest risk.
