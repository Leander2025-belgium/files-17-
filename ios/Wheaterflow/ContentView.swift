import AVFoundation
import SwiftUI

struct ContentView: View {
    @ObservedObject var viewModel: RainETAViewModel

    var body: some View {
        TabView {
            rainView
                .tabItem {
                    Label("Weer", systemImage: "cloud.rain.fill")
                }

            WheaterflowRadioView(viewModel: viewModel)
                .tabItem {
                    Label("Radio", systemImage: "radio.fill")
                }
        }
        .tint(.cyan)
    }

    private var rainView: some View {
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

private struct WheaterflowRadioView: View {
    @ObservedObject var viewModel: RainETAViewModel
    @StateObject private var radio = WheaterflowRadioPlayer()

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.03, green: 0.07, blue: 0.13),
                        Color(red: 0.05, green: 0.18, blue: 0.25),
                        Color(red: 0.08, green: 0.11, blue: 0.22)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 18) {
                        radioHeader
                        nowPlayingCard
                        controls
                        nextCard
                        betaNote
                    }
                    .padding()
                }
                .refreshable { await viewModel.refresh() }
            }
            .navigationTitle("Wheaterflow Radio")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task { await viewModel.refreshIfNeeded() }
            .onDisappear { radio.stop() }
        }
    }

    private var radioHeader: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(.white.opacity(0.12))
                    .frame(width: 52, height: 52)

                Image(systemName: "radio.fill")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.cyan)
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Text("WHEATERFLOW RADIO")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.cyan)

                    Text("BETA")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(.white.opacity(0.12), in: Capsule())
                        .foregroundStyle(.white.opacity(0.82))
                }

                Text(viewModel.location.name)
                    .font(.title2.bold())
                    .foregroundStyle(.white)
            }

            Spacer()
        }
    }

    private var nowPlayingCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(radio.isPlaying ? "NU OP WHEATERFLOW RADIO" : "KLAAR OM TE STARTEN")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.cyan)

                    Text(radio.isPlaying ? "Live weerbulletin" : "Wheaterflow Radio Beta")
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                }

                Spacer()

                HStack(alignment: .bottom, spacing: 4) {
                    ForEach(0..<4, id: \.self) { index in
                        RoundedRectangle(cornerRadius: 3)
                            .fill(radio.isPlaying ? Color.cyan : Color.white.opacity(0.25))
                            .frame(width: 5, height: radio.isPlaying ? CGFloat([18, 31, 24, 38][index]) : 10)
                    }
                }
                .frame(height: 40, alignment: .bottom)
                .animation(.easeInOut(duration: 0.5), value: radio.isPlaying)
            }

            Divider()
                .overlay(.white.opacity(0.10))

            HStack(alignment: .top, spacing: 14) {
                Image(systemName: viewModel.snapshot.symbolName)
                    .font(.system(size: 36, weight: .semibold))
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, .cyan)
                    .frame(width: 46)

                VStack(alignment: .leading, spacing: 5) {
                    Text(viewModel.snapshot.title)
                        .font(.headline)
                        .foregroundStyle(.white)

                    Text(viewModel.snapshot.summary)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.70))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            HStack {
                Label("\(viewModel.snapshot.confidencePercent)% zekerheid", systemImage: "waveform.path.ecg")
                Spacer()
                Text("\(viewModel.snapshot.generatedAt.formatted(date: .omitted, time: .shortened))")
            }
            .font(.caption)
            .foregroundStyle(.white.opacity(0.58))
        }
        .padding(20)
        .background(.ultraThinMaterial.opacity(0.80), in: RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .stroke(.white.opacity(0.12), lineWidth: 1)
        }
    }

    private var controls: some View {
        Button {
            Task {
                if radio.isPlaying {
                    radio.stop()
                } else {
                    await viewModel.refreshIfNeeded()
                    radio.start(location: viewModel.location, snapshot: viewModel.snapshot)
                }
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: radio.isPlaying ? "stop.fill" : "play.fill")
                Text(radio.isPlaying ? "Stop radio" : "Start Wheaterflow Radio")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .tint(.cyan)
    }

    private var nextCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Radio 0.1", systemImage: "sparkles")
                .font(.headline)
                .foregroundStyle(.white)

            radioRow(icon: "waveform", title: "Nu", detail: "Gesproken weerbulletin")
            radioRow(icon: "location.fill", title: "Locatie", detail: viewModel.location.name)
            radioRow(icon: "cloud.rain.fill", title: "Bron", detail: "Wheaterflow Rain ETA")
            radioRow(icon: "brain.head.profile", title: "Volgende stap", detail: "Brain + alerts + echte audiostream")
        }
        .padding(18)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(.white.opacity(0.09), lineWidth: 1)
        }
    }

    private func radioRow(icon: String, title: String, detail: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.cyan)
                .frame(width: 22)

            Text(title)
                .foregroundStyle(.white.opacity(0.65))

            Spacer()

            Text(detail)
                .foregroundStyle(.white)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }

    private var betaNote: some View {
        Label(
            "Deze eerste versie maakt het bulletin lokaal op de iPhone. Muziek, jingles, Brain-bulletins en een echte 24/7-stream kunnen daarna server-side worden toegevoegd.",
            systemImage: "iphone.and.arrow.forward"
        )
        .font(.footnote)
        .foregroundStyle(.white.opacity(0.62))
        .padding(.horizontal, 4)
    }
}

