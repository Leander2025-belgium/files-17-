import SwiftUI

struct ContentView: View {
    @ObservedObject var viewModel: RainETAViewModel

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color(red: 0.03, green: 0.08, blue: 0.15), Color(red: 0.04, green: 0.20, blue: 0.28)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 18) {
                        header
                        rainCard
                        actions
                        architectureNote
                    }
                    .padding()
                }
                .refreshable { await viewModel.refresh() }
            }
            .navigationTitle("Wheaterflow")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task { await viewModel.refreshIfNeeded() }
            .alert("Wheaterflow", isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "Onbekende fout")
            }
        }
        .tint(.cyan)
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("RAIN ETA")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.cyan)
                Text(viewModel.location.name)
                    .font(.title2.bold())
                    .foregroundStyle(.white)
            }
            Spacer()
            Button {
                Task { await viewModel.useCurrentLocation() }
            } label: {
                Label("Mijn locatie", systemImage: "location.fill")
                    .labelStyle(.iconOnly)
                    .font(.title3)
                    .padding(12)
                    .background(.white.opacity(0.12), in: Circle())
            }
            .accessibilityLabel("Gebruik mijn huidige locatie")
        }
    }

    private var rainCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                Image(systemName: viewModel.snapshot.symbolName)
                    .font(.system(size: 36, weight: .semibold))
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, .cyan)
                Spacer()
                Text("\(viewModel.snapshot.confidencePercent)% zeker")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.white.opacity(0.12), in: Capsule())
            }

            VStack(alignment: .leading, spacing: 5) {
                Text(viewModel.snapshot.primaryValue)
                    .font(.system(size: 42, weight: .bold, design: .rounded))
                Text(viewModel.snapshot.title)
                    .font(.title3.weight(.semibold))
                Text(viewModel.snapshot.summary)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.72))
            }

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(viewModel.snapshot.slots.prefix(8).enumerated()), id: \.offset) { _, slot in
                    RoundedRectangle(cornerRadius: 4)
                        .fill(slot.wet ? Color.cyan : Color.white.opacity(0.18))
                        .frame(maxWidth: .infinity)
                        .frame(height: CGFloat(max(5, min(48, slot.precipitation * 15 + 5))))
                }
            }
            .frame(height: 48, alignment: .bottom)

            HStack {
                Text("Nu")
                Spacer()
                Text("2 uur")
            }
            .font(.caption2)
            .foregroundStyle(.white.opacity(0.55))

            Text("Bijgewerkt \(viewModel.snapshot.generatedAt.formatted(date: .omitted, time: .shortened))")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.5))
        }
        .foregroundStyle(.white)
        .padding(20)
        .background(.ultraThinMaterial.opacity(0.78), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(.white.opacity(0.12), lineWidth: 1)
        }
    }

    private var actions: some View {
        VStack(spacing: 12) {
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Label(viewModel.isLoading ? "Vernieuwen…" : "Rain ETA vernieuwen", systemImage: "arrow.clockwise")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(viewModel.isLoading)

            Button {
                Task {
                    if viewModel.isLiveActivityActive {
                        await viewModel.stopLiveActivity()
                    } else {
                        await viewModel.startLiveActivity()
                    }
                }
            } label: {
                Label(
                    viewModel.isLiveActivityActive ? "Live Activity stoppen" : "Start Live Activity",
                    systemImage: viewModel.isLiveActivityActive ? "stop.circle" : "livephoto"
                )
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .disabled(!viewModel.hasLiveData && viewModel.isLoading)
        }
        .foregroundStyle(.white)
    }

    private var architectureNote: some View {
        Label(
            "App, widget en Live Activity delen alleen locatie en Rain ETA via de beveiligde App Group. API-sleutels blijven op de server.",
            systemImage: "lock.shield.fill"
        )
        .font(.footnote)
        .foregroundStyle(.white.opacity(0.65))
        .padding(.horizontal, 4)
    }
}

#Preview {
    ContentView(viewModel: RainETAViewModel())
}
