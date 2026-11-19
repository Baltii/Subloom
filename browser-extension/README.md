# Subloom browser extension

This Chrome and Edge extension shows the next subscription renewal or trial ending, plus everything still due through Sunday in your workspace timezone. Select an event to open its subscription.

## Install unpacked

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Turn on **Developer mode**, choose **Load unpacked**, and select this `browser-extension` folder.
3. Open or reload [Subloom](https://app.subloom.tn), then pin and open the Subloom extension from the browser toolbar.

Keep the Subloom web app open in a tab. The extension reads upcoming dates from that tab using the current workspace and session, including guest workspaces. It respects the web app lock and keeps no copy of subscription details. The extension runs only on the Subloom web app.

The hosted app needs the web bridge included in this change. For local development, start the app with `npm run dev`. Copy this folder to a temporary location, replace both `https://app.subloom.tn/*` entries in the copy's manifest with `http://localhost:8081/*`, and load that copy unpacked.
