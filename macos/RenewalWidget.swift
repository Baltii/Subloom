import SwiftUI
import WidgetKit

struct RenewalEntry: TimelineEntry {
    let date: Date
    let display: WidgetDisplay
}

struct RenewalProvider: TimelineProvider {
    func placeholder(in context: Context) -> RenewalEntry { preview() }
    private func preview() -> RenewalEntry {
        let now = Date(), next = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let format = DateFormatter(); format.setLocalizedDateFormatFromTemplate("EEE d MMM")
        return RenewalEntry(date: now, display: WidgetDisplay(state: .event, name: "Your subscription", dateLabel: format.string(from: next), countdown: "Tomorrow", isPrivate: true))
    }
    private func load(at now: Date) -> (WidgetPayload?, Bool) {
        guard let store = WidgetSnapshotStore.configured() else { return (nil, false) }
        return ((try? store.read()) ?? nil, true)
    }
    func getSnapshot(in context: Context, completion: @escaping (RenewalEntry) -> Void) {
        if context.isPreview { completion(preview()); return }
        let now = Date(), (payload, configured) = load(at: Date())
        completion(RenewalEntry(date: now, display: .current(payload: payload, at: now, configured: configured)))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<RenewalEntry>) -> Void) {
        let now = Date(), (payload, configured) = load(at: Date())
        var entries = [RenewalEntry(date: now, display: .current(payload: payload, at: now, configured: configured))]
        if let payload, payload.validUntil > now.timeIntervalSince1970 {
            for day in payload.entries where day.at > now.timeIntervalSince1970 {
                let at = Date(timeIntervalSince1970: day.at)
                entries.append(RenewalEntry(date: at, display: .current(payload: payload, at: at)))
            }
            let expiry = Date(timeIntervalSince1970: payload.validUntil)
            entries.append(RenewalEntry(date: expiry, display: WidgetDisplay(state: .refresh)))
            completion(Timeline(entries: entries, policy: .after(expiry)))
        } else { completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(6 * 3600)))) }
    }
}

struct RenewalEntryView: View {
    let entry: RenewalEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        RenewalWidgetContent(display: entry.display, expanded: family == .systemMedium)
            .containerBackground(for: .widget) {
                scheme == .dark ? Color(red: 16/255, green: 26/255, blue: 22/255) : Color(red: 248/255, green: 250/255, blue: 248/255)
            }
            .widgetURL(entry.display.url ?? URL(string: "subloom-widget://launch")!)
    }
}

@main struct SubloomRenewalWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: renewalWidgetKind, provider: RenewalProvider()) { entry in RenewalEntryView(entry: entry) }
            .configurationDisplayName("Next subscription")
            .description("Your nearest renewal or trial end, at a glance.")
            .supportedFamilies([.systemSmall, .systemMedium])
            .contentMarginsDisabled()
    }
}
