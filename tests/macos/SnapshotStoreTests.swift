import Foundation

@main struct SnapshotStoreTests {
    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("subloom-storage-test-" + UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try SnapshotStore(directory: root)
        let a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222"
        let data = #"{"schemaVersion":1,"subscriptions":[{"name":"Fixture"}],"candidates":[{"receipt":"local"}],"activity":[{"type":"created"}],"outbox":[],"preferences":{"timezone":"Africa/Tunis"},"onboarded":true,"demo":false}"#
        func check(_ condition: Bool, _ label: String) throws {
            guard condition else { throw LocalAppError.invalid("FAIL " + label) }
            print("PASS " + label)
        }
        try store.write("guest", value: data)
        try check(try SnapshotStore(directory: root).read("guest") == data, "Guest snapshot survives a new store instance with all fields intact")
        try store.write(a, value: data); try store.write(b, value: data)
        try store.remove(a)
        try check(try store.read(a) == nil && store.read(b) == data && store.read("guest") == data, "Deletion is isolated to the selected account")
        for identity in ["../guest", "guest/other", "", "account@example.com"] {
            do { try store.write(identity, value: data); throw LocalAppError.invalid("Unsafe identity accepted") }
            catch LocalAppError.invalid(let message) { try check(message == "Invalid workspace.", "Reject unsafe identity \(identity)") }
        }
        for invalid in ["not json", #"{"schemaVersion":99}"#, #"{"schemaVersion":1,"subscriptions":[],"candidates":[],"activity":[],"outbox":[]}"#] {
            do { try store.write("guest", value: invalid); throw LocalAppError.invalid("Invalid snapshot accepted") }
            catch { try check(try store.read("guest") == data, "Invalid write preserves existing data") }
        }
        let feature = #"{"wallets":[],"transactions":[]}"#
        try store.writeFeature("guest", key: "finance", value: feature)
        try store.writeFeature(a, key: "finance", value: feature)
        try store.writeFeature("public", key: "exchange_rates", value: "[]")
        try check(try SnapshotStore(directory: root).readFeature("guest", key: "finance") == feature, "Financial features survive reopening the store")
        try store.clearFeatures(a)
        try check(try store.readFeature(a, key: "finance") == nil && store.readFeature("guest", key: "finance") == feature, "Feature clearing is owner isolated")
        try check(try store.readFeature("public", key: "exchange_rates") == "[]", "Public rates have a separate durable cache")
        for key in ["../finance", "", "bad/key"] {
            do { try store.writeFeature("guest", key: key, value: "{}"); throw LocalAppError.invalid("Unsafe key accepted") }
            catch LocalAppError.invalid(let message) { try check(message == "Invalid feature key.", "Reject unsafe feature key") }
        }
        do { try store.writeFeature("guest", key: "finance", value: "not json"); throw LocalAppError.invalid("Invalid feature accepted") }
        catch { try check(try store.readFeature("guest", key: "finance") == feature, "Malformed feature writes preserve saved finances") }
        try check(validAuthURL(URL(string: "https://provider.example/authorize")!), "Allow HTTPS sign-in providers")
        for raw in ["http://provider.example/authorize", "file:///tmp/auth", "https://user:password@provider.example"] {
            try check(!validAuthURL(URL(string: raw)!), "Reject unsafe sign-in provider URL")
        }
        try check(validAuthCallback(URL(string: "subloom://auth-callback?code=fixture")!, redirect: "subloom://auth-callback"), "Accept exact app sign-in callback")
        try check(validAuthCallback(URL(string: "subloom://mailboxes?status=connected")!, redirect: "subloom://mailboxes"), "Accept exact mailbox callback")
        for raw in ["subloom://mailboxes?code=wrong", "subloom://auth-callback/wrong?code=x", "subloom://user@auth-callback?code=x", "subloom://auth-callback#access_token=x"] {
            try check(!validAuthCallback(URL(string: raw)!, redirect: "subloom://auth-callback"), "Reject mismatched sign-in callback")
        }
        let permissions = try FileManager.default.attributesOfItem(atPath: root.appendingPathComponent("guest.json").path)[.posixPermissions] as? Int
        try check(permissions == 0o600, "Workspace files are owner-readable only")
        try check(trustedBridgeFrame(URL(string: "http://127.0.0.1:48187/settings"), mainFrame: true), "Allow the bundled main frame")
        for url in ["https://example.com", "http://localhost:48187", "http://127.0.0.1:8081", "http://user@127.0.0.1:48187", "file:///tmp/index.html"] {
            try check(!trustedBridgeFrame(URL(string: url), mainFrame: true), "Reject untrusted bridge origin \(url)")
        }
        try check(!trustedBridgeFrame(URL(string: "http://127.0.0.1:48187"), mainFrame: false), "Reject subframe access")
    }
}
