import SwiftUI
import WidgetKit

struct RainETAEntry: TimelineEntry {
    let date: Date
    let snapshot: RainETASnapshot
}

struct RainETAProvider: TimelineProvider {
    func placeholder(in context: Context) -> RainETAEntry {
        RainETAEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (RainETAEntry) -> Void) {
        completion(RainETAEntry(
            date: Date(),
            snapshot: context.isPreview ? .placeholder : (AppGroupStore.loadSnapshot() ?? .unavailablePlaceholder)
        ))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<RainETAEntry>) -> Void) {
        Task {
            let cached = AppGroupStore.loadSnapshot()
            let location = AppGroupStore.loadLocation()
            let snapshot: RainETASnapshot
            do {
                snapshot = try await RainETAClient().fetch(for: location)
                AppGroupStore.save(snapshot: snapshot)
            } catch {
                snapshot = cached ?? .unavailablePlaceholder
            }
            let entry = RainETAEntry(date: Date(), snapshot: snapshot)
            let refresh = max(snapshot.expiresAt, Date().addingTimeInterval(15 * 60))
            completion(Timeline(entries: [entry], policy: .after(refresh)))
        }
    }
}

struct RainETAWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: RainETAEntry

    @ViewBuilder
    var body: some View {
        Group {
            switch family {
            case .accessoryInline:
                Label(entry.snapshot.title, systemImage: entry.snapshot.symbolName)
            case .accessoryCircular:
                AccessoryCircularRainView(snapshot: entry.snapshot)
            case .accessoryRectangular:
                AccessoryRectangularRainView(snapshot: entry.snapshot)
            default:
                HomeRainView(snapshot: entry.snapshot, compact: family == .systemSmall)
            }
        }
        .containerBackground(for: .widget) {
            if [.accessoryInline, .accessoryCircular, .accessoryRectangular].contains(family) {
                Color.clear
            } else {
                LinearGradient(
                    colors: [Color(red: 0.03, green: 0.11, blue: 0.20), Color(red: 0.03, green: 0.25, blue: 0.31)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }
    }
}

private struct AccessoryCircularRainView: View {
    let snapshot: RainETASnapshot

    var body: some View {
        Gauge(value: min(1, Double(snapshot.startsInMinutes ?? 120) / 120)) {
            Image(systemName: snapshot.symbolName)
        } currentValueLabel: {
            Text(snapshot.status == .rainSoon ? "\(snapshot.startsInMinutes ?? 0)m" : snapshot.status == .raining ? "Nu" : "Droog")
                .font(.caption2.bold())
        }
        .gaugeStyle(.accessoryCircular)
    }
}

private struct AccessoryRectangularRainView: View {
    let snapshot: RainETASnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Label(snapshot.location.name, systemImage: snapshot.symbolName)
                .font(.caption.bold())
            Text(snapshot.title)
                .font(.headline)
                .lineLimit(1)
            Text("\(snapshot.confidencePercent)% zeker")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

private struct HomeRainView: View {
    let snapshot: RainETASnapshot
    let compact: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 7 : 10) {
            HStack {
                Label("RAIN ETA", systemImage: snapshot.symbolName)
                    .font(.caption.bold())
                    .foregroundStyle(.cyan)
                Spacer()
                Text(snapshot.location.name)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Text(snapshot.primaryValue)
                .font(.system(size: compact ? 29 : 34, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.7)
            Text(snapshot.title)
                .font(.subheadline.weight(.semibold))
                .lineLimit(compact ? 2 : 1)

            HStack(alignment: .bottom, spacing: 3) {
                ForEach(Array(snapshot.slots.prefix(compact ? 6 : 10).enumerated()), id: \.offset) { _, slot in
                    Capsule()
                        .fill(slot.wet ? Color.cyan : Color.secondary.opacity(0.25))
                        .frame(maxWidth: .infinity)
                        .frame(height: CGFloat(max(3, min(24, slot.precipitation * 7 + 3))))
                }
            }
            .frame(height: 24, alignment: .bottom)

            if !compact {
                HStack {
                    Text(snapshot.summary).lineLimit(1)
                    Spacer()
                    Text("\(snapshot.confidencePercent)%")
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
        }
    }
}

struct RainETAWidget: Widget {
    let kind = "RainETAWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: RainETAProvider()) { entry in
            RainETAWidgetView(entry: entry)
                .widgetURL(URL(string: "wheaterflow://rain-eta"))
        }
        .configurationDisplayName("Wheaterflow Rain ETA")
        .description("Toont wanneer regen jouw locatie bereikt.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryInline,
            .accessoryCircular,
            .accessoryRectangular
        ])
    }
}

#Preview(as: .systemSmall) {
    RainETAWidget()
} timeline: {
    RainETAEntry(date: Date(), snapshot: .placeholder)
}

#Preview(as: .accessoryRectangular) {
    RainETAWidget()
} timeline: {
    RainETAEntry(date: Date(), snapshot: .placeholder)
}