private final class WheaterflowRadioPlayer: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    @Published private(set) var isPlaying = false
    @Published private(set) var lastBulletin = ""

    private let synthesizer = AVSpeechSynthesizer()

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func start(location: WeatherLocation, snapshot: RainETASnapshot) {
        stop()

        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? session.setActive(true)

        let bulletin = makeBulletin(location: location, snapshot: snapshot)
        lastBulletin = bulletin

        let utterance = AVSpeechUtterance(string: bulletin)
        utterance.voice = AVSpeechSynthesisVoice(language: "nl-BE")
        utterance.rate = 0.48
        utterance.pitchMultiplier = 1.0
        utterance.preUtteranceDelay = 0.18
        utterance.postUtteranceDelay = 0.10

        isPlaying = true
        synthesizer.speak(utterance)
    }

    func stop() {
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
        isPlaying = false
    }

    private func makeBulletin(location: WeatherLocation, snapshot: RainETASnapshot) -> String {
        let intro = "Dit is Wheaterflow Radio. De actuele weerupdate voor \(location.name)."

        let rainLine: String
        switch snapshot.status {
        case .raining:
            rainLine = "Op dit moment wordt neerslag gedetecteerd. \(snapshot.intensityLabel)."
        case .rainSoon:
            if let minutes = snapshot.startsInMinutes {
                rainLine = "Regen wordt verwacht binnen ongeveer \(minutes) minuten. \(snapshot.intensityLabel)."
            } else {
                rainLine = "Regen wordt binnenkort verwacht. \(snapshot.intensityLabel)."
            }
        case .dry:
            if let minutes = snapshot.dryWindowMinutes {
                rainLine = "Volgens de huidige radar blijft het minstens ongeveer \(minutes) minuten droog."
            } else {
                rainLine = "Volgens de huidige radar blijft het voorlopig droog."
            }
        case .unavailable:
            rainLine = "De actuele Rain ETA is momenteel niet beschikbaar."
        }

        var alertLine = ""
        if snapshot.thunderPossible {
            alertLine += " Er is kans op onweer."
        }
        if snapshot.heavyShower {
            alertLine += " Er kan een stevige bui voorkomen."
        }

        let confidence = " De huidige zekerheid is \(snapshot.confidencePercent) procent."
        let close = " Je luistert naar Wheaterflow Radio."

        return intro + " " + rainLine + alertLine + confidence + close
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in
            self?.isPlaying = false
            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in
            self?.isPlaying = false
            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        }
    }
}

#Preview {
    ContentView(viewModel: RainETAViewModel())
}
