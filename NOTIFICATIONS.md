# Push notifications setup

The app sends an FCM push whenever an expense (fixed or daily) is added, edited
or deleted — and also when a whole month is deleted. The device that made the
change is skipped, so you never get a notification for your own edit.

## How it works

| Piece | Role |
| --- | --- |
| `src/lib/notifications.svelte.ts` | Asks for permission, registers the service worker, stores the FCM token in `devices/{token}` with the anonymous Firebase uid. |
| `src/service-worker/firebase-messaging-sw.js` | Template for the generated `/firebase-messaging-sw.js`: displays pushes that arrive while the app is closed and handles taps. |
| `src/lib/budget-store.ts` | Stamps `lastEditBy = uid` on every write (and just before a month is deleted). |
| `functions/index.js` | Firestore trigger on `budget/{monthId}`. Diffs the expense arrays, classifies add/edit/delete and sends a data-only FCM message to every token whose uid differs from `lastEditBy`. |
| `devices` collection | One document per device, keyed by FCM token: `{ uid, lang, enabled }`. |

## One-time setup

1. **Enable the Blaze plan** for the `monthly-budget-580b2` project
   (Firebase Console → ⚙️ Usage and billing). Cloud Functions cannot be
   deployed on the free Spark plan. Real usage here stays inside the free
   allowances. *(The project is currently on Spark — this step is required.)*

2. **Generate a Web Push certificate (VAPID key)**
   Firebase Console → Project settings → **Cloud Messaging** → *Web Push
   certificates* → **Generate key pair**. Copy the public key.

3. **Give the key to the app** — already done: the key lives in
   `FCM_VAPID_KEY` in `src/lib/firebase.ts` (it is a public key, safe to
   commit). To override it without touching code, create `.env.local`:

   ```dotenv
   VITE_FCM_VAPID_KEY=BElxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   Remember to rebuild and redeploy hosting after changing the key.

4. **Install function dependencies** (already done once):

   ```bash
   npm install --prefix functions
   ```

5. **Deploy the function and the Firestore rules**:

   ```bash
   npx firebase-tools deploy --only functions,firestore:rules
   ```

6. **Rebuild and deploy the site** so the new client code ships:

   ```bash
   npm run build
   npx firebase-tools deploy --only hosting
   ```

## Using it

1. Open the site on Android Chrome and sign in.
2. Tap the **bell** in the topbar → allow notifications.
3. Repeat on the other phone(s). Each device appears in the `devices`
   collection.
4. Add/edit/delete an expense on one phone; the other phones get a push within
   a second or two, even when the app is closed.

The bell stores the chosen UI language too, so notifications arrive in
Indonesian or English depending on each phone's setting.

## Troubleshooting

- **Bell says "not configured"** — the VAPID key is still empty; repeat step 2–3.
- **Bell says "blocked"** — Chrome has notifications disabled for the site
  (site settings → Notifications → Allow), then reload.
- **Nothing arrives** — check the function logs:
  `npx firebase-tools functions:log --only notifyBudgetChanges`.
- **Wrong region error while deploying** — change `REGION` at the top of
  `functions/index.js` to the Firestore database location (Firebase Console →
  Firestore → database details).
- **Token stale / device replaced** — dead tokens are pruned automatically on
  the next failed send.
