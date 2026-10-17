import SwiftUI

struct RenewalWidgetContent: View {
    let display: WidgetDisplay
    var expanded = false
    @Environment(\.colorScheme) private var scheme
    private var accent: Color {
        scheme == .dark ? Color(red: 112/255, green: 210/255, blue: 173/255) : Color(red: 8/255, green: 124/255, blue: 101/255)
    }
    private var secondary: Color {
        scheme == .dark ? Color(red: 160/255, green: 180/255, blue: 165/255) : Color(red: 88/255, green: 111/255, blue: 97/255)
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if display.state == .event {
                Text(display.name)
                    .font(.system(size: expanded ? 25 : 20, weight: .semibold, design: .rounded))
                    .lineLimit(2).minimumScaleFactor(0.85)
                    .privacySensitive()
                Spacer(minLength: 4)
                VStack(alignment: .leading, spacing: 3) {
                    Text(display.kind == "trial" ? "Trial ends" : "Renews")
                        .font(.system(size: 12)).foregroundStyle(secondary)
                    Text(display.dateLabel)
                        .font(.system(size: 18, weight: .medium, design: .rounded))
                        .lineLimit(1).minimumScaleFactor(0.8)
                }
                HStack {
                    Text(display.countdown).font(.system(size: 12, weight: .semibold)).foregroundStyle(accent)
                    Spacer(minLength: 4)
                    Image(systemName: display.isPrivate ? "lock" : "leaf")
                        .font(.system(size: 12)).foregroundStyle(accent).accessibilityHidden(true)
                }
            } else {
                Image(systemName: display.state == .empty ? "calendar" : "leaf")
                    .font(.system(size: 19, weight: .medium)).foregroundStyle(accent).accessibilityHidden(true)
                Spacer(minLength: 4)
                Text(display.state == .empty ? "Nothing coming up" : "Open Subloom")
                    .font(.system(size: 20, weight: .semibold, design: .rounded)).lineLimit(2)
                Text(display.state == .empty ? "Add a subscription to see its next date." : display.state == .setup ? "Finish the Mac widget setup." : "Refresh your upcoming dates.")
                    .font(.system(size: 12)).foregroundStyle(secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(16)
        .accessibilityElement(children: .combine)
    }
}
