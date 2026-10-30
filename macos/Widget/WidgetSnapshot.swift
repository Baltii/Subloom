import Foundation
import OSLog
import Darwin

struct ReminderWidgetItem: Codable {
    let from: Double
    let name: String
    let label: String
    let date: String
    let amount: String
    let path: String
}
struct ReminderWidgetSnapshot: Codable {
    let version: Int
    let timezone: String
    let expiresAt: Double
    let mode: String
    let entries: [ReminderWidgetItem]

    func item(at now: Date) -> ReminderWidgetItem? {
        guard version == 1, mode == "ready", expiresAt > now.timeIntervalSince1970 * 1000 else { return nil }
        return entries.last { $0.from <= now.timeIntervalSince1970 * 1000 }
    }
}
enum ReminderWidgetStore {
    private static let logger = Logger(subsystem: "com.subloom.mac.test", category: "widget-storage")
    // Ad-hoc test builds cannot use provisioned app groups. Both sandboxed
    // processes get access to this one snapshot directory via scoped entitlements.
    static let localDirectory = "Library/Application Support/SubloomWidgets"
    static var fileURL: URL? {
        if Bundle.main.object(forInfoDictionaryKey: "SubloomWidgetStorage") as? String == "local" {
            guard let home = getpwuid(getuid())?.pointee.pw_dir else { return nil }
            return URL(fileURLWithPath: String(cString: home), isDirectory: true)
                .appendingPathComponent(localDirectory, isDirectory: true)
                .appendingPathComponent("next-reminder.json")
        }
        guard let group = Bundle.main.object(forInfoDictionaryKey: "SubloomWidgetAppGroup") as? String,
              let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return nil }
        return directory.appendingPathComponent("next-reminder.json")
    }
    static func read() -> ReminderWidgetSnapshot? {
        do {
            guard let file = fileURL else { throw CocoaError(.fileReadNoPermission) }
            let snapshot = try JSONDecoder().decode(ReminderWidgetSnapshot.self, from: Data(contentsOf: file))
            logger.notice("Widget cache read: mode=\(snapshot.mode, privacy: .public), entries=\(snapshot.entries.count)")
            return snapshot
        } catch {
            logger.error("Widget cache read failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
    static func write(_ value: String) throws {
        do {
            let data = Data(value.utf8)
            guard data.count <= 131072 else { throw CocoaError(.fileWriteOutOfSpace) }
            let snapshot = try JSONDecoder().decode(ReminderWidgetSnapshot.self, from: data)
            guard snapshot.version == 1, snapshot.entries.count <= 90 else { throw CocoaError(.coderInvalidValue) }
            guard let file = fileURL else { throw CocoaError(.fileWriteNoPermission) }
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: file, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
            logger.notice("Widget cache saved: mode=\(snapshot.mode, privacy: .public), entries=\(snapshot.entries.count)")
        } catch {
            logger.error("Widget cache write failed: \(error.localizedDescription, privacy: .public)")
            throw error
        }
    }
}
