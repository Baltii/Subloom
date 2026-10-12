# Notification email templates

The preserved email work is included on `codex/macos-local-reminders`, rebased after the ten-feature stack. Shared rendering produces escaped HTML, inline styles, presentation tables and equivalent plain text. The existing Resend test configuration is deployed.

| Template              | Delivery trigger                                                              |
| --------------------- | ----------------------------------------------------------------------------- |
| Subscription added    | Reusable template; automatic trigger pending                                  |
| Upcoming renewal      | Existing reminder scheduler                                                   |
| Renewal today         | Existing reminder scheduler                                                   |
| Past tracked due date | Reusable template; automatic trigger pending                                  |
| Trial ending          | Existing reminder scheduler                                                   |
| Price change          | Reusable template; automatic trigger pending                                  |
| Cancellation recorded | Reusable template; automatic trigger pending                                  |
| Weekly digest         | Existing digest scheduler; signed opt-out link preserved                      |
| Welcome               | Existing scheduled welcome notification                                       |
| Receipt detected      | Existing ingestion/notification queue, including connected-mailbox candidates |

Dates, amounts and renewal occurrences come from structured notification data. Overdue copy refers to the tracked date; it does not claim a merchant payment failed. Cancellation copy refers to the user's recorded confirmation; it does not claim Subloom canceled a merchant account. Template availability does not activate a new notification event.

```sh
npm run preview:emails
npm run test:backend
```

The preview gallery is `build/email-templates/index.html`; individual `.html` and `.txt` files are next to it. These use illustrative data and do not load credentials or send email. Six Deno tests cover lifecycle variants, occurrence dates, truthful billing language, escaping, digest bounds and Resend HTML/plain-text payloads.

Use the provided test sender for the authorized account recipient while testing. Broader real-recipient delivery requires a verified Resend sending domain. Provider idempotency, quiet hours, account preferences and delivery reporting continue through the existing queue. See [setup progress](setup-progress.md) for deployed backend and remaining provider configuration.
