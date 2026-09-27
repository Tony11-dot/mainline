import Capacitor
import SwiftUI
import UIKit

/// Native chrome for the iOS app: a SwiftUI tab bar drawn with Apple's real Liquid Glass
/// (`.glassEffect()` on iOS 26+, `.ultraThinMaterial` before), overlaid on the Capacitor web view.
/// Routing stays in the web app: JS sets the tabs and selection, and gets `tabSelected` back.
@objc(NativeChromePlugin)
public class NativeChromePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeChromePlugin"
    public let jsName = "NativeChrome"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setTabs", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "select", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTheme", returnType: CAPPluginReturnPromise),
    ]

    private let model = TabBarModel()
    private var host: UIHostingController<GlassTabBar>?

    @objc func setTabs(_ call: CAPPluginCall) {
        let raw = call.getArray("tabs", JSObject.self) ?? []
        let tabs = raw.compactMap { t -> TabItem? in
            guard let id = t["id"] as? String, let label = t["label"] as? String else { return nil }
            return TabItem(id: id, label: label, symbol: (t["sfSymbol"] as? String) ?? "circle")
        }
        DispatchQueue.main.async {
            self.model.tabs = tabs
            if let selected = call.getString("selected") { self.model.selected = selected }
            self.installIfNeeded()
            call.resolve()
        }
    }

    @objc func select(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.model.selected = call.getString("id") ?? self.model.selected
            call.resolve()
        }
    }

    @objc func setVisible(_ call: CAPPluginCall) {
        let visible = call.getBool("visible") ?? true
        DispatchQueue.main.async {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) { self.model.visible = visible }
            self.host?.view.isUserInteractionEnabled = visible
            call.resolve()
        }
    }

    @objc func setTheme(_ call: CAPPluginCall) {
        let accent = call.getString("accent") ?? "#072EB8"
        let dark = call.getBool("dark") ?? false
        DispatchQueue.main.async {
            self.model.accent = Color(hex: accent)
            self.host?.overrideUserInterfaceStyle = dark ? .dark : .light
            call.resolve()
        }
    }

    private func installIfNeeded() {
        guard host == nil, let vc = bridge?.viewController, let root = vc.view else { return }
        model.onSelect = { [weak self] id in
            UISelectionFeedbackGenerator().selectionChanged()
            self?.notifyListeners("tabSelected", data: ["id": id])
        }
        let hosting = UIHostingController(rootView: GlassTabBar(model: model))
        hosting.view.backgroundColor = .clear
        hosting.view.translatesAutoresizingMaskIntoConstraints = false
        vc.addChild(hosting)
        root.addSubview(hosting.view)
        NSLayoutConstraint.activate([
            hosting.view.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            hosting.view.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            hosting.view.bottomAnchor.constraint(equalTo: root.bottomAnchor),
        ])
        hosting.didMove(toParent: vc)
        host = hosting
    }
}

struct TabItem: Identifiable, Equatable {
    let id: String
    let label: String
    let symbol: String
}

final class TabBarModel: ObservableObject {
    @Published var tabs: [TabItem] = []
    @Published var selected: String = ""
    @Published var visible = true
    @Published var accent: Color = Color(hex: "#072EB8")
    var onSelect: (String) -> Void = { _ in }
}

struct GlassTabBar: View {
    @ObservedObject var model: TabBarModel
    /// The tab under the finger while it slides along the bar (nil when not touching).
    @State private var hover: String?
    @Namespace private var pill

    var body: some View {
        GeometryReader { geo in
            let inner = geo.size.width - 16
            HStack(spacing: 0) {
                ForEach(model.tabs) { tab in
                    let lit = tab.id == (hover ?? model.selected)
                    VStack(spacing: 3) {
                        Image(systemName: lit ? filled(tab.symbol) : tab.symbol)
                            .font(.system(size: 20, weight: .semibold))
                            .symbolRenderingMode(.hierarchical)
                        Text(tab.label).font(.system(size: 10.5, weight: .semibold))
                    }
                    .foregroundStyle(lit ? model.accent : Color.secondary)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .scaleEffect(hover == tab.id ? 1.08 : 1)
                    .background {
                        if lit {
                            Capsule()
                                .fill(model.accent.opacity(0.14))
                                .padding(.horizontal, 2)
                                .matchedGeometryEffect(id: "pill", in: pill)
                        }
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(tab.label)
                    .accessibilityAddTraits(tab.id == model.selected ? [.isButton, .isSelected] : .isButton)
                    .accessibilityAction { choose(tab.id) }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
            // One gesture for tap and slide: the highlight follows the finger across the tabs
            // (a selection tick per tab) and lifting the finger opens the tab under it.
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { g in
                        let id = tabAt(g.location.x - 8, width: inner)
                        if id != hover {
                            if hover != nil { UISelectionFeedbackGenerator().selectionChanged() }
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) { hover = id }
                        }
                    }
                    .onEnded { g in
                        let id = tabAt(g.location.x - 8, width: inner)
                        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) { hover = nil }
                        if let id { choose(id) }
                    }
            )
            .modifier(GlassBackground())
        }
        .frame(height: 62)
        .padding(.horizontal, 14)
        .padding(.bottom, 6)
        .offset(y: model.visible ? 0 : 140)
        .opacity(model.visible ? 1 : 0)
    }

    private func tabAt(_ x: CGFloat, width: CGFloat) -> String? {
        guard !model.tabs.isEmpty, width > 0 else { return nil }
        let i = Int((x / width) * CGFloat(model.tabs.count))
        return model.tabs[max(0, min(model.tabs.count - 1, i))].id
    }

    private func choose(_ id: String) {
        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) { model.selected = id }
        model.onSelect(id)
    }

    private func filled(_ s: String) -> String {
        UIImage(systemName: s + ".fill") != nil ? s + ".fill" : s
    }
}

/// Real Liquid Glass on iOS 26+, the system material before that.
struct GlassBackground: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.interactive(), in: .capsule)
        } else {
            content.background(.ultraThinMaterial, in: Capsule()).overlay(Capsule().strokeBorder(.white.opacity(0.25), lineWidth: 0.5))
        }
    }
}

extension Color {
    init(hex: String) {
        var v: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}
