# Next reminder widgets

Subloom includes an Android home-screen widget and small/medium macOS widgets. Each shows one event: the nearest renewal or trial ending, its date, countdown and original-currency amount. Tap to open the subscription in the active account or device-local guest workspace. Trial deadlines win ties. Paused, expired and canceled subscriptions are excluded.

The action label sits above the date. Both platforms use Subloom’s canonical bloom mark and light/dark palette. Trials use the warning color for their countdown.

## Privacy and refresh

Widgets follow subscription dates independently of notification permissions and delivery preferences. They do not renew or cancel merchant billing. **Private lock-screen content** in Settings → Reminders (enabled by default), or configured app protection, hides details and removes subscription content from the widget cache. Disabling private content also allows merchant names and prices in notification alerts.

Opening the app, editing subscriptions and changing workspaces or privacy settings refresh the cache. A bounded timeline advances the next event offline for 90 days, after which the widget asks you to open Subloom. Changes on other devices appear after this installation syncs.

Android requests launcher updates every 30 minutes and refreshes for date/time changes. Android and the launcher control actual timing. macOS supplies daily timeline entries in the workspace timezone and requests periodic reloads; WidgetKit controls actual timing.

## Android setup

Install a new native build and open Subloom once. Long-press the home screen, choose **Widgets → Subloom → Next reminder**, and place the widget. Resize it for your launcher and font size.

The Expo local module in `modules/subloom-widget` is automatically linked. `npm run android` and the GitHub APK workflow include its native code; no edits to the generated root `android/` directory are needed. An over-the-air JavaScript update cannot add the widget to an older binary.

## macOS setup and builds

Open the rebuilt app once, then choose **Edit Widgets → Subloom → Next reminder** on the desktop or in Notification Center.

`npm run build:macos` builds the Xcode app-extension target in `macos/Widget/SubloomWidget.xcodeproj` and embeds `SubloomNextReminder.appex`. Both processes remain sandboxed.

Ad-hoc builds share only `~/Library/Application Support/SubloomWidgets/next-reminder.json`. The app has scoped read/write access to that directory; the extension has read-only access. The app creates the directory on first use. This mode avoids relying on an unprovisioned app group.

Developer ID builds use an app group authorized for both processes. Configure the existing signing identity and macOS team-prefixed group:

```sh
MACOS_SIGNING_IDENTITY='Developer ID Application: Your Name (TEAM_ID)' \
MACOS_WIDGET_APP_GROUP='TEAM_ID.com.subloom.widgets' npm run build:macos
```

This does not perform notarization or replace signing setup for nested third-party frameworks. Current GitHub Mac builds remain ad-hoc signed, as in earlier releases.

When replacing local test builds, an already running `SubloomNextReminder` process may retain the previous binary. Restart that widget process if it keeps using an old layout or storage location; other widgets and system services do not need resetting.

Apple documents [app-group container access](https://developer.apple.com/documentation/xcode/accessing-app-group-containers) and [widget extensions](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension). Android documents [widget updates and their limits](https://developer.android.com/develop/ui/views/appwidgets/advanced).

## Verification

`npm run check` covers the planner and cache lifecycle, including month-end renewals, trials, empty states, DST, original currencies, workspace switching and privacy. `npm run test:macos:widget` checks the built extension runtime, metadata, versions, storage entitlements and nested signatures; GitHub runs it before packaging Mac releases.

Apple silicon native compilation, gallery registration, small/medium SwiftUI previews in both themes, live cache sharing and subscription-link navigation were verified. Previews also covered trials, private/empty states and long names. Android compilation runs in GitHub; physical phone validation remains pending. Larger text, protected-app taps, closed-app midnight rollover, reboot and Developer ID distribution still require platform testing.
