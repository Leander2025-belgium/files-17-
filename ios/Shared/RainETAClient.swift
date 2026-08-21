import Foundation

enum RainETAClientError: LocalizedError {
    case invalidEndpoint
    case invalidResponse
    case server(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint: return "De Rain ETA-endpoint is ongeldig."
        case .invalidResponse: return "De server gaf geen geldig antwoord."
        case let .server(_, message): return message
        }
    }
}

struct RainETAClient: Sendable {
    static let productionEndpoint = URL(string: "https://api.wheaterflow.be/api/rain-eta")!
    let endpoint: URL

    init(endpoint: URL = Self.productionEndpoint) {
        self.endpoint = endpoint
    }

    func fetch(for location: WeatherLocation) async throws -> RainETASnapshot {
        guard var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else {
            throw RainETAClientError.invalidEndpoint
        }
        components.queryItems = [
            URLQueryItem(name: "lat", value: String(location.latitude)),
            URLQueryItem(name: "lon", value: String(location.longitude)),
            URLQueryItem(name: "name", value: location.name)
        ]
        guard let url = components.url else { throw RainETAClientError.invalidEndpoint }

        var request = URLRequest(url: url)
        request.timeoutInterval = 12
        request.cachePolicy = .reloadRevalidatingCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Wheaterflow-iOS/1.0", forHTTPHeaderField: "User-Agent")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw RainETAClientError.invalidResponse
        }
        guard 200..<300 ~= http.statusCode else {
            let body = try? JSONDecoder().decode(RainETAErrorBody.self, from: data)
            throw RainETAClientError.server(
                status: http.statusCode,
                message: body?.error ?? "Rain ETA is tijdelijk niet beschikbaar (HTTP \(http.statusCode))."
            )
        }

        return try WheaterflowJSON.decoder().decode(RainETASnapshot.self, from: data)
    }
}
