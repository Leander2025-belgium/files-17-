import Foundation

enum AppGroup {
    static let identifier = "group.be.wheaterflow.shared"
    static let snapshotKey = "rainETA.snapshot.v1"
    static let locationKey = "rainETA.location.v1"
}

enum AppGroupStore {
    private static var defaults: UserDefaults {
        UserDefaults(suiteName: AppGroup.identifier) ?? .standard
    }

    private static var encoder: JSONEncoder {
        WheaterflowJSON.encoder()
    }

    private static var decoder: JSONDecoder {
        WheaterflowJSON.decoder()
    }

    static func save(snapshot: RainETASnapshot) {
        guard let data = try? encoder.encode(snapshot) else { return }
        defaults.set(data, forKey: AppGroup.snapshotKey)
    }

    static func loadSnapshot() -> RainETASnapshot? {
        guard let data = defaults.data(forKey: AppGroup.snapshotKey) else { return nil }
        return try? decoder.decode(RainETASnapshot.self, from: data)
    }

    static func save(location: WeatherLocation) {
        guard let data = try? encoder.encode(location) else { return }
        defaults.set(data, forKey: AppGroup.locationKey)
    }

    static func loadLocation() -> WeatherLocation {
        guard
            let data = defaults.data(forKey: AppGroup.locationKey),
            let location = try? decoder.decode(WeatherLocation.self, from: data)
        else { return .oostende }
        return location
    }
}
