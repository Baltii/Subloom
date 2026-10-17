import AppKit
import SwiftUI

struct PreviewTile: View {
    let label: String
    let display: WidgetDisplay
    var dark = false
    var medium = false
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(label).font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
            RenewalWidgetContent(display: display, expanded: medium)
                .environment(\.colorScheme, dark ? .dark : .light)
                .frame(width: medium ? 364 : 170, height: 170)
                .background(dark ? Color(red: 16/255, green: 26/255, blue: 22/255) : Color(red: 248/255, green: 250/255, blue: 248/255))
                .clipShape(RoundedRectangle(cornerRadius: 22))
        }
    }
}

@main struct WidgetPreview {
    @MainActor static func main() throws {
        _ = NSApplication.shared
        let content = VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Subloom · Next subscription").font(.system(size: 24, weight: .semibold, design: .rounded))
                Text("Native SwiftUI previews · example data · small and medium").font(.system(size: 13)).foregroundStyle(.secondary)
            }
            HStack(alignment: .top, spacing: 24) {
                PreviewTile(label: "Renewal · Light", display: WidgetDisplay(state: .event, name: "Streamly", dateLabel: "Tue, 20 Oct", countdown: "In 3 days"))
                PreviewTile(label: "Trial end · Dark", display: WidgetDisplay(state: .event, name: "Design Studio", kind: "trial", dateLabel: "Sun, 18 Oct", countdown: "Tomorrow"), dark: true)
                PreviewTile(label: "Private details", display: WidgetDisplay(state: .event, name: "Your subscription", kind: "trial", dateLabel: "Sat, 17 Oct", countdown: "Today", isPrivate: true))
                PreviewTile(label: "Empty", display: WidgetDisplay(state: .empty), dark: true)
            }
            HStack(alignment: .top, spacing: 24) {
                PreviewTile(label: "Medium · Long service name", display: WidgetDisplay(state: .event, name: "A subscription with a much longer service name", dateLabel: "Wed, 21 Oct", countdown: "In 4 days"), medium: true)
                PreviewTile(label: "Projection expired", display: WidgetDisplay(state: .refresh), dark: true, medium: true)
            }
        }
        .padding(28).background(Color(red: 230/255, green: 237/255, blue: 232/255))
        .environment(\.colorScheme, .light)
        let renderer = ImageRenderer(content: content); renderer.scale = 2
        guard let image = renderer.nsImage, let tiff = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff), let png = bitmap.representation(using: .png, properties: [:]) else {
            throw WidgetDataError.invalid
        }
        let path = CommandLine.arguments.dropFirst().first ?? "build/widget-previews.png"
        try png.write(to: URL(fileURLWithPath: path), options: .atomic)
        print("Native widget previews written to " + path)
    }
}
