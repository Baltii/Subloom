import Foundation

@main struct WidgetTests {
    @MainActor static func main() throws {
        var passed = 0
        func check(_ condition: Bool, _ label: String) throws {
            guard condition else { throw WidgetDataError.invalid }
            passed += 1; print("PASS " + label)
        }
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("subloom-widget-tests-" + UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = WidgetSnapshotStore(directory: root)
        let zone = TimeZone(identifier: "Europe/Paris")!
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = zone
        let start = widgetDate("2026-10-17", timezone: zone)!
        let owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222"
        func fixture(_ owner: String, isPrivate: Bool = false) -> WidgetPayload {
            let entries = (0..<35).map { offset -> WidgetDay in
                let date = calendar.date(byAdding: .day, value: offset, to: start)!
                let due = calendar.date(byAdding: .day, value: 1, to: date)!
                let format = DateFormatter(); format.calendar = calendar; format.timeZone = zone; format.dateFormat = "yyyy-MM-dd"
                return WidgetDay(at: date.timeIntervalSince1970, name: isPrivate ? nil : "Streamly", subscriptionId: isPrivate ? nil : owner, kind: "renewal", dueDate: format.string(from: due), days: 1)
            }
            return WidgetPayload(version: 1, owner: owner, generatedAt: start.addingTimeInterval(12 * 3600).timeIntervalSince1970,
                validUntil: calendar.date(byAdding: .day, value: 35, to: start)!.timeIntervalSince1970,
                timezone: zone.identifier, isPrivate: isPrivate, entries: entries)
        }
        func json(_ value: WidgetPayload) throws -> String { String(data: try JSONEncoder().encode(value), encoding: .utf8)! }
        let payload = fixture(owner), value = try json(payload)
        try store.write(value, owner: owner)
        try check(try store.read()?.owner == owner, "Shared snapshot survives reopening")
        let attributes = try FileManager.default.attributesOfItem(atPath: store.file.path)
        try check(attributes[.posixPermissions] as? Int == 0o600, "Shared widget file is owner private")
        for invalid in [value.replacingOccurrences(of: "2026-10-18", with: "2026-02-30"), "{}", String(repeating: "x", count: 131073)] {
            do { try store.write(invalid, owner: owner); fatalError("Invalid widget accepted") }
            catch { try check(try store.read()?.owner == owner, "Invalid write preserves the last valid snapshot") }
        }
        do { try store.write(value, owner: other); fatalError("Wrong owner accepted") }
        catch { try check(try store.read()?.owner == owner, "Reject another workspace's payload") }
        let visible = WidgetDisplay.current(payload: payload, at: start.addingTimeInterval(13 * 3600))
        try check(visible.name == "Streamly" && visible.countdown == "Tomorrow", "Select today's date-only countdown")
        try check(WidgetDisplay.current(payload: payload, at: Date(timeIntervalSince1970: payload.validUntil)).state == .refresh, "Expired projection requests an app refresh")
        try check(WidgetDisplay.current(payload: nil, configured: false).state == .setup, "Missing signing never displays fabricated events")
        let privateDisplay = WidgetDisplay.current(payload: fixture(owner, isPrivate: true), at: start.addingTimeInterval(13 * 3600))
        try check(privateDisplay.name == "Your subscription" && privateDisplay.isPrivate, "Private widget contains no merchant name")
        let publisher = WidgetPublisher(store: store, reload: {})
        let first = UUID().uuidString, second = UUID().uuidString
        try publisher.activate(owner: owner, session: first, isPrivate: false)
        try publisher.publish(owner: owner, session: first, value: value)
        try publisher.activate(owner: other, session: second, isPrivate: false)
        try check(try store.read() == nil, "Changing workspace clears shared event data")
        do { try publisher.publish(owner: owner, session: first, value: value); fatalError("Stale publish accepted") }
        catch { try check(try store.read() == nil, "Old session cannot repopulate a new workspace's widget") }
        try publisher.publish(owner: other, session: second, value: json(fixture(other)))
        let third = UUID().uuidString
        try publisher.activate(owner: other, session: third, isPrivate: true)
        try check(try store.read() == nil, "Enabling privacy clears the previous detailed projection")
        do { try publisher.publish(owner: other, session: third, value: json(fixture(other))); fatalError("Unredacted data accepted") }
        catch { try check(try store.read() == nil, "Private activation rejects a detailed payload") }
        try publisher.publish(owner: other, session: third, value: json(fixture(other, isPrivate: true)))
        try publisher.clear()
        try check(try store.read() == nil, "Sign-out removes the shared projection")
        let link = widgetLink(owner: owner, subscriptionId: other)
        try check(widgetNavigation(link)?["path"] == "/subscription/" + other, "Widget click opens only its scoped subscription")
        try check(widgetNavigation(widgetLink(owner: owner, subscriptionId: nil))?["path"] == "/calendar", "Private widget opens its workspace calendar")
        for raw in ["https://example.com", "subloom-widget://open?workspace=../guest", "subloom-widget://open?workspace=guest&subscription=bad", "subloom-widget://open?workspace=guest&workspace=guest", "subloom-widget://user@open?workspace=guest", "subloom-widget://open/path?workspace=guest", "subloom-widget://open?workspace=guest#bad"] {
            try check(widgetNavigation(URL(string: raw)!) == nil, "Reject malformed or external widget links")
        }
        try check(widgetLaunch(URL(string: "subloom-widget://launch")!), "Setup widget can open the app without switching workspace")
        try check(!widgetLaunch(URL(string: "subloom-widget://launch?url=https://example.com")!), "Launch URL accepts no external redirect")
        print("\(passed) native widget checks passed.")
    }
}
