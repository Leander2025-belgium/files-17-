import ActivityKit
import Foundation

struct RainETAActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let status: RainStatus
        let title: String
        let summary: String
        let startsInMinutes: Int?
        let startTime: Date?
        let endTime: Date?
        let intensityLabel: String
        let confidencePercent: Int
        let heavyShower: Bool
        let thunderPossible: Bool

        init(snapshot: RainETASnapshot) {
            status = snapshot.status
            title = snapshot.title
            summary = snapshot.summary
            startsInMinutes = snapshot.startsInMinutes
            startTime = snapshot.startTime
            endTime = snapshot.endTime
            intensityLabel = snapshot.intensityLabel
            confidencePercent = snapshot.confidencePercent
            heavyShower = snapshot.heavyShower
            thunderPossible = snapshot.thunderPossible
        }
    }

    let locationName: String
}
