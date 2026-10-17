import Foundation
import WidgetKit

@MainActor final class WidgetPublisher {
    let store: WidgetSnapshotStore?
    private var owner: String?
    private var session: String?
    private var isPrivate: Bool?
    private let reload: () -> Void
    init(store: WidgetSnapshotStore? = WidgetSnapshotStore.configured(), reload: @escaping () -> Void = { WidgetCenter.shared.reloadTimelines(ofKind: renewalWidgetKind) }) {
        self.store = store; self.reload = reload
    }
    var available: Bool { store != nil }
    func activate(owner: String, session: String, isPrivate: Bool) throws {
        guard validWorkspace(owner), UUID(uuidString: session) != nil else { throw WidgetDataError.invalid }
        if self.owner != owner || (isPrivate && self.isPrivate != true) { try clear() }
        self.owner = owner; self.session = session; self.isPrivate = isPrivate
    }
    func publish(owner: String, session: String, value: String) throws {
        guard self.owner == owner, self.session == session else { throw WidgetDataError.staleWorkspace }
        guard let store else { throw WidgetDataError.invalid }
        guard try JSONDecoder().decode(WidgetPayload.self, from: Data(value.utf8)).isPrivate == isPrivate else { throw WidgetDataError.staleWorkspace }
        try store.write(value, owner: owner)
        reload()
    }
    func clear() throws {
        owner = nil; session = nil; isPrivate = nil
        try store?.clear()
        if available { reload() }
    }
}
