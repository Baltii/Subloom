# Calendar export (.ics)

Settings → Calendar export downloads/shares the next year of scheduled renewal dates, trial endings and paid-through dates. Dates use the account timezone and all-day events, avoiding daylight-saving shifts. Existing anchored recurrence logic handles month ends. Paused/expired items have no events; canceled items get only their remaining access end date. Event UIDs remain stable for the same subscription/date/type.

Merchant names and prices are hidden by default and can be enabled explicitly. Events are marked private, transparent, and never claim a payment succeeded. No account/calendar access token is needed: import the file manually into Google Calendar, Apple Calendar or Outlook. This is a snapshot, not a live calendar subscription. Reimport behavior depends on the calendar provider and can duplicate events.

The serializer escapes content and folds UTF-8 lines to 75 bytes with CRLF. Export is bounded to 10,000 events. Stacked after CSV, sharing its cross-platform file helper. No migration or credentials. `npm run check` tests leap/month-end recurrence, trial/canceled states, timezone dates, privacy, escaping and UTF-8 folding. Calendar-provider import is a manual release check.
