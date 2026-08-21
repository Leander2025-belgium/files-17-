import ActivityKit
import SwiftUI
import WidgetKit

struct RainETALiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RainETAActivityAttributes.self) { context in
            RainETALockScreenView(context: context)
                .activityBackgroundTint(Color(red: 0.03, green: 0.13, blue: 0.20))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "wheaterflow://rain-eta"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Rain ETA", systemImage: context.state.symbolName)
                        .font(.caption.bold())
                        .foregroundStyle(.cyan)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.confidencePercent)%")
                        .font(.caption.bold())
                        .foregroundStyle(.cyan)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 5) {
                        Text(context.state.summary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                        if let startTime = context.state.startTime, context.state.status == .rainSoon {
                            ProgressView(timerInterval: Date()...max(startTime, Date().addingTimeInterval(1)), countsDown: true)
                                .tint(.cyan)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: context.state.symbolName)
                    .foregroundStyle(.cyan)
            } compactTrailing: {
                Text(context.state.compactValue)
                    .font(.caption.bold())
                    .foregroundStyle(.cyan)
            } minimal: {
                Image(systemName: context.state.symbolName)
                    .foregroundStyle(.cyan)
            }
            .widgetURL(URL(string: "wheaterflow://rain-eta"))
            .keylineTint(.cyan)
        }
    }
}

private struct RainETALockScreenView: View {
    let context: ActivityViewContext<RainETAActivityAttributes>

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: context.state.symbolName)
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(.cyan)
                .frame(width: 46, height: 46)
                .background(.white.opacity(0.09), in: Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(context.attributes.locationName.uppercased())
                    .font(.caption2.bold())
                    .foregroundStyle(.cyan)
                Text(context.state.title)
                    .font(.headline)
                    .lineLimit(1)
                Text(context.state.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 2) {
                Text(context.state.compactValue)
                    .font(.title3.bold())
                Text("\(context.state.confidencePercent)% zeker")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}

private extension RainETAActivityAttributes.ContentState {
    var compactValue: String {
        switch status {
        case .raining: return "Nu"
        case .rainSoon: return startsInMinutes.map { "\($0)m" } ?? "Snel"
        case .dry: return "Droog"
        case .unavailable: return "—"
        }
    }

    var symbolName: String {
        if thunderPossible { return "cloud.bolt.rain.fill" }
        switch status {
        case .raining: return heavyShower ? "cloud.heavyrain.fill" : "cloud.rain.fill"
        case .rainSoon: return "umbrella.fill"
        case .dry: return "sun.max.fill"
        case .unavailable: return "cloud.slash.fill"
        }
    }
}

#Preview("Lock Screen", as: .content, using: RainETAActivityAttributes(locationName: "Oostende")) {
    RainETALiveActivity()
} contentStates: {
    RainETAActivityAttributes.ContentState(snapshot: .placeholder)
}

#Preview("Dynamic Island", as: .dynamicIsland(.expanded), using: RainETAActivityAttributes(locationName: "Oostende")) {
    RainETALiveActivity()
} contentStates: {
    RainETAActivityAttributes.ContentState(snapshot: .placeholder)
}
