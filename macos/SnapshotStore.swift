import Foundation

enum LocalAppError: LocalizedError {
    case invalid(String)
    var errorDescription: String? { if case .invalid(let message) = self { return message }; return nil }
}

func validWorkspace(_ identity: String) -> Bool {
    identity == "guest" || UUID(uuidString: identity) != nil
}

func trustedBridgeFrame(_ url: URL?, mainFrame: Bool) -> Bool {
    guard mainFrame, let url else { return false }
    return url.scheme == "http" && url.host == "127.0.0.1" && url.port == 48187 && url.user == nil && url.password == nil
}

// Lives in this app's sandbox, independent of WebKit cache eviction or app updates.
final class SnapshotStore {
    let directory: URL
    init(directory: URL) throws {
        self.directory = directory
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    }
    private func file(_ identity: String) throws -> URL {
        guard validWorkspace(identity) else { throw LocalAppError.invalid("Invalid workspace.") }
        return directory.appendingPathComponent(identity.lowercased() + ".json")
    }
    func read(_ identity: String) throws -> String? {
        let url = try file(identity)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        guard let value = String(data: try Data(contentsOf: url), encoding: .utf8) else {
            throw LocalAppError.invalid("Your saved data could not be read. It has been preserved.")
        }
        return value
    }
    func write(_ identity: String, value: String) throws {
        let url = try file(identity)
        let data = Data(value.utf8)
        guard data.count <= 20 * 1024 * 1024,
              let snapshot = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              snapshot["schemaVersion"] as? Int == 1,
              snapshot["subscriptions"] is [Any], snapshot["candidates"] is [Any],
              snapshot["activity"] is [Any], snapshot["outbox"] is [Any],
              snapshot["preferences"] is [String: Any] else {
            throw LocalAppError.invalid("Invalid local data. The previous saved copy has been preserved.")
        }
        try data.write(to: url, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }
    func remove(_ identity: String) throws {
        let url = try file(identity)
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }
}
