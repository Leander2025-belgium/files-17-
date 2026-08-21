import Foundation

enum WheaterflowJSON {
    static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { value in
            let container = try value.singleValueContainer()
            let raw = try container.decode(String.self)
            let fractional = ISO8601DateFormatter()
            fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = fractional.date(from: raw) { return date }
            let standard = ISO8601DateFormatter()
            standard.formatOptions = [.withInternetDateTime]
            if let date = standard.date(from: raw) { return date }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Ongeldige ISO 8601-datum: \(raw)"
            )
        }
        return decoder
    }
}

enum RainStatus: String, Codable, Hashable, Sendable {
    case raining
    case rainSoon = "rain_soon"
    case dry
    case unavailable
}

enum RainIntensity: String, Codable, Hashable, Sendable {
    case none
    case light
    case moderate
    case heavy
    case unknown
}

struct WeatherLocation: Codable, Hashable, Sendable {
    var name: String
    var latitude: Double
    var longitude: Double
    var timezone: String?

    static let oostende = WeatherLocation(
        name: "Oostende",
        latitude: 51.2405,
        longitude: 2.9309,
        timezone: "Europe/Brussels"
    )
}

struct RainETASlot: Codable, Hashable, Sendable {
    let time: Date
    let minutes: Int
    let precipitation: Double
    let weatherCode: Int?
    let wet: Bool
}

struct RainETASnapshot: Codable, Hashable, Sendable {
    let schemaVersion: Int
    let location: WeatherLocation
    let status: RainStatus
    let title: String
    let summary: String
    let startsInMinutes: Int?
    let startTime: Date?
    let endTime: Date?
    let endsInMinutes: Int?
    let intensity: RainIntensity
    let intensityLabel: String
    let dryWindowMinutes: Int?
    let confidence: Double
    let heavyShower: Bool
    let thunderPossible: Bool
    let source: String
    let slots: [RainETASlot]
    let generatedAt: Date
    let expiresAt: Date

    var confidencePercent: Int {
        Int((confidence * 100).rounded())
    }

    var primaryValue: String {
        switch status {
        case .raining: return "Nu"
        case .rainSoon: return startsInMinutes.map { "\($0) min" } ?? "Binnenkort"
        case .dry: return dryWindowMinutes.map { "> \($0) min" } ?? "Droog"
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

    var isFresh: Bool { expiresAt > Date() }

    static var placeholder: RainETASnapshot {
        let now = Date()
        return RainETASnapshot(
            schemaVersion: 1,
            location: .oostende,
            status: .rainSoon,
            title: "Regen over ±14 min",
            summary: "Lichte regen. Verwacht rond 10:30.",
            startsInMinutes: 14,
            startTime: now.addingTimeInterval(14 * 60),
            endTime: now.addingTimeInterval(65 * 60),
            endsInMinutes: 65,
            intensity: .light,
            intensityLabel: "Lichte regen",
            dryWindowMinutes: 14,
            confidence: 0.82,
            heavyShower: false,
            thunderPossible: false,
            source: "Wheaterflow Intelligence",
            slots: (0..<8).map { index in
                RainETASlot(
                    time: now.addingTimeInterval(Double(index * 15 * 60)),
                    minutes: index * 15,
                    precipitation: index < 1 ? 0 : index < 5 ? Double(index) * 0.18 : 0,
                    weatherCode: index < 1 ? 0 : 61,
                    wet: index >= 1 && index < 5
                )
            },
            generatedAt: now,
            expiresAt: now.addingTimeInterval(15 * 60)
        )
    }

    static var unavailablePlaceholder: RainETASnapshot {
        let now = Date()
        return RainETASnapshot(
            schemaVersion: 1,
            location: .oostende,
            status: .unavailable,
            title: "Rain ETA niet beschikbaar",
            summary: "Open Wheaterflow om de gedeelde locatie en data te vernieuwen.",
            startsInMinutes: nil,
            startTime: nil,
            endTime: nil,
            endsInMinutes: nil,
            intensity: .unknown,
            intensityLabel: "Onbekend",
            dryWindowMinutes: nil,
            confidence: 0,
            heavyShower: false,
            thunderPossible: false,
            source: "Geen actuele snapshot",
            slots: [],
            generatedAt: now,
            expiresAt: now
        )
    }
}

struct RainETAErrorBody: Decodable {
    let error: String?
}
