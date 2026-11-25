# Notifications setup (Telegram)

The app sends a Telegram card when a fixed or daily expense is added, edited
with a changed name/amount/method/date (plus `checked` for fixed expenses
only), or deleted. Deleting a whole month also notifies the other person.
Auth/device actions and Firebase failures produce activity cards. Nothing is
sent for income edits, daily `checked` changes, successful saves with no
tracked expense change, or the editor's own browser. In-app toasts are a
separate, immediate channel for every local action.

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
server-side in GitHub Secrets. Budget edits and activity jobs (sign-in, sign-out,
notification/language changes, and failures) notify the other registered family
member; when nobody else is registered, the actor receives the card. The message is a rich Telegram HTML card with the month, the changed item,
its category, method, date, payment status for fixed expenses only (daily
spending is already paid), and a per-field before/after for edits. A successful
save that changes no tracked expense sends no card. Multi-change edits include
added/removed/net totals. A button links to
the changed month, and the copy arrives in the language selected on that
browser (EN / ID).

The sender records which chats accepted each job, so a partial failure never
re-sends to a chat that already received the message. Errors that cannot
heal by retrying (chat has not started the bot, or blocked it) are marked
failed immediately.

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
   | `TELEGRAM_CHAT_ID_WIFE` | Wife's chat ID; separate multiple IDs with a comma. |
   | `FIREBASE_SERVICE_ACCOUNT_MONTHLY_BUDGET_580B2` | Existing service account JSON. |

   Recommended: one chat ID per person. Then the bell's Husband/Wife choice
   makes the sender skip the editor's own browser and target the other person.
   With only a shared `TELEGRAM_CHAT_ID`, everyone in that chat gets the message.
   One recipient can also have several chats, e.g. `5959164056,949805387`; the
   sender delivers one message per chat and never duplicates a shared chat.

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
