import Combine
import CoreLocation
import Foundation
import WidgetKit

@MainActor
final class RainETAViewModel: ObservableObject {
    enum ViewModelError: LocalizedError {
        case noLiveData

        var errorDescription: String? {
            "Er is nog geen actuele Rain ETA om als Live Activity te starten."
        }
    }

    @Published private(set) var snapshot: RainETASnapshot
    @Published private(set) var location: WeatherLocation
    @Published private(set) var isLoading = false
    @Published private(set) var isLiveActivityActive = false
    @Published private(set) var hasLiveData = false
    @Published var errorMessage: String?

    private let client: RainETAClient
    private let locationProvider = LocationProvider()
    private let liveActivity = RainETALiveActivityController()

    init(client: RainETAClient = RainETAClient()) {
        self.client = client
        let cached = AppGroupStore.loadSnapshot()
        location = AppGroupStore.loadLocation()
        snapshot = cached ?? .unavailablePlaceholder
        hasLiveData = cached != nil
        isLiveActivityActive = liveActivity.isActive
    }

    func refreshIfNeeded() async {
        guard !hasLiveData || !snapshot.isFresh else { return }
        await refresh()
    }

    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let updated = try await client.fetch(for: location)
            snapshot = updated
            hasLiveData = true
            errorMessage = nil
            AppGroupStore.save(snapshot: updated)
            AppGroupStore.save(location: location)
            WidgetCenter.shared.reloadTimelines(ofKind: "RainETAWidget")
            if liveActivity.isActive { await liveActivity.update(with: updated) }
            isLiveActivityActive = liveActivity.isActive
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func useCurrentLocation() async {
        do {
            let current = try await locationProvider.requestOneShotLocation()
            location = WeatherLocation(
                name: "Mijn locatie",
                latitude: current.coordinate.latitude,
                longitude: current.coordinate.longitude,
                timezone: TimeZone.current.identifier
            )
            hasLiveData = false
            AppGroupStore.save(location: location)
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startLiveActivity() async {
        do {
            if !hasLiveData || !snapshot.isFresh { await refresh() }
            guard hasLiveData, snapshot.isFresh else { throw ViewModelError.noLiveData }
            try await liveActivity.start(with: snapshot)
            isLiveActivityActive = liveActivity.isActive
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func stopLiveActivity() async {
        await liveActivity.end()
        isLiveActivityActive = false
    }
}
