---
version: 1
slug: "macos-renewalwidget-swift"
primary_target: "macos/RenewalWidget.swift"
related_targets: []
---

Mode: Operate. Scope: a precisely specified native macOS widget extension inside Subloom's established world.
Seed: narrow-existing-surface-extension (no concept roll; user specified minimalist native WidgetKit).

## THESIS
Show the nearest renewal or trial end without opening the full app.

## OWN-WORLD
Inherit Subloom Green semantic colors, translating typography and icons to native SwiftUI and SF Symbols. Preserve the existing app's design files.

## STORY
Desktop glance → identify service and deadline → click to open the correct workspace's subscription; private content opens its calendar. User explicitly chose native desktop/Notification Center, not a floating mini-window.

## FIRST VIEWPORT
One name, renewal/trial label, calendar date and date-only countdown. No price totals, charts or extra actions. Small and medium families; light/dark, private, empty and expired states.

## FORM
Native WidgetKit extension embedded in the Mac app, atomic App Group summary, 35 account-timezone day entries, guarded local app links. No network calls, authentication credentials or complete workspace copied to the extension. WidgetKit controls refresh scheduling.

## QUALITY BAR
Readable native type, supporting text above 4.5:1 contrast, long names fit, VoiceOver combines contents, no decorative animation. Gallery installation and signing need a real Apple Developer identity; SwiftUI previews and unsigned builds do not prove installed widget behavior.
