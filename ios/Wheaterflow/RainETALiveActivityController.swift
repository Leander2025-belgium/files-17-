import ActivityKit
import Foundation

@MainActor
final class RainETALiveActivityController {
    enum LiveActivityError: LocalizedError {
        case disabled

        var errorDescription: String? {
            "Live Activities staan uit voor Wheaterflow."
        }
    }

    var isActive: Bool {
        !Activity<RainETAActivityAttributes>.activities.isEmpty
    }

    func start(with snapshot: RainETASnapshot) async throws {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            throw LiveActivityError.disabled
        }
        if isActive {
            await update(with: snapshot)
            return
        }
        let attributes = RainETAActivityAttributes(locationName: snapshot.location.name)
        let state = RainETAActivityAttributes.ContentState(snapshot: snapshot)
        let content = ActivityContent(state: state, staleDate: snapshot.expiresAt)
        _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
    }

    func update(with snapshot: RainETASnapshot) async {
        let state = RainETAActivityAttributes.ContentState(snapshot: snapshot)
        let content = ActivityContent(state: state, staleDate: snapshot.expiresAt)
        for activity in Activity<RainETAActivityAttributes>.activities {
            await activity.update(content)
        }
    }

    func end() async {
        for activity in Activity<RainETAActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
