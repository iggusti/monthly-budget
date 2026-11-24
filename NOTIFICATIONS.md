# Notifications setup (Telegram)

The app sends a Telegram message whenever an expense (fixed or daily) is
added, edited with a changed name/amount/method, or deleted. Deleting a whole
month also notifies the other person. Nothing is sent for `checked`-only
toggles, date-only edits, income edits, or the editor's own browser.

Telegram replaces Firebase Cloud Messaging completely. There is no Cloud
Function, no paid Firebase plan, and no browser notification permission prompt.

## How it works

| Piece | Role |
| --- | --- |
| `src/lib/components/NotificationToggle.svelte` | Bell in the topbar; pick "Husband" or "Wife" once per browser. |
| `src/lib/notifications.svelte.ts` | Registers `devices/{uid}` with the recipient, language and anonymous uid. |
| `src/lib/budget-store.ts` | Writes a job to `notification-outbox` on every save/delete, with the before/after snapshots and `lastEditBy`. |
| `.github/workflows/push-notifications.yml` | Free scheduled Action (every 2–3 minutes) that runs the sender. |
| `functions/send-push.js` | Claims pending jobs and POSTs them to `https://api.telegram.org/bot<token>/sendMessage`. |
| `functions/changes.js` and `functions/notify-helpers.js` | Pure diff, formatting and recipient grouping with Vitest tests. |

Because the browser only writes a queue document, all Telegram credentials stay
server-side in GitHub Secrets. The message has a button linking to the changed
month and arrives in the language selected on that browser (EN / ID).

## One-time setup

1. **Create the bot** — open [@BotFather](https://t.me/BotFather) on Telegram,
   send `/newbot`, follow the prompts, and copy the bot token.
2. **Get the chat IDs** — send any message to the bot from each person's
   Telegram account (or add it to a group for a shared chat). Then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy each
   `message.chat.id`. The ID is a number such as `123456789` or `-100123456789`.
3. **Add repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Value |
   | --- | --- |
   | `TELEGRAM_BOT_TOKEN` | Bot token from BotFather. |
   | `TELEGRAM_CHAT_ID` | Shared family chat, *or* leave unset if using the two below. |
   | `TELEGRAM_CHAT_ID_HUSBAND` | Husband's chat ID. |
   | `TELEGRAM_CHAT_ID_WIFE` | Wife's chat ID. |
   | `FIREBASE_SERVICE_ACCOUNT_MONTHLY_BUDGET_580B2` | Existing service account JSON. |

   Recommended: one chat ID per person. Then the bell's Husband/Wife choice
   makes the sender skip the editor's own browser and target the other person.
   With only a shared `TELEGRAM_CHAT_ID`, everyone in that chat gets the message.

4. **Deploy Firestore rules** so the app can create outbox jobs:

   ```sh
   npx firebase-tools deploy --only firestore:rules
   ```

5. **Enable on each browser** — open the app, tap the bell, choose Husband or
   Wife, then tap Enable.

## Testing

- Save an expense and wait up to about 3 minutes, or dispatch the sender now:

  ```sh
  gh workflow run push-notifications.yml
  ```

- The run log prints `claimed / reset / sent / skipped / failed` counts. A job
  with no remaining recipient is logged as `No recipients` instead of failing.
- Failed sends retry on the next run, up to 5 attempts. Jobs stuck in
  `processing` for over 10 minutes are reset.
- If nothing arrives, check that the chat ID was captured after the bot received
  a message, and that the token belongs to the same bot.

## Notes

- Delivery is delayed by design; do not describe it as instant.
- The browser never stores the bot token or chat IDs. No `VITE_` keys.
- Old FCM-era `devices` records have no `recipient` and are ignored by both the
  app and the sender.
