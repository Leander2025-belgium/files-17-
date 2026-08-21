import SwiftUI

@main
struct WheaterflowApp: App {
    @StateObject private var viewModel = RainETAViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView(viewModel: viewModel)
                .onOpenURL { url in
                    guard url.scheme == "wheaterflow" else { return }
                    Task { await viewModel.refresh() }
                }
        }
    }
}
