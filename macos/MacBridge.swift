import AppKit
import WebKit
import UserNotifications
import AuthenticationServices

@MainActor final class MacBridge: NSObject, WKScriptMessageHandlerWithReply, UNUserNotificationCenterDelegate, ASWebAuthenticationPresentationContextProviding {
    let store: SnapshotStore
    let center = UNUserNotificationCenter.current()
    weak var webView: WKWebView?
    var appUpdater: MacUpdater?
    var workspace: String?
    var notificationWork: Task<Void, Never>?
    var navigation: [String: String]?
    var authSession: ASWebAuthenticationSession?

    static let bootstrap = """
    Object.defineProperty(window, 'subloomMac', { value: Object.freeze({
      version: 1,
      request: message => window.webkit.messageHandlers.subloom.postMessage(message)
    }), writable: false, configurable: false });
    """

    init(store: SnapshotStore) {
        self.store = store
        self.workspace = UserDefaults.standard.string(forKey: "subloom.active-workspace")
        super.init(); center.delegate = self
    }
    private func identity(_ body: [String: Any]) throws -> String {
        guard let value = body["identity"] as? String, validWorkspace(value) else { throw LocalAppError.invalid("Invalid workspace.") }
        return value
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard trustedBridgeFrame(message.frameInfo.request.url, mainFrame: message.frameInfo.isMainFrame),
              message.frameInfo.securityOrigin.protocol == "http", message.frameInfo.securityOrigin.host == "127.0.0.1",
              message.frameInfo.securityOrigin.port == 48187,
              let body = message.body as? [String: Any], let op = body["op"] as? String else {
            replyHandler(nil, "This request is not allowed."); return
        }
        // Disk writes remain available even while a notification permission prompt is open.
        do {
            switch op {
            case "update.draft":
                guard let active = body["active"] as? Bool else { throw LocalAppError.invalid("Invalid update protection request.") }
                appUpdater?.hasDraft = active; replyHandler(true, nil); return
            case "update.status": replyHandler(appUpdater?.state ?? ["supported": false, "status": "unavailable"], nil); return
            case "update.check": replyHandler(appUpdater?.check() ?? ["supported": false, "status": "unavailable"], nil); return
            case "update.install": appUpdater?.showUpdates(); replyHandler(true, nil); return
            case "auth.open":
                try openAuth(body, reply: replyHandler); return
            case "wallet.open":
                guard let raw = body["url"] as? String, raw.utf8.count <= 256,
                      let url = URL(string: raw), url.scheme == "bitcoin", url.host == nil,
                      !url.path.isEmpty, url.fragment == nil, NSWorkspace.shared.open(url) else {
                    throw LocalAppError.invalid("No Bitcoin wallet could open this request. Install a wallet that supports bitcoin: links, then retry.")
                }
                replyHandler(true, nil); return
            case "snapshot.read": replyHandler(try store.read(identity(body)) ?? NSNull(), nil); return
            case "snapshot.write":
                guard let value = body["value"] as? String else { throw LocalAppError.invalid("Invalid local data.") }
                try store.write(identity(body), value: value); replyHandler(true, nil); return
            case "snapshot.remove": try store.remove(identity(body)); replyHandler(true, nil); return
            case "feature.read", "feature.write":
                guard let key = body["key"] as? String else { throw LocalAppError.invalid("Invalid feature key.") }
                let owner = try identity(body)
                if op == "feature.read" { replyHandler(try store.readFeature(owner, key: key) ?? NSNull(), nil) }
                else {
                    guard let value = body["value"] as? String else { throw LocalAppError.invalid("Invalid feature data.") }
                    try store.writeFeature(owner, key: key, value: value); replyHandler(true, nil)
                }
                return
            case "feature.clear": try store.clearFeatures(identity(body)); replyHandler(true, nil); return
            case "feature.remove":
                guard let key = body["key"] as? String else { throw LocalAppError.invalid("Invalid feature key.") }
                try store.removeFeature(identity(body), key: key); replyHandler(true, nil); return
            case "notification.navigation":
                let value: Any = navigation ?? NSNull(); navigation = nil; replyHandler(value, nil); return
            case "notification.settings":
                NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.Notifications-Settings.extension")!)
                replyHandler(true, nil); return
            case "notification.activate", "notification.enable", "notification.replace", "notification.clear", "notification.test": break
            default: throw LocalAppError.invalid("Unsupported Mac request.")
            }
        } catch { replyHandler(nil, error.localizedDescription); return }
        let previous = notificationWork
        notificationWork = Task { [weak self] in
            await previous?.value
            guard let self else { replyHandler(nil, "The app has closed."); return }
            do { replyHandler(try await self.perform(op, body: body), nil) }
            catch { replyHandler(nil, error.localizedDescription) }
        }
    }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        webView!.window!
    }
    private func openAuth(_ body: [String: Any], reply: @escaping (Any?, String?) -> Void) throws {
        guard authSession == nil else { throw LocalAppError.invalid("A sign-in is already in progress.") }
        guard webView?.window != nil, let raw = body["url"] as? String,
              let url = URL(string: raw), validAuthURL(url),
              let redirect = body["redirect"] as? String, validAuthRedirect(redirect) else {
            throw LocalAppError.invalid("Invalid sign-in request.")
        }
        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "subloom") { [weak self] callback, error in
            Task { @MainActor in
                self?.authSession = nil
                if let callback, validAuthCallback(callback, redirect: redirect) {
                    reply(callback.absoluteString, nil)
                } else {
                    reply(nil, error == nil ? "Unexpected sign-in callback. Try again." : "Sign-in canceled or unavailable. Please try again.")
                }
            }
        }
        session.presentationContextProvider = self
        authSession = session
        if !session.start() {
            authSession = nil
            throw LocalAppError.invalid("The sign-in browser could not open. Please try again.")
        }
    }
    private func clear() async {
        let pending = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix("subloom.") })
        let delivered = await center.deliveredNotifications()
        center.removeDeliveredNotifications(withIdentifiers: delivered.map { $0.request.identifier }.filter { $0.hasPrefix("subloom.") })
    }
    private func status(_ identity: String) async -> [String: Any] {
        let settings = await center.notificationSettings()
        let permission: String
        switch settings.authorizationStatus {
        case .authorized, .provisional: permission = "granted"
        case .denied: permission = "denied"
        default: permission = "notDetermined"
        }
        let pending = await center.pendingNotificationRequests().filter { $0.identifier.hasPrefix("subloom.reminder.") }.count
        let delivered = await center.deliveredNotifications()
        let testDelivered = delivered.contains { $0.request.identifier == "subloom.test" && $0.request.content.userInfo["identity"] as? String == identity }
        return ["permission": permission, "enabled": UserDefaults.standard.bool(forKey: "subloom.local-reminders." + identity),
                "pending": pending, "alertsEnabled": settings.alertSetting == .enabled, "testDelivered": testDelivered]
    }
    private func requireCurrent(_ identity: String) throws {
        guard workspace == identity else { throw LocalAppError.invalid("Your workspace changed. Please retry.") }
    }
    private func perform(_ op: String, body: [String: Any]) async throws -> Any {
        if op == "notification.clear" {
            workspace = nil; UserDefaults.standard.removeObject(forKey: "subloom.active-workspace")
            await clear(); return true
        }
        let identity = try identity(body)
        if op == "notification.activate" {
            if workspace != identity {
                await clear(); workspace = identity
                UserDefaults.standard.set(identity, forKey: "subloom.active-workspace")
            }
            return await status(identity)
        }
        try requireCurrent(identity)
        if op == "notification.enable" {
            guard let enabled = body["enabled"] as? Bool else { throw LocalAppError.invalid("Invalid reminder preference.") }
            if enabled {
                guard try await center.requestAuthorization(options: [.alert, .sound]) else {
                    throw LocalAppError.invalid("Allow Subloom notifications in System Settings, then try again.")
                }
            } else { await clear() }
            UserDefaults.standard.set(enabled, forKey: "subloom.local-reminders." + identity)
            return await status(identity)
        }
        let enabled = UserDefaults.standard.bool(forKey: "subloom.local-reminders." + identity)
        let settings = await center.notificationSettings()
        let authorized = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
        if op == "notification.test" {
            guard enabled && authorized else { throw LocalAppError.invalid("Enable Mac notifications and allow Subloom in System Settings first.") }
            center.removeDeliveredNotifications(withIdentifiers: ["subloom.test"])
            let content = UNMutableNotificationContent()
            content.title = "Subloom test reminder"; content.body = "Local notifications are working on this Mac."
            content.sound = .default; content.userInfo = ["identity": identity, "path": "/settings"]
            try await center.add(UNNotificationRequest(identifier: "subloom.test", content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)))
            return true
        }
        guard let plans = body["requests"] as? [[String: Any]], plans.count <= 48 else { throw LocalAppError.invalid("Invalid reminder plan.") }
        let formatter = ISO8601DateFormatter()
        var requests: [UNNotificationRequest] = []
        for plan in plans {
            guard let key = plan["id"] as? String, key.count <= 180,
                  let title = plan["title"] as? String, title.count <= 160,
                  let text = plan["body"] as? String, text.count <= 400,
                  let path = plan["path"] as? String, validPath(path),
                  let at = plan["at"] as? String, let date = formatter.date(from: at) else {
                throw LocalAppError.invalid("Invalid reminder details.")
            }
            guard date > Date() else { continue }
            let content = UNMutableNotificationContent()
            content.title = title; content.body = text; content.sound = .default
            content.userInfo = ["identity": identity, "path": path]
            var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(secondsFromGMT: 0)!
            var components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
            components.timeZone = calendar.timeZone
            requests.append(UNNotificationRequest(identifier: "subloom.reminder." + identity + "." + key, content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)))
        }
        if !enabled || !authorized { await clear(); return await status(identity) }
        let desired = Set(requests.map(\.identifier))
        let pending = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix("subloom.reminder.") && !desired.contains($0) })
        for request in requests { try await center.add(request) }
        let retained = Set(await center.pendingNotificationRequests().map(\.identifier))
        guard desired.isSubset(of: retained) else {
            throw LocalAppError.invalid("macOS could not retain every reminder. Reopen Subloom to refresh the schedule.")
        }
        return await status(identity)
    }
    private func validPath(_ path: String) -> Bool {
        if path == "/settings" || path == "/" { return true }
        let parts = path.split(separator: "/")
        return parts.count == 2 && ["subscription", "detection"].contains(String(parts[0])) && UUID(uuidString: String(parts[1])) != nil && path == "/" + parts.joined(separator: "/")
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        Task { @MainActor in
            let info = response.notification.request.content.userInfo
            if let identity = info["identity"] as? String, validWorkspace(identity), let path = info["path"] as? String, self.validPath(path) {
                self.navigation = ["identity": identity, "path": path]
                _ = try? await self.webView?.evaluateJavaScript("window.dispatchEvent(new Event('subloom-notification'))")
                NSApp.activate(ignoringOtherApps: true)
            }
            completionHandler()
        }
    }
}
