# Push notifications setup (Pushover)

The app sends a Pushover notification whenever an expense (fixed or daily) is
added, edited or deleted — and also when a whole month is deleted. The phone
that made the change is skipped, so you never get a push for your own edit.

Pushover replaces Firebase Cloud Messaging completely. There is no Cloud
Function and no Blaze upgrade: a free scheduled GitHub Action does the sending.

## How it works

| Piece | Role |
| --- | --- |
| `src/lib/components/NotificationToggle.svelte` | Bell in the topbar. Pick "Husband" or "Wife" once per browser. |
| `src/lib/notifications.svelte.ts` | Registers `devices/{uid}` with `{ uid, recipient, lang, enabled, platform, updatedAt }`. |
| `src/lib/budget-store.ts` | Stamps `lastEditBy = uid` and appends a job to `notification-outbox` with the before/after snapshots. |
| `.github/workflows/push-notifications.yml` | Runs the sender every 5 minutes with secrets from the repo. |
| `functions/send-push.js` | Claims pending jobs and POSTs to `https://api.pushover.net/1/messages.json`. |
| `functions/changes.js` and `notify-helpers.js` | Pure diff, formatting and recipient-grouping helpers (unit-tested). |

Because the browser only writes a queue document, all Pushover credentials stay
in GitHub Secrets and never reach the client bundle.

## One-time setup

1. **Create a Pushover application** — <https://pushover.net/apps/build>. Give it
   a name and an icon; copy the **API token**.

2. **Install Pushover on each phone** — <https://pushover.net/>. Copy each
   account's **User key** from the dashboard.
   - Simplest: one shared user key for the family. Put it in
     `PUSHOVER_USER_KEY`; the bell's recipient choice then only affects which
     devices are skipped, not which key receives the push.
   - Recommended: one key per person. Set `PUSHOVER_USER_KEY_HUSBAND` and
     `PUSHOVER_USER_KEY_WIFE` instead (no shared key needed). Then choosing
     "Husband" on Ilham's phone means his key is skipped when he edits.

3. **Add repository secrets** — repo → Settings → Secrets and variables →
   Actions → New repository secret:

   | Secret | Value |
   | --- | --- |
   | `PUSHOVER_APP_TOKEN` | Application API token from step 1. |
   | `PUSHOVER_USER_KEY` | Shared user key, *or* leave unset if using the two keys below. |
   | `PUSHOVER_USER_KEY_HUSBAND` | Husband's user key. |
   | `PUSHOVER_USER_KEY_WIFE` | Wife's user key. |

   `FIREBASE_SERVICE_ACCOUNT_MONTHLY_BUDGET_580B2` already exists — the sender
   reuses it to read the outbox with the Admin SDK.

4. **Deploy the Firestore rules** so the app can create outbox jobs:

   ```sh
   npx firebase-tools deploy --only firestore:rules
   ```

5. **Deploy the site** (or just push to `main`; the hosting workflow builds it):

   ```sh
   npm run build
   npx firebase-tools deploy --only hosting
   ```

6. **Register each phone** — open the app, tap the bell, choose the owner and
   tap **Enable**. Do this once per browser. The `devices` collection then holds
   one document per browser, keyed by its anonymous Firebase uid.

## Using it

1. Add, edit or delete an expense (or delete a whole month) on one phone.
2. Within about 5 minutes the other phone(s) get a Pushover notification in the
   language selected in the app (ID / EN). Tapping it opens that month's page.
3. Tap the bell again on any phone to unregister it. Register again to change
   the owner.

Only name, amount and payment method changes are notified. Ticking a fixed
expense as paid (`checked`), editing a date, or changing income sends nothing.
Multiple changes in one save are summarised into a single push.

## Troubleshooting

- **No push arrives** — open the Actions tab → "Send budget pushes" → latest
  run. The log prints `sent / skipped / failed` counts and any Pushover error.
- **"Missing required secret"** — one of the secrets above is absent or empty.
  Secrets are case-sensitive.
- **"Invalid user" or "Invalid token"** — double-check the User key / API token
  in Pushover's dashboard. A user key is not the same as the email address.
- **"Not authorized" / Firestore permission denied** — the service account
  secret was replaced with one lacking Firestore access, or the rules were not
  redeployed (step 4).
- **Push on the editing phone** — with a shared `PUSHOVER_USER_KEY`, Pushover
  cannot target a single device. Use the two per-person secrets instead. The
  sender still deduplicates by user key, so a shared key gets one message per
  edit (in the first registered device's language), not one per person.
- **Duplicated pushes** — unlikely: jobs are claimed in a Firestore transaction
  and the workflow has a concurrency group. Check for two repos running the
  workflow against the same Firebase project.
- **Job stuck as `processing`** — a run was cancelled mid-flight. The next run
  resets jobs older than 10 minutes back to `pending`.
- **Nothing configured in the bell** — the bell has no browser permission
  prompt by design; pushes are delivered by the Pushover app, not the browser.
