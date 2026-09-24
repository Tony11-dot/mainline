import Capacitor
import UIKit

/// Hosts the Capacitor bridge and registers MainLine's in-app plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeChromePlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Feels native: no rubber-band on the whole page, edge-to-edge under the status bar.
        webView?.scrollView.bounces = false
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.allowsBackForwardNavigationGestures = false
    }
}
