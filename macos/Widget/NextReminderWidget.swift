import SwiftUI
import WidgetKit

struct ReminderEntry: TimelineEntry {
    let date: Date
    let snapshot: ReminderWidgetSnapshot?
}
struct ReminderProvider: TimelineProvider {
    func placeholder(in context: Context) -> ReminderEntry { ReminderEntry(date: Date(), snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (ReminderEntry) -> Void) {
        completion(ReminderEntry(date: Date(), snapshot: ReminderWidgetStore.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ReminderEntry>) -> Void) {
        let now = Date(), snapshot = ReminderWidgetStore.read()
        var dates = [now]
        // Daily entries refresh relative dates and advance the next subscription
        // even while the containing app is closed. Honor the workspace timezone.
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: snapshot?.timezone ?? "UTC") ?? .gmt
        let start = calendar.startOfDay(for: now)
        for day in 1...90 {
            if let date = calendar.date(byAdding: .day, value: day, to: start) { dates.append(date) }
        }
        completion(Timeline(entries: dates.map { ReminderEntry(date: $0, snapshot: snapshot) }, policy: .after(now.addingTimeInterval(3600))))
    }
}
// The exact four-petal path from src/brand/identity.ts, scaled as a native shape.
struct WidgetBloom: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let petals: [[CGPoint]] = [
            [CGPoint(x: 2.667, y: 33.333), CGPoint(x: 6.667, y: 5.333), CGPoint(x: 21.333, y: 10.667), CGPoint(x: 29.333, y: 13.333), CGPoint(x: 32, y: 21.333)],
            [CGPoint(x: 30.667, y: 2.667), CGPoint(x: 58.667, y: 6.667), CGPoint(x: 53.333, y: 21.333), CGPoint(x: 50.667, y: 29.333), CGPoint(x: 42.667, y: 32)],
            [CGPoint(x: 61.333, y: 30.667), CGPoint(x: 57.333, y: 58.667), CGPoint(x: 42.667, y: 53.333), CGPoint(x: 34.667, y: 50.667), CGPoint(x: 32, y: 42.667)],
            [CGPoint(x: 33.333, y: 61.333), CGPoint(x: 5.333, y: 57.333), CGPoint(x: 10.667, y: 42.667), CGPoint(x: 13.333, y: 34.667), CGPoint(x: 21.333, y: 32)]
        ]
        for petal in petals {
            path.move(to: CGPoint(x: 32, y: 32))
            path.addCurve(to: petal[2], control1: petal[0], control2: petal[1])
            path.addCurve(to: CGPoint(x: 32, y: 32), control1: petal[3], control2: petal[4])
            path.closeSubpath()
        }
        return path.applying(CGAffineTransform(scaleX: rect.width / 64, y: rect.height / 64))
    }
}
struct ReminderWidgetPalette {
    let dark: Bool
    var background: Color { dark ? Color(red: 24/255, green: 37/255, blue: 30/255) : Color(red: 248/255, green: 250/255, blue: 248/255) }
    var text: Color { dark ? Color(red: 231/255, green: 242/255, blue: 233/255) : Color(red: 24/255, green: 45/255, blue: 37/255) }
    var secondary: Color { dark ? Color(red: 160/255, green: 180/255, blue: 165/255) : Color(red: 88/255, green: 111/255, blue: 97/255) }
    var accent: Color { dark ? Color(red: 112/255, green: 210/255, blue: 173/255) : Color(red: 8/255, green: 124/255, blue: 101/255) }
    var trial: Color { dark ? Color(red: 234/255, green: 193/255, blue: 135/255) : Color(red: 155/255, green: 99/255, blue: 29/255) }
}
struct ReminderWidgetContent: View {
    let entry: ReminderEntry
    let family: WidgetFamily
    @Environment(\.colorScheme) private var scheme
    private var palette: ReminderWidgetPalette { ReminderWidgetPalette(dark: scheme == .dark) }
    private var medium: Bool { family == .systemMedium }
    private var item: ReminderWidgetItem? { entry.snapshot?.item(at: entry.date) }
    private var dateParts: (short: String, full: String, relative: String)? {
        guard let item, !item.date.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: entry.snapshot?.timezone ?? "UTC") ?? .gmt
        formatter.dateFormat = "yyyy-MM-dd"
        guard let due = formatter.date(from: item.date) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = formatter.timeZone
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: entry.date), to: due).day ?? 0
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate("MMM d")
        let short = formatter.string(from: due)
        formatter.setLocalizedDateFormatFromTemplate("MMMM d yyyy")
        return (short, formatter.string(from: due), days == 0 ? "Today" : days == 1 ? "Tomorrow" : "In \(days) days")
    }
    private var state: (title: String, message: String, symbol: String) {
        guard let snapshot = entry.snapshot, snapshot.expiresAt > entry.date.timeIntervalSince1970 * 1000 else {
            return ("Refresh reminders", "Open Subloom to bring your next renewal up to date.", "arrow.clockwise")
        }
        if snapshot.mode == "private" { return ("Details hidden", "Open Subloom to see your subscription reminders.", "lock") }
        if snapshot.mode == "setup" { return ("Make room for clarity", "Add your subscriptions in Subloom to see what renews next.", "calendar.badge.plus") }
        return ("All clear", "No upcoming renewals or trials.", "checkmark")
    }
    var body: some View {
        Group {
            if let item, let date = dateParts { reminder(item, date: date) }
            else { emptyState }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .foregroundStyle(palette.text)
    }
    private var mark: some View {
        WidgetBloom().fill(palette.accent).frame(width: 26, height: 26)
            .widgetAccentable().accessibilityHidden(true)
    }
    private func reminder(_ item: ReminderWidgetItem, date: (short: String, full: String, relative: String)) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 8) {
                Text(item.name)
                    .font(.system(size: medium ? 22 : 17, weight: .semibold, design: .rounded))
                    .tracking(-0.35).lineLimit(2).minimumScaleFactor(0.85)
                    .frame(maxWidth: .infinity, alignment: .leading)
                mark
            }
            Spacer(minLength: medium ? 12 : 3)
            HStack(alignment: .bottom, spacing: 12) {
                VStack(alignment: .leading, spacing: medium ? 5 : 2) {
                    Text(item.label).font(.system(size: 12, weight: .medium))
                        .foregroundStyle(palette.secondary).lineLimit(1)
                    Text(date.short).font(.system(size: medium ? 30 : 26, weight: .semibold, design: .rounded))
                        .tracking(-0.5).monospacedDigit()
                        .lineLimit(1).minimumScaleFactor(0.75)
                    Text(date.relative).font(.system(size: 13, weight: .medium))
                        .foregroundStyle(item.label == "Trial ends" ? palette.trial : palette.accent)
                        .lineLimit(1).widgetAccentable()
                }
                if medium {
                    Spacer(minLength: 0)
                    Text(item.amount).font(.system(size: 22, weight: .medium, design: .rounded))
                        .monospacedDigit().lineLimit(1).minimumScaleFactor(0.65)
                        .padding(.bottom, 1)
                }
            }
            if !medium {
                Spacer(minLength: 3)
                HStack {
                    Text(item.amount).font(.system(size: 15, weight: .medium)).monospacedDigit()
                        .lineLimit(1).minimumScaleFactor(0.7)
                    Spacer(minLength: 8)
                    Image(systemName: "arrow.up.right").font(.system(size: 11, weight: .medium))
                        .foregroundStyle(palette.secondary).accessibilityHidden(true)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.name). \(item.label) \(date.full). \(date.relative). \(item.amount). Open subscription in Subloom.")
    }
    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Subloom").font(.system(size: 16, weight: .semibold, design: .rounded))
                Spacer()
                mark
            }
            Spacer(minLength: 12)
            Label(state.title, systemImage: state.symbol)
                .font(.system(size: 15, weight: .semibold)).lineLimit(2)
            Text(state.message).font(.system(size: 12)).foregroundStyle(palette.secondary)
                .fixedSize(horizontal: false, vertical: true).padding(.top, 6)
        }
        .accessibilityElement(children: .combine)
    }
}
struct NextReminderView: View {
    let entry: ReminderEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        ReminderWidgetContent(entry: entry, family: family)
            .containerBackground(ReminderWidgetPalette(dark: scheme == .dark).background, for: .widget)
            .widgetURL(widgetURL)
    }
    private var widgetURL: URL? {
        var parts = URLComponents(); parts.scheme = "subloom"; parts.host = "open"
        parts.queryItems = [URLQueryItem(name: "path", value: entry.snapshot?.item(at: entry.date)?.path ?? "/")]
        return parts.url
    }
}
#if !WIDGET_PREVIEW
@main struct SubloomNextReminderWidget: Widget {
    let kind = "SubloomNextReminder"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ReminderProvider()) { entry in NextReminderView(entry: entry) }
            .configurationDisplayName("Next reminder")
            .description("Your next subscription renewal or trial ending.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#endif
