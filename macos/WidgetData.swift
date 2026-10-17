import Foundation

let renewalWidgetKind = "SubloomNextRenewal"

struct WidgetDay: Codable {
    let at: Double
    let name: String?
    let subscriptionId: String?
    let kind: String?
    let dueDate: String?
    let days: Int?
}

struct WidgetPayload: Codable {
    let version: Int
    let owner: String
    let generatedAt: Double
    let validUntil: Double
    let timezone: String
    let isPrivate: Bool
    let entries: [WidgetDay]

    func validated() throws -> WidgetPayload {
        guard version == 1, owner == "guest" || UUID(uuidString: owner) != nil,
              generatedAt.isFinite, validUntil.isFinite,
              validUntil > generatedAt, validUntil - generatedAt <= 36 * 86400,
              let zone = TimeZone(identifier: timezone), entries.count == 35 else {
            throw WidgetDataError.invalid
        }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = zone
        var previous = -Double.infinity
        for entry in entries {
            guard entry.at.isFinite, entry.at > previous, entry.at < validUntil else { throw WidgetDataError.invalid }
            previous = entry.at
            guard let kind = entry.kind else {
                guard entry.name == nil, entry.subscriptionId == nil, entry.dueDate == nil, entry.days == nil else { throw WidgetDataError.invalid }
                continue
            }
            guard ["renewal", "trial"].contains(kind), let due = entry.dueDate,
                  let dueDate = widgetDate(due, timezone: zone), let days = entry.days, days >= 0,
                  calendar.dateComponents([.day], from: calendar.startOfDay(for: Date(timeIntervalSince1970: entry.at)), to: dueDate).day == days else {
                throw WidgetDataError.invalid
            }
            if isPrivate {
                guard entry.name == nil, entry.subscriptionId == nil else { throw WidgetDataError.invalid }
            } else {
                guard let name = entry.name, !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, name.count <= 80,
                      let id = entry.subscriptionId, UUID(uuidString: id) != nil else { throw WidgetDataError.invalid }
            }
        }
        return self
    }
}

enum WidgetDataError: LocalizedError {
    case invalid, staleWorkspace
    var errorDescription: String? {
        switch self {
        case .invalid: return "The Mac widget data is invalid. Reopen Subloom to refresh it."
        case .staleWorkspace: return "Your workspace changed. Refresh the widget in the current workspace."
        }
    }
}

func widgetDate(_ value: String, timezone: TimeZone) -> Date? {
    guard value.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil else { return nil }
    let parts = value.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    var calendar = Calendar(identifier: .gregorian); calendar.timeZone = timezone
    let components = DateComponents(year: parts[0], month: parts[1], day: parts[2])
    guard let date = calendar.date(from: components),
          calendar.dateComponents([.year, .month, .day], from: date) == components else { return nil }
    return date
}

final class WidgetSnapshotStore {
    let directory: URL
    var file: URL { directory.appendingPathComponent("next-renewal.json") }
    init(directory: URL) { self.directory = directory }
    static func configured(bundle: Bundle = .main) -> WidgetSnapshotStore? {
        guard let group = bundle.object(forInfoDictionaryKey: "SubloomWidgetAppGroup") as? String,
              !group.isEmpty, let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return nil }
        return WidgetSnapshotStore(directory: root.appendingPathComponent("SubloomWidget", isDirectory: true))
    }
    func read() throws -> WidgetPayload? {
        guard FileManager.default.fileExists(atPath: file.path) else { return nil }
        let data = try Data(contentsOf: file)
        guard data.count <= 131072 else { throw WidgetDataError.invalid }
        return try JSONDecoder().decode(WidgetPayload.self, from: data).validated()
    }
    func write(_ value: String, owner: String) throws {
        let data = Data(value.utf8)
        guard data.count <= 131072 else { throw WidgetDataError.invalid }
        let payload = try JSONDecoder().decode(WidgetPayload.self, from: data).validated()
        guard payload.owner == owner else { throw WidgetDataError.staleWorkspace }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        try data.write(to: file, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
    }
    func clear() throws {
        if FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) }
    }
}

func widgetLink(owner: String, subscriptionId: String?) -> URL {
    var url = URLComponents(); url.scheme = "subloom-widget"; url.host = "open"
    url.queryItems = [URLQueryItem(name: "workspace", value: owner)]
    if let subscriptionId { url.queryItems?.append(URLQueryItem(name: "subscription", value: subscriptionId)) }
    return url.url!
}

func widgetNavigation(_ url: URL) -> [String: String]? {
    guard url.scheme == "subloom-widget", url.host == "open", url.path.isEmpty,
          url.user == nil, url.password == nil, url.port == nil, url.fragment == nil,
          let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
          query.count <= 2, Set(query.map(\.name)).count == query.count,
          query.allSatisfy({ ["workspace", "subscription"].contains($0.name) }),
          let owner = query.first(where: { $0.name == "workspace" })?.value,
          owner == "guest" || UUID(uuidString: owner) != nil else { return nil }
    let id = query.first(where: { $0.name == "subscription" })?.value
    if query.contains(where: { $0.name == "subscription" }), id == nil { return nil }
    if let id, UUID(uuidString: id) == nil { return nil }
    return ["identity": owner, "path": id.map { "/subscription/" + $0 } ?? "/calendar"]
}

func widgetLaunch(_ url: URL) -> Bool {
    url.scheme == "subloom-widget" && url.host == "launch" && url.path.isEmpty && url.query == nil && url.fragment == nil && url.user == nil && url.password == nil && url.port == nil
}

struct WidgetDisplay {
    enum State { case event, empty, refresh, setup }
    let state: State
    var name = ""
    var kind = "renewal"
    var dateLabel = ""
    var countdown = ""
    var isPrivate = false
    var url: URL?

    static func current(payload: WidgetPayload?, at now: Date = Date(), configured: Bool = true) -> WidgetDisplay {
        guard configured else { return WidgetDisplay(state: .setup) }
        guard let payload, now.timeIntervalSince1970 >= payload.generatedAt - 300,
              now.timeIntervalSince1970 < payload.validUntil,
              let day = payload.entries.last(where: { $0.at <= now.timeIntervalSince1970 }) else {
            return WidgetDisplay(state: .refresh)
        }
        let url = widgetLink(owner: payload.owner, subscriptionId: day.subscriptionId)
        guard let kind = day.kind, let due = day.dueDate, let days = day.days,
              let zone = TimeZone(identifier: payload.timezone), let date = widgetDate(due, timezone: zone) else {
            return WidgetDisplay(state: .empty, url: url)
        }
        let format = DateFormatter(); format.locale = .autoupdatingCurrent; format.timeZone = zone
        format.setLocalizedDateFormatFromTemplate("EEE d MMM")
        return WidgetDisplay(state: .event, name: day.name ?? "Your subscription", kind: kind,
            dateLabel: format.string(from: date), countdown: days == 0 ? "Today" : days == 1 ? "Tomorrow" : "In \(days) days",
            isPrivate: payload.isPrivate, url: url)
    }
}
