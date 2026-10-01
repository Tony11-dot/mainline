import AuthenticationServices
import Capacitor
import UIKit

/// Native sign-in for the iOS app.
/// - `webAuth`: OAuth (Lichess, Chess.com) in ASWebAuthenticationSession — a system sheet that hands the
///   `app.mainline.chess://auth?…` callback straight back to us (no "Open in MainLine?" prompt, full size on iPad).
/// - `appleSignIn`: Sign in with Apple; the identity token is verified by the API.
@objc(AuthPlugin)
public class AuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding,
    ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding
{
    public let identifier = "AuthPlugin"
    public let jsName = "Auth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "webAuth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appleSignIn", returnType: CAPPluginReturnPromise),
    ]

    private var session: ASWebAuthenticationSession?
    private var appleCall: CAPPluginCall?

    private var anchor: ASPresentationAnchor {
        bridge?.webView?.window ?? UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
    }

    // MARK: OAuth in the system sheet

    @objc func webAuth(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), let scheme = call.getString("callbackScheme") else {
            call.reject("url and callbackScheme are required")
            return
        }
        DispatchQueue.main.async {
            let s = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callback, error in
                self?.session = nil
                if let callback = callback {
                    call.resolve(["url": callback.absoluteString])
                } else if let e = error as? ASWebAuthenticationSessionError, e.code == .canceledLogin {
                    call.reject("cancelled", "cancelled")
                } else {
                    call.reject(error?.localizedDescription ?? "Sign-in failed", "failed")
                }
            }
            s.presentationContextProvider = self
            // A private session: no "wants to use … to sign in" alert, and no cookies left behind.
            s.prefersEphemeralWebBrowserSession = true
            self.session = s
            if !s.start() {
                self.session = nil
                call.reject("Could not open the sign-in sheet", "failed")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { anchor }

    // MARK: Sign in with Apple

    @objc func appleSignIn(_ call: CAPPluginCall) {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName] // no email: MainLine never contacts you
        if let nonce = call.getString("nonce") { request.nonce = nonce }
        DispatchQueue.main.async {
            self.appleCall = call
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { anchor }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = appleCall else { return }
        appleCall = nil
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = cred.identityToken, let token = String(data: tokenData, encoding: .utf8)
        else {
            call.reject("Apple didn't return an identity token", "failed")
            return
        }
        let name = [cred.fullName?.givenName, cred.fullName?.familyName].compactMap { $0 }.joined(separator: " ")
        call.resolve(["identityToken": token, "name": name])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = appleCall else { return }
        appleCall = nil
        if let e = error as? ASAuthorizationError, e.code == .canceled {
            call.reject("cancelled", "cancelled")
        } else {
            call.reject(error.localizedDescription, "failed")
        }
    }
}
